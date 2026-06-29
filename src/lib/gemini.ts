/**
 * Gemini API service for News Triangulator.
 *
 * Orchestrates the triangulation flow:
 * 1. One grounded search gathering progressive, conservative, and international coverage
 * 2. A schema-constrained call that structures that research into three lenses
 * 3. Synthesis (consensus, spin, stripped truth)
 *
 * Optional: set GEMINI_STORY_VALIDATION=true for an extra validation call before search.
 * Transient upstream errors (503/500/429) are retried with backoff.
 *
 * Uses @google/genai (Gemini Developer API mode) with Google Search grounding.
 * Authenticate with a free API key in the GEMINI_API_KEY env var
 * (create one at https://aistudio.google.com/apikey).
 */

import { GoogleGenAI, Type } from '@google/genai';
import type {
  GenerateContentResponse,
  GenerateContentParameters,
  Tool,
  Schema,
} from '@google/genai';
import {
  SYSTEM_CONTEXT,
  buildStoryValidationPrompt,
  buildAllPerspectivesPrompt,
  buildAnalysisPrompt,
} from './prompts';
import type {
  Perspective,
  PerspectiveLabel,
  PerspectiveRawResponse,
  FullAnalysisRawResponse,
  ValidationRawResponse,
  SynthesisRawResponse,
  TriangulationResult,
  Source,
} from './types';
import { GeminiServiceError } from './types';

/* ──────────────────────────────────────────────────────────────────────
 * Constants
 * ────────────────────────────────────────────────────────────────────── */

const MODEL_ID = 'gemini-2.5-flash-lite';

const GOOGLE_SEARCH_TOOL: Tool = { googleSearch: {} };

/**
 * Response schemas for the calls that do NOT use Search Grounding.
 * Passing these turns on Gemini's constrained decoding, which guarantees
 * syntactically valid JSON (no unescaped quotes / truncation surprises).
 * Note: schemas are incompatible with the googleSearch tool, so the
 * grounded perspectives call still parses free-text JSON.
 */
const STRING_ARRAY: Schema = { type: Type.ARRAY, items: { type: Type.STRING } };

const PERSPECTIVE_OBJECT: Schema = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    uniqueClaims: STRING_ARRAY,
    tone: { type: Type.STRING },
  },
  required: ['summary', 'uniqueClaims', 'tone'],
};

const VALIDATION_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    isValidNewsQuery: { type: Type.BOOLEAN },
    reason: { type: Type.STRING },
  },
  required: ['isValidNewsQuery', 'reason'],
};

/**
 * Combined schema for the single post-search analysis call: the three lenses
 * plus the synthesis (consensus, spin, stripped truth) in one response.
 */
const FULL_ANALYSIS_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    progressive: PERSPECTIVE_OBJECT,
    conservative: PERSPECTIVE_OBJECT,
    international: PERSPECTIVE_OBJECT,
    consensusFacts: STRING_ARRAY,
    spinIndicators: {
      type: Type.OBJECT,
      properties: {
        progressive: STRING_ARRAY,
        conservative: STRING_ARRAY,
        international: STRING_ARRAY,
      },
      required: ['progressive', 'conservative', 'international'],
    },
    strippedTruth: { type: Type.STRING },
  },
  required: [
    'progressive',
    'conservative',
    'international',
    'consensusFacts',
    'spinIndicators',
    'strippedTruth',
  ],
};

const PERSPECTIVE_LABELS: PerspectiveLabel[] = [
  'progressive',
  'conservative',
  'international',
];

/* ──────────────────────────────────────────────────────────────────────
 * Response helpers
 * ────────────────────────────────────────────────────────────────────── */

function getResponseText(response: GenerateContentResponse): string {
  return response.text ?? '';
}

/**
 * Returns the HTTP status if the error is a transient, retryable upstream
 * failure (503 high-demand, 500 internal, 429 rate spike); otherwise
 * undefined. Walks the error/cause chain since @google/genai wraps errors.
 */
