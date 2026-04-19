/**
 * Core type definitions for News Triangulator.
 *
 * Every type in the application is defined here — this is the single
 * source of truth for data shapes. No `any` types anywhere.
 */

/* ──────────────────────────────────────────────────────────────────────
 * Perspective Types
 * ────────────────────────────────────────────────────────────────────── */

/** The three ideological categories used for triangulation */
export type PerspectiveLabel = 'progressive' | 'conservative' | 'international';

/** A news source found via Google Search Grounding */
export interface Source {
  /** Display name of the outlet (e.g., "The Guardian") */
  name: string;
  /** Full URL to the article or outlet */
  url: string;
}

/** A single perspective's coverage summary */
export interface Perspective {
  /** Which ideological orientation this perspective represents */
  label: PerspectiveLabel;
  /** Real sources found and cited by Gemini during search */
  sources: Source[];
  /** 2-3 paragraph summary of how these sources covered the story */
  summary: string;
  /** Claims or framings unique to this perspective (3-5 items) */
  uniqueClaims: string[];
  /** Single-word tonal descriptor assigned by the AI */
  tone: string;
}

/* ──────────────────────────────────────────────────────────────────────
 * Triangulation Result
 * ────────────────────────────────────────────────────────────────────── */

/** Spin indicators keyed by perspective label */
export type SpinIndicators = Record<PerspectiveLabel, string[]>;

/** The complete result of a triangulation analysis */
export interface TriangulationResult {
  /** The three perspective analyses */
  perspectives: [Perspective, Perspective, Perspective];
  /**
   * Outlets and URLs from Search Grounding when one combined search
   * produced all perspectives (otherwise omitted).
   */
  consultedSources?: Source[];
  /** Facts that all three perspectives agree on (4-8 items) */
  consensusFacts: string[];
  /** What each perspective uniquely emphasized or spun */
  spinIndicators: SpinIndicators;
  /** Factual skeleton of the story with all editorial framing removed */
  strippedTruth: string;
  /** Echo of the original user input */
  storyQuery: string;
  /** ISO timestamp of when this analysis was completed */
  processedAt: string;
}

/* ──────────────────────────────────────────────────────────────────────
 * API Request / Response
 * ────────────────────────────────────────────────────────────────────── */

/** Request body for POST /api/triangulate */
export interface TriangulateRequest {
  /** The news story, headline, or claim to triangulate */
  query: string;
}

/** Successful response from POST /api/triangulate */
export interface TriangulateResponse {
  /** Whether the request succeeded */
  success: true;
  /** The triangulation result */
  data: TriangulationResult;
}

/** Error response from POST /api/triangulate */
export interface TriangulateErrorResponse {
  /** Whether the request succeeded */
  success: false;
  /** Human-readable error message */
  error: string;
  /** Machine-readable error code for client-side handling */
  code:
    | 'INVALID_INPUT'
    | 'RATE_LIMITED'
    | 'GEMINI_QUOTA_EXCEEDED'
    | 'SERVICE_ERROR'
    | 'VALIDATION_FAILED';
}

/* ──────────────────────────────────────────────────────────────────────
 * UI State Machine
 * ────────────────────────────────────────────────────────────────────── */

/** The six distinct UI states during a triangulation request */
export type TriangulationState =
  | 'idle'
  | 'validating'
  | 'fetching-perspectives'
  | 'synthesizing'
  | 'complete'
  | 'error';

/** Human-readable labels for each loading state */
export const STATE_LABELS: Record<TriangulationState, string> = {
  idle: 'Ready to analyze',
  validating: 'Validating your story...',
  'fetching-perspectives': 'Searching multiple perspectives...',
  synthesizing: 'Synthesizing the truth layer...',
  complete: 'Analysis complete',
  error: 'Something went wrong',
};

/* ──────────────────────────────────────────────────────────────────────
 * Gemini Response Parsing Types (internal to gemini.ts)
 * ────────────────────────────────────────────────────────────────────── */

/** Raw JSON shape returned by the perspective prompt */
export interface PerspectiveRawResponse {
  summary: string;
  uniqueClaims: string[];
  tone: string;
}

/** Raw JSON from a single grounded call that returns all three lenses */
export type AllPerspectivesRawResponse = Record<
  PerspectiveLabel,
  PerspectiveRawResponse
>;

/** Raw JSON shape returned by the validation prompt */
export interface ValidationRawResponse {
  isValidNewsQuery: boolean;
  reason: string;
}

/** Raw JSON shape returned by the synthesis prompt */
export interface SynthesisRawResponse {
  consensusFacts: string[];
  spinIndicators: SpinIndicators;
  strippedTruth: string;
}

/* ──────────────────────────────────────────────────────────────────────
 * Custom Error
 * ────────────────────────────────────────────────────────────────────── */

/** Custom error class for Gemini service failures */
export class GeminiServiceError extends Error {
  /** The original error that caused this failure */
  public readonly cause: unknown;
  /** Which phase of the pipeline failed */
  public readonly phase: 'validation' | 'perspective' | 'synthesis' | 'parsing';

  constructor(message: string, phase: GeminiServiceError['phase'], cause?: unknown) {
    super(message);
    this.name = 'GeminiServiceError';
    this.phase = phase;
    this.cause = cause;
  }
}
