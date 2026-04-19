/**
 * Gemini API service for News Triangulator.
 *
 * Orchestrates a two-call triangulation flow (minimal quota use):
 * 1. One grounded search returning progressive, conservative, and international lenses
 * 2. Synthesis (consensus, spin, stripped truth)
 *
 * Optional: set GEMINI_STORY_VALIDATION=true for an extra validation call before search.
 *
 * Uses @google-cloud/vertexai (Vertex AI Gemini) with Google Search grounding.
 * Authenticate with Application Default Credentials (gcloud auth application-default login,
 * or a service account on GCP).
 */

import { VertexAI } from '@google-cloud/vertexai';
import type { GenerateContentResult, Tool } from '@google-cloud/vertexai';
import {
  SYSTEM_CONTEXT,
  buildStoryValidationPrompt,
  buildAllPerspectivesPrompt,
  buildSynthesisPrompt,
} from './prompts';
import type {
  Perspective,
  PerspectiveLabel,
  PerspectiveRawResponse,
  AllPerspectivesRawResponse,
  ValidationRawResponse,
  SynthesisRawResponse,
  TriangulationResult,
  Source,
} from './types';
import { GeminiServiceError } from './types';

/* ──────────────────────────────────────────────────────────────────────
 * Constants
 * ────────────────────────────────────────────────────────────────────── */

const VERTEX_PROJECT = 'news-triangulator';
const VERTEX_LOCATION = 'us-central1';
const MODEL_ID = 'gemini-2.5-flash';

/** REST field supported by Vertex; SDK Tool union predates this shape. */
const GOOGLE_SEARCH_TOOL = { googleSearch: {} } as unknown as Tool;

const PERSPECTIVE_LABELS: PerspectiveLabel[] = [
  'progressive',
  'conservative',
  'international',
];

/* ──────────────────────────────────────────────────────────────────────
 * Vertex response helpers
 * ────────────────────────────────────────────────────────────────────── */

function getTextFromVertexResult(result: GenerateContentResult): string {
  const parts = result.response.candidates?.[0]?.content?.parts;
  if (!parts?.length) return '';
  return parts
    .map((p) => ('text' in p && typeof p.text === 'string' ? p.text : ''))
    .join('');
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
  } catch (error) {
    throw new GeminiServiceError(
      `Failed to parse Gemini JSON response for ${context}. Raw: ${raw.slice(0, 200)}`,
      'parsing',
      error
    );
  }
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

/** Validates that a perspective response has the expected shape */
function validatePerspectiveResponse(
  data: PerspectiveRawResponse
): boolean {
  return (
    typeof data.summary === 'string' &&
    data.summary.length > 0 &&
    Array.isArray(data.uniqueClaims) &&
    data.uniqueClaims.length > 0 &&
    typeof data.tone === 'string' &&
    data.tone.length > 0
  );
}

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
  private readonly model;

  constructor() {
    const vertex = new VertexAI({
      project: VERTEX_PROJECT,
      location: VERTEX_LOCATION,
    });
    this.model = vertex.getGenerativeModel({
      model: MODEL_ID,
      systemInstruction: SYSTEM_CONTEXT,
    });
  }

  /**
   * Validates that the user's input is a news story or claim.
   * Non-blocking: if validation itself fails (API error), we skip it
   * and proceed with the triangulation rather than blocking the user.
   */
  private async validateStory(query: string): Promise<void> {
    try {
      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: buildStoryValidationPrompt(query) }] }],
        generationConfig: {
          maxOutputTokens: 8192,
          responseMimeType: 'application/json',
        },
      });

      const text = getTextFromVertexResult(result);
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
   * Fetches all three perspectives in one Search Grounding call (counts as a
   * single generate_content request toward daily quota).
   */
  private async fetchAllPerspectives(query: string): Promise<{
    perspectives: [Perspective, Perspective, Perspective];
    consultedSources: Source[];
  }> {
    try {
      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: buildAllPerspectivesPrompt(query) }] }],
        tools: [GOOGLE_SEARCH_TOOL],
        generationConfig: { maxOutputTokens: 8192 },
      });

      const text = getTextFromVertexResult(result);
      const parsed = parseGeminiJson<AllPerspectivesRawResponse>(
        text,
        'all perspectives'
      );

      const perspectives: Perspective[] = [];
      for (const label of PERSPECTIVE_LABELS) {
        const raw = parsed[label] as PerspectiveRawResponse | undefined;
        if (!raw || !validatePerspectiveResponse(raw)) {
          throw new GeminiServiceError(
            `Malformed ${label} perspective response — missing required fields`,
            'perspective'
          );
        }
        perspectives.push({
          label,
          sources: [],
          summary: raw.summary,
          uniqueClaims: raw.uniqueClaims,
          tone: raw.tone,
        });
      }

      const candidates = (result.response.candidates ??
        []) as unknown as Record<string, unknown>[];
      const consultedSources = extractSourcesFromGrounding(candidates);

      return {
        perspectives: perspectives as [
          Perspective,
          Perspective,
          Perspective,
        ],
        consultedSources,
      };
    } catch (error) {
      if (error instanceof GeminiServiceError) throw error;
      throw new GeminiServiceError(
        'Failed to fetch perspectives (combined search)',
        'perspective',
        error
      );
    }
  }

  /**
   * Synthesizes the three perspectives into consensus facts, spin
   * indicators, and the stripped truth paragraph.
   */
  private async synthesize(
    perspectives: Perspective[]
  ): Promise<SynthesisRawResponse> {
    try {
      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: buildSynthesisPrompt(perspectives) }] }],
        generationConfig: {
          maxOutputTokens: 8192,
          responseMimeType: 'application/json',
        },
      });

      const text = getTextFromVertexResult(result);
      const parsed = parseGeminiJson<SynthesisRawResponse>(
        text,
        'synthesis'
      );

      if (!validateSynthesisResponse(parsed)) {
        throw new GeminiServiceError(
          'Malformed synthesis response — missing required fields',
          'synthesis'
        );
      }

      return parsed;
    } catch (error) {
      if (error instanceof GeminiServiceError) throw error;
      throw new GeminiServiceError(
        'Failed to synthesize perspectives',
        'synthesis',
        error
      );
    }
  }

  /**
   * Orchestrates the triangulation flow: optional validation, one grounded
   * multi-lens search, then synthesis.
   */
  async triangulate(query: string): Promise<TriangulationResult> {
    if (process.env.GEMINI_STORY_VALIDATION === 'true') {
      await this.validateStory(query);
    }

    const { perspectives, consultedSources } =
      await this.fetchAllPerspectives(query);

    const synthesis = await this.synthesize(perspectives);

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