function transientStatus(error: unknown): number | undefined {
  const RETRYABLE = new Set([429, 500, 503]);
  let cur: unknown = error;
  const seen = new Set<unknown>();
  for (let i = 0; i < 6 && cur != null && !seen.has(cur); i++) {
    seen.add(cur);
    if (typeof cur === 'object') {
      const o = cur as Record<string, unknown>;
      for (const key of ['status', 'code'] as const) {
        const v = o[key];
        if (typeof v === 'number' && RETRYABLE.has(v)) return v;
      }
      // @google/genai sometimes nests { error: { code, status } }
      const nested = o.error as Record<string, unknown> | undefined;
      if (nested && typeof nested.code === 'number' && RETRYABLE.has(nested.code)) {
        return nested.code;
      }
    }
    cur =
      typeof cur === 'object' && cur !== null && 'cause' in cur
        ? (cur as { cause: unknown }).cause
        : undefined;
  }
  // Fall back to matching the message text (SDK throws Error with JSON body).
  const msg = error instanceof Error ? error.message : String(error ?? '');
  if (/\b503\b|UNAVAILABLE|high demand/i.test(msg)) return 503;
  if (/\b500\b|INTERNAL/i.test(msg)) return 500;
  if (/\b429\b|RESOURCE_EXHAUSTED/i.test(msg)) return 429;
  return undefined;
}

/* ──────────────────────────────────────────────────────────────────────
 * JSON Parsing Utility
 * ────────────────────────────────────────────────────────────────────── */

/**
 * Parses a Gemini response that should be JSON.
 * Handles the common case where Gemini wraps JSON in markdown fences.
 */
