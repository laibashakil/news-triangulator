/**
 * Prompt definitions for News Triangulator.
 *
 * This file is the SINGLE SOURCE OF TRUTH for all AI instructions.
 * The LLM (Groq) never searches the web itself — it analyzes the news results
 * gathered by Tavily (see search.ts). Prompts therefore work from supplied
 * search results, not from the model's own knowledge or live browsing.
 *
 * See docs/PROMPTS.md for the reasoning behind each prompt.
 */

import type { PerspectiveLabel } from './types';
import type { PerspectiveSearch } from './search';

/* ──────────────────────────────────────────────────────────────────────
 * System Context
 * ────────────────────────────────────────────────────────────────────── */

/** Role context provided to the model on every synthesis call. */
export const SYSTEM_CONTEXT = `You are a senior investigative journalist and media analyst. You are given real news search results from outlets across the political spectrum. Your job is to accurately summarize what each group of outlets reported, identify editorial framing and spin, and extract the factual core that all sources agree on. You work ONLY from the supplied search results — never invent sources, quotes, or facts not present in them. You are politically neutral: you identify bias in all directions without taking sides. You always respond with valid JSON only.`;

/* ──────────────────────────────────────────────────────────────────────
 * Perspective Guidance
 * ────────────────────────────────────────────────────────────────────── */

/** Human-readable descriptions for each perspective. */
const PERSPECTIVE_DESCRIPTIONS: Record<PerspectiveLabel, string> = {
  progressive: 'progressive-leaning / left-of-center US outlets',
  conservative: 'conservative-leaning / right-of-center US outlets',
  international: 'international and non-US outlets',
};

/* ──────────────────────────────────────────────────────────────────────
 * Prompt Builders
 * ────────────────────────────────────────────────────────────────────── */

/** Formats one lens's search results into a readable block for the prompt. */
function formatPerspectiveBlock(perspective: PerspectiveSearch): string {
  const heading = `${perspective.label.toUpperCase()} — ${PERSPECTIVE_DESCRIPTIONS[perspective.label]}`;
  if (perspective.results.length === 0) {
    return `${heading}\n(No coverage found from these outlets.)`;
  }
  const items = perspective.results
    .map(
      (r, i) =>
        `  ${i + 1}. ${r.title}\n     URL: ${r.url}\n     Excerpt: ${r.content || '(no excerpt)'}`
    )
    .join('\n');
  return `${heading}\n${items}`;
}

/**
 * Builds the single synthesis prompt. Takes the original query and the
 * per-lens search results, and asks the model to produce BOTH the three
 * structured lenses AND the cross-lens synthesis in one JSON object.
 */
export function buildSynthesisPrompt(
  query: string,
  perspectives: PerspectiveSearch[]
): string {
  const blocks = perspectives.map(formatPerspectiveBlock).join('\n\n');

  return `A user asked to triangulate this news story:

"${query}"

Below are live news search results grouped by the political lean of the outlets. Work ONLY from these results — do not add facts, outlets, or claims that aren't present.

${blocks}

STEP 1 — Relevance check: Do the search results above actually report on the user's query subject ("${query}")? If the query is gibberish, a keyboard mash, random characters, or not a real news topic, the results will just be unrelated recent headlines that share no subject with the query — in that case the analysis is meaningless, so set "relevant" to false and return empty/placeholder values for the other fields. Only set "relevant" to true when the results genuinely cover the query's subject.

STEP 2 — If relevant, produce the full triangulation.

Return ONLY a JSON object with exactly this shape (no markdown, no preamble):
{
  "relevant": <true or false per Step 1>,
  "progressive":  { "summary": "2-3 paragraphs on how these outlets covered it", "uniqueClaims": ["3-5 framing points this lens emphasized"], "tone": "single descriptive word" },
  "conservative": { "summary": "...", "uniqueClaims": ["..."], "tone": "..." },
  "international":{ "summary": "...", "uniqueClaims": ["..."], "tone": "..." },
  "consensusFacts": ["4-8 factual statements that appear across the lenses"],
  "spinIndicators": {
    "progressive":  ["what this lens uniquely emphasized or spun"],
    "conservative": ["..."],
    "international":["..."]
  },
  "strippedTruth": "A 2-3 paragraph factual summary stripped of all editorial framing, written like a neutral wire-service report — just verified facts, actions taken, and documented consequences. No judgment-implying adjectives, no framing that favors any side."
}

Rules:
- "relevant": set to false ONLY if the search results are clearly about entirely different topics than the user's query (e.g. the query was gibberish, a keyboard mash, or not a researchable news story and the results are unrelated recent headlines). If the results genuinely cover the query's subject, set it to true.
- If a lens has no coverage, give a short summary saying so, an empty-ish uniqueClaims note, and tone "n/a".
- summary must reflect ONLY what the supplied excerpts say for that lens.
- consensusFacts: only facts genuinely supported across the results.
- spinIndicators: framing choices, NOT factual errors.
- strippedTruth: neutral, factual, no editorial voice.`;
}
