/**
 * Triangulation service.
 *
 * Orchestrates the free, search-grounded flow:
 *   1. Tavily runs one domain-targeted news search per ideological lens.
 *   2. Groq (Llama) synthesizes those results into three structured lenses
 *      plus the consensus / spin / stripped-truth synthesis (JSON mode).
 *
 * No paid services and no Google Cloud — just TAVILY_API_KEY + GROQ_API_KEY.
 */

import { searchAllPerspectives, SearchError } from './search';
import type { PerspectiveSearch } from './search';
import { groqJsonCompletion, GroqError } from './groq';
import { SYSTEM_CONTEXT, buildSynthesisPrompt } from './prompts';
import type {
  Perspective,
  PerspectiveLabel,
  PerspectiveRawResponse,
  FullAnalysisRawResponse,
  TriangulationResult,
  Source,
} from './types';
import { TriangulationError } from './types';

const PERSPECTIVE_LABELS: PerspectiveLabel[] = [
  'progressive',
  'conservative',
  'international',
];

/* ──────────────────────────────────────────────────────────────────────
 * JSON parsing
 * ────────────────────────────────────────────────────────────────────── */

/** Parses the model's JSON, tolerating markdown fences and stray prose. */
function parseJson<T>(raw: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    // fall through
  }

  const stripped = raw
    .replace(/^```(?:json)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim();
  try {
    return JSON.parse(stripped) as T;
  } catch {
    // fall through
  }

  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start !== -1 && end > start) {
    const candidate = stripped.slice(start, end + 1).replace(/,(\s*[}\]])/g, '$1');
    try {
      return JSON.parse(candidate) as T;
    } catch {
      // fall through
    }
  }

  throw new TriangulationError(
    `Failed to parse model JSON. Raw: ${raw.slice(0, 200)}`,
    'parsing'
  );
}

/* ──────────────────────────────────────────────────────────────────────
 * Service
 * ────────────────────────────────────────────────────────────────────── */

export class TriangulatorService {
  /**
   * Runs the full triangulation: live search per lens, then one synthesis call.
   */
  async triangulate(query: string): Promise<TriangulationResult> {
    // Step 1 — live search across the three lenses.
    let searches: PerspectiveSearch[];
    let consultedSources: Source[];
    try {
      const out = await searchAllPerspectives(query);
      searches = out.perspectives;
      consultedSources = out.sources;
    } catch (error) {
      if (error instanceof SearchError) {
        throw new TriangulationError(error.message, 'search', error);
      }
      throw new TriangulationError('News search failed', 'search', error);
    }

    // Step 2 — synthesize the results into the structured analysis.
    let parsed: FullAnalysisRawResponse;
    try {
      const raw = await groqJsonCompletion(
        SYSTEM_CONTEXT,
        buildSynthesisPrompt(query, searches)
      );
      parsed = parseJson<FullAnalysisRawResponse>(raw);
    } catch (error) {
      if (error instanceof TriangulationError) throw error;
      if (error instanceof GroqError) {
        throw new TriangulationError(error.message, 'synthesis', error);
      }
      throw new TriangulationError('Synthesis failed', 'synthesis', error);
    }

    // The model flags when the search results don't actually match the query
    // (e.g. gibberish input that only surfaced unrelated recent headlines).
    if (parsed.relevant === false) {
      throw new TriangulationError(
        'No news coverage matching that query was found. Try a specific headline, story, or claim.',
        'search'
      );
    }

    // Map per-lens search results to their sources so each column links out.
    const sourcesByLabel = new Map<PerspectiveLabel, Source[]>();
    for (const s of searches) {
      sourcesByLabel.set(
        s.label,
        s.results.map((r) => ({ name: r.title, url: r.url }))
      );
    }

    const perspectives: Perspective[] = PERSPECTIVE_LABELS.map((label) => {
      const raw = parsed[label] as PerspectiveRawResponse | undefined;
      const summary =
        raw?.summary?.trim() ||
        'No coverage was found from this perspective for this story.';
      const uniqueClaims =
        Array.isArray(raw?.uniqueClaims) && raw.uniqueClaims.length > 0
          ? raw.uniqueClaims
          : ['No distinctive framing was identified for this perspective.'];
      const tone = raw?.tone?.trim() || 'neutral';
      return {
        label,
        sources: sourcesByLabel.get(label) ?? [],
        summary,
        uniqueClaims,
        tone,
      };
    });

    const consensusFacts =
      Array.isArray(parsed.consensusFacts) && parsed.consensusFacts.length > 0
        ? parsed.consensusFacts
        : ['The sources did not present clearly overlapping factual claims.'];

    const spinIndicators = {
      progressive: parsed.spinIndicators?.progressive ?? [],
      conservative: parsed.spinIndicators?.conservative ?? [],
      international: parsed.spinIndicators?.international ?? [],
    };

    const strippedTruth =
      parsed.strippedTruth?.trim() ||
      'A neutral summary could not be produced from the available coverage.';

    return {
      perspectives: perspectives as [Perspective, Perspective, Perspective],
      ...(consultedSources.length > 0 ? { consultedSources } : {}),
      consensusFacts,
      spinIndicators,
      strippedTruth,
      storyQuery: query,
      processedAt: new Date().toISOString(),
    };
  }
}
