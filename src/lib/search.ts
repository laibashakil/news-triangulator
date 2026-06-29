/**
 * Live news search via the Tavily API (free tier, LLM-optimized).
 *
 * Runs one domain-targeted news search per ideological lens so each
 * perspective reflects coverage from outlets that actually lean that way —
 * more accurate triangulation than a single undifferentiated search.
 *
 * Get a free key at https://app.tavily.com and set TAVILY_API_KEY.
 */

import type { PerspectiveLabel, Source } from './types';

const TAVILY_ENDPOINT = 'https://api.tavily.com/search';
const MAX_RESULTS_PER_LENS = 5;
const RECENCY_DAYS = 30;

const PERSPECTIVE_LABELS: PerspectiveLabel[] = [
  'progressive',
  'conservative',
  'international',
];

/** Outlets searched for each lens (Tavily `include_domains`). */
const PERSPECTIVE_DOMAINS: Record<PerspectiveLabel, string[]> = {
  progressive: [
    'theguardian.com',
    'msnbc.com',
    'huffpost.com',
    'nytimes.com',
    'vox.com',
    'washingtonpost.com',
    'motherjones.com',
    'newrepublic.com',
  ],
  conservative: [
    'foxnews.com',
    'dailywire.com',
    'nationalreview.com',
    'wsj.com',
    'nypost.com',
    'thefederalist.com',
    'washingtonexaminer.com',
    'breitbart.com',
  ],
  international: [
    'bbc.com',
    'aljazeera.com',
    'reuters.com',
    'dw.com',
    'economist.com',
    'france24.com',
    'scmp.com',
    'dawn.com',
    'apnews.com',
  ],
};

export interface SearchResultItem {
  title: string;
  url: string;
  /** Tavily's extracted snippet/content for the result. */
  content: string;
}

export interface PerspectiveSearch {
  label: PerspectiveLabel;
  results: SearchResultItem[];
}

export class SearchError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'SearchError';
  }
}

/** One Tavily search restricted to a lens's outlets. */
async function tavilySearch(
  apiKey: string,
  query: string,
  domains: string[]
): Promise<SearchResultItem[]> {
  let response: Response;
  try {
    response = await fetch(TAVILY_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        topic: 'news',
        search_depth: 'basic',
        max_results: MAX_RESULTS_PER_LENS,
        include_domains: domains,
        days: RECENCY_DAYS,
      }),
    });
  } catch (error) {
    throw new SearchError('Failed to reach the Tavily search API', undefined, error);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new SearchError(
      `Tavily search failed (${response.status}): ${body.slice(0, 200)}`,
      response.status
    );
  }

  const data = (await response.json().catch(() => ({}))) as {
    results?: Array<{ title?: string; url?: string; content?: string }>;
  };

  return (data.results ?? [])
    .filter((r): r is { url: string; title?: string; content?: string } =>
      typeof r.url === 'string' && r.url.length > 0
    )
    .map((r) => ({
      title: r.title?.trim() || r.url,
      url: r.url,
      content: r.content?.trim() ?? '',
    }));
}

/**
 * Searches all three lenses in parallel and returns the per-lens results plus
 * a de-duplicated flat list of every source consulted.
 */
export async function searchAllPerspectives(query: string): Promise<{
  perspectives: PerspectiveSearch[];
  sources: Source[];
}> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new SearchError(
      'TAVILY_API_KEY is not set. Create a free key at https://app.tavily.com ' +
        'and add it to your environment (.env.local locally, or Vercel settings).'
    );
  }

  const perspectives = await Promise.all(
    PERSPECTIVE_LABELS.map(async (label) => ({
      label,
      results: await tavilySearch(apiKey, query, PERSPECTIVE_DOMAINS[label]),
    }))
  );

  const totalResults = perspectives.reduce((n, p) => n + p.results.length, 0);
  if (totalResults === 0) {
    throw new SearchError(
      'No news coverage was found for this story across the tracked outlets.'
    );
  }

  const seen = new Set<string>();
  const sources: Source[] = [];
  for (const p of perspectives) {
    for (const r of p.results) {
      if (!seen.has(r.url)) {
        seen.add(r.url);
        sources.push({ name: r.title, url: r.url });
      }
    }
  }

  return { perspectives, sources };
}