function parseGeminiJson<T>(raw: string, context: string): T {
  // First attempt: direct parse
  try {
    return JSON.parse(raw) as T;
  } catch {
    // Gemini sometimes wraps in ```json ... ``` blocks
  }

  // Second attempt: strip markdown fences
  const stripped = raw
    .replace(/^```(?:json)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim();

  try {
    return JSON.parse(stripped) as T;
  } catch {
    // Fall through to the more aggressive recovery below.
  }

  // Third attempt: isolate the outermost JSON object and strip trailing
  // commas — a last-resort safety net for any stray prose around the JSON.
  try {
    const start = stripped.indexOf('{');
    const end = stripped.lastIndexOf('}');
    if (start !== -1 && end > start) {
      const candidate = stripped
        .slice(start, end + 1)
        // remove trailing commas before } or ]
        .replace(/,(\s*[}\]])/g, '$1');
      return JSON.parse(candidate) as T;
    }
  } catch {
    // Give up and report below.
  }

  throw new GeminiServiceError(
    `Failed to parse Gemini JSON response for ${context}. Raw: ${raw.slice(0, 200)}`,
    'parsing'
  );
}

/* ──────────────────────────────────────────────────────────────────────
 * Source Extraction from Grounding Metadata
 * ────────────────────────────────────────────────────────────────────── */

/**
 * Extracts source names and URLs from Gemini's grounding metadata.
 * These are real outlets that Gemini found and cited during Search Grounding.
 */
function extractSourcesFromGrounding(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  candidates: Record<string, unknown>[]
): Source[] {
  const sources: Source[] = [];
  const seenUrls = new Set<string>();

  try {
    for (const candidate of candidates) {
      const metadata = candidate.groundingMetadata as
        | Record<string, unknown>
        | undefined;
      if (!metadata) continue;

      const chunks = metadata.groundingChunks as
        | Array<{ web?: { uri?: string; title?: string } }>
        | undefined;
      if (!chunks) continue;

      for (const chunk of chunks) {
        const uri = chunk.web?.uri;
        const title = chunk.web?.title;

        if (uri && title && !seenUrls.has(uri)) {
          seenUrls.add(uri);
          sources.push({ name: title, url: uri });
        }
      }
    }
  } catch {
    // If grounding metadata is malformed, return empty sources
    // The perspective data itself is still valid
  }

  return sources;
}

/* ──────────────────────────────────────────────────────────────────────
 * Validation Helpers
 * ────────────────────────────────────────────────────────────────────── */

/** Validates that a synthesis response has the expected shape */
function validateSynthesisResponse(data: SynthesisRawResponse): boolean {
  return (
    Array.isArray(data.consensusFacts) &&
    data.consensusFacts.length > 0 &&
    typeof data.spinIndicators === 'object' &&
    data.spinIndicators !== null &&
    typeof data.strippedTruth === 'string' &&
    data.strippedTruth.length > 0
  );
}

/* ──────────────────────────────────────────────────────────────────────
 * GeminiService Class
 * ────────────────────────────────────────────────────────────────────── */

/**
 * Service class encapsulating all Gemini API interactions.
 * Manages the triangulation flow with proper error handling.
 */
export class GeminiService {
  private readonly ai: GoogleGenAI;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new GeminiServiceError(
        'GEMINI_API_KEY is not set. Create a free key at https://aistudio.google.com/apikey ' +
          'and add it to your environment (.env.local locally, or Vercel project settings).',
        'config'
      );
    }

    // Gemini Developer API mode (free tier, API-key based) — no Vertex/billing.
    this.ai = new GoogleGenAI({ apiKey });
  }

  /**
   * Wraps generateContent with retry + exponential backoff for transient
   * upstream failures (503 UNAVAILABLE "high demand", 500 INTERNAL, 429).
   * The free tier returns these intermittently; a couple of retries makes
   * the request reliable instead of failing the whole triangulation.
   */
  private async generateWithRetry(
    params: GenerateContentParameters,
    maxAttempts = 5
  ): Promise<GenerateContentResponse> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await this.ai.models.generateContent(params);
      } catch (error) {
        lastError = error;
        const status = transientStatus(error);
        if (status === undefined || attempt === maxAttempts) throw error;
        // Exponential backoff capped at 8s, with a little jitter.
        const delay =
          Math.min(700 * 2 ** (attempt - 1), 8000) +
          Math.floor(Math.random() * 300);
        console.warn(
          `[GeminiService] Transient ${status} from Gemini; retry ${attempt}/${maxAttempts - 1} in ${delay}ms`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    throw lastError;
  }

  /**
   * Validates that the user's input is a news story or claim.
   * Non-blocking: if validation itself fails (API error), we skip it
   * and proceed with the triangulation rather than blocking the user.
   */
  private async validateStory(query: string): Promise<void> {
    try {
      const result = await this.generateWithRetry({
        model: MODEL_ID,
        contents: [{ role: 'user', parts: [{ text: buildStoryValidationPrompt(query) }] }],
        config: {
          systemInstruction: SYSTEM_CONTEXT,
          maxOutputTokens: 8192,
          responseMimeType: 'application/json',
          responseSchema: VALIDATION_SCHEMA,
        },
      });

      const text = getResponseText(result);
      const parsed = parseGeminiJson<ValidationRawResponse>(
        text,
        'story validation'
      );

      if (!parsed.isValidNewsQuery) {
        throw new GeminiServiceError(
          `Input does not appear to be a news story: ${parsed.reason}`,
          'validation'
        );
      }
    } catch (error) {
      if (error instanceof GeminiServiceError) throw error;
      // Log the real error but don't block — validation is optional
      console.warn(
        '[GeminiService] Validation call failed, skipping:',
        error instanceof Error ? error.message : error
      );
    }
  }

  /**
   * Step 1 — grounded live search. Gathers coverage across the three lenses as
   * free-form research text (the googleSearch tool can't be combined with a
   * response schema, so structuring happens in step 2).
   */
  private async searchCoverage(query: string): Promise<{
    researchText: string;
    consultedSources: Source[];
  }> {
    try {
      const searchResult = await this.generateWithRetry({
        model: MODEL_ID,
        contents: [{ role: 'user', parts: [{ text: buildAllPerspectivesPrompt(query) }] }],
        config: {
          systemInstruction: SYSTEM_CONTEXT,
          tools: [GOOGLE_SEARCH_TOOL],
          maxOutputTokens: 8192,
        },
      });

      const researchText = getResponseText(searchResult);
      if (!researchText.trim()) {
        throw new GeminiServiceError(
          'The grounded search returned no coverage for this story',
          'perspective'
        );
      }

      const candidates = (searchResult.candidates ??
        []) as unknown as Record<string, unknown>[];
      const consultedSources = extractSourcesFromGrounding(candidates);

      return { researchText, consultedSources };
    } catch (error) {
      if (error instanceof GeminiServiceError) throw error;
      throw new GeminiServiceError(
        'Failed to fetch perspectives (grounded search)',
        'perspective',
        error
      );
    }
  }

  /**
   * Step 2 — a single schema-constrained call (no search tool) that turns the
   * research text into BOTH the three structured lenses AND the synthesis.
   * Constrained decoding guarantees complete, valid JSON, and doing it in one
   * call keeps each triangulation to just two requests against the free-tier
   * daily quota.
   */
  private async analyzeCoverage(researchText: string): Promise<{
    perspectives: [Perspective, Perspective, Perspective];
    synthesis: SynthesisRawResponse;
  }> {
    try {
      const result = await this.generateWithRetry({
        model: MODEL_ID,
        contents: [
          { role: 'user', parts: [{ text: buildAnalysisPrompt(researchText) }] },
        ],
        config: {
          systemInstruction: SYSTEM_CONTEXT,
          maxOutputTokens: 8192,
          responseMimeType: 'application/json',
          responseSchema: FULL_ANALYSIS_SCHEMA,
        },
      });

      const parsed = parseGeminiJson<FullAnalysisRawResponse>(
        getResponseText(result),
        'analysis'
      );

      const perspectives: Perspective[] = [];
      for (const label of PERSPECTIVE_LABELS) {
        const raw = parsed[label] as PerspectiveRawResponse | undefined;
        // The schema guarantees the fields exist; a lens can still come back
        // thin (e.g. little coverage from one side). Degrade gracefully with
        // sensible defaults rather than failing the whole triangulation.
        const summary = raw?.summary?.trim();
        if (!summary) {
          throw new GeminiServiceError(
            `Empty ${label} perspective — the model returned no summary`,
            'perspective'
          );
        }
        const uniqueClaims =
          Array.isArray(raw?.uniqueClaims) && raw.uniqueClaims.length > 0
            ? raw.uniqueClaims
            : ['No distinctive framing was identified for this perspective.'];
        const tone = raw?.tone?.trim() || 'neutral';

        perspectives.push({ label, sources: [], summary, uniqueClaims, tone });
      }

      const synthesis: SynthesisRawResponse = {
        consensusFacts: parsed.consensusFacts,
        spinIndicators: parsed.spinIndicators,
        strippedTruth: parsed.strippedTruth,
      };
      if (!validateSynthesisResponse(synthesis)) {
        throw new GeminiServiceError(
          'Malformed analysis response — synthesis fields missing',
          'synthesis'
        );
      }

      return {
        perspectives: perspectives as [
          Perspective,
          Perspective,
          Perspective,
        ],
        synthesis,
      };
    } catch (error) {
      if (error instanceof GeminiServiceError) throw error;
      throw new GeminiServiceError(
        'Failed to analyze coverage',
        'synthesis',
        error
      );
    }
  }

  /**
   * Orchestrates the triangulation flow: optional validation, one grounded
   * multi-lens search, then one combined structure-and-synthesis call.
   */
  async triangulate(query: string): Promise<TriangulationResult> {
    if (process.env.GEMINI_STORY_VALIDATION === 'true') {
      await this.validateStory(query);
    }

    const { researchText, consultedSources } = await this.searchCoverage(query);
    const { perspectives, synthesis } = await this.analyzeCoverage(researchText);

    return {
      perspectives,
      ...(consultedSources.length > 0 ? { consultedSources } : {}),
      consensusFacts: synthesis.consensusFacts,
      spinIndicators: synthesis.spinIndicators,
      strippedTruth: synthesis.strippedTruth,
      storyQuery: query,
      processedAt: new Date().toISOString(),
    };
  }
}
