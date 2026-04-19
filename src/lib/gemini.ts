/**
 * Gemini API service for News Triangulator.
 *
 * Orchestrates the four-call triangulation flow:
 * 1. Story validation (optional fast-fail)
 * 2-4. Three concurrent perspective searches (with Search Grounding)
 * 5. Synthesis call (consensus, spin, stripped truth)
 *
 * Uses the @google/genai SDK with Google Search Grounding.
 */

import { GoogleGenAI } from '@google/genai';
import {
  SYSTEM_CONTEXT,
  buildStoryValidationPrompt,
  buildPerspectivePrompt,
  buildSynthesisPrompt,
} from './prompts';
import type {
  Perspective,
  PerspectiveLabel,
  PerspectiveRawResponse,
  ValidationRawResponse,
  SynthesisRawResponse,
  TriangulationResult,
  Source,
} from './types';
import { GeminiServiceError } from './types';

/* ──────────────────────────────────────────────────────────────────────
 * Constants
 * ────────────────────────────────────────────────────────────────────── */

const MODEL_ID = 'gemini-2.0-flash';
const PERSPECTIVE_LABELS: PerspectiveLabel[] = [
  'progressive',
  'conservative',
  'international',
];

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
 * Manages the four-call triangulation flow with proper error handling.
 */
export class GeminiService {
  private readonly client: GoogleGenAI;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        'GEMINI_API_KEY environment variable is required. See docs/ENV_SETUP.md.'
      );
    }
    this.client = new GoogleGenAI({ apiKey });
  }

  /**
   * Validates that the user's input is a news story or claim.
   * This is a fast-fail check before making expensive Search Grounding calls.
   */
  private async validateStory(query: string): Promise<void> {
    try {
      const response = await this.client.models.generateContent({
        model: MODEL_ID,
        contents: buildStoryValidationPrompt(query),
        config: {
          systemInstruction: SYSTEM_CONTEXT,
        },
      });

      const text = response.text ?? '';
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
      throw new GeminiServiceError(
        'Failed to validate the story input',
        'validation',
        error
      );
    }
  }

  /**
   * Fetches coverage for a single perspective using Search Grounding.
   * Returns a complete Perspective object with sources extracted from
   * grounding metadata.
   */
  private async fetchPerspective(
    query: string,
    label: PerspectiveLabel
  ): Promise<Perspective> {
    try {
      const response = await this.client.models.generateContent({
        model: MODEL_ID,
        contents: buildPerspectivePrompt(query, label),
        config: {
          systemInstruction: SYSTEM_CONTEXT,
          tools: [{ googleSearch: {} }],
        },
      });

      const text = response.text ?? '';
      const parsed = parseGeminiJson<PerspectiveRawResponse>(
        text,
        `${label} perspective`
      );

      if (!validatePerspectiveResponse(parsed)) {
        throw new GeminiServiceError(
          `Malformed ${label} perspective response — missing required fields`,
          'perspective'
        );
      }

      // Extract real sources from grounding metadata
      const candidates = (
        response as unknown as {
          candidates?: Record<string, unknown>[];
        }
      ).candidates ?? [];
      const sources = extractSourcesFromGrounding(candidates);

      return {
        label,
        sources,
        summary: parsed.summary,
        uniqueClaims: parsed.uniqueClaims,
        tone: parsed.tone,
      };
    } catch (error) {
      if (error instanceof GeminiServiceError) throw error;
      throw new GeminiServiceError(
        `Failed to fetch ${label} perspective`,
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
      const response = await this.client.models.generateContent({
        model: MODEL_ID,
        contents: buildSynthesisPrompt(perspectives),
        config: {
          systemInstruction: SYSTEM_CONTEXT,
        },
      });

      const text = response.text ?? '';
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
   * Orchestrates the full four-call triangulation flow.
   *
   * 1. Validates the story input
   * 2. Fetches three perspectives concurrently via Promise.all
   * 3. Synthesizes consensus, spin, and stripped truth
   * 4. Returns the complete TriangulationResult
   */
  async triangulate(query: string): Promise<TriangulationResult> {
    // Step 1: Validate the input
    await this.validateStory(query);

    // Step 2: Fetch all three perspectives concurrently
    const perspectives = (await Promise.all(
      PERSPECTIVE_LABELS.map((label) =>
        this.fetchPerspective(query, label)
      )
    )) as [Perspective, Perspective, Perspective];

    // Step 3: Synthesize the perspectives
    const synthesis = await this.synthesize(perspectives);

    // Step 4: Assemble the final result
    return {
      perspectives,
      consensusFacts: synthesis.consensusFacts,
      spinIndicators: synthesis.spinIndicators,
      strippedTruth: synthesis.strippedTruth,
      storyQuery: query,
      processedAt: new Date().toISOString(),
    };
  }
}
