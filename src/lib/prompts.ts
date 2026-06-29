/**
 * Gemini prompt definitions for News Triangulator.
 *
 * This file is the SINGLE SOURCE OF TRUTH for all AI instructions.
 * Changing prompts should never require touching service code.
 *
 * See docs/GEMINI_PROMPTS.md for the reasoning behind each prompt.
 */

import type { PerspectiveLabel } from './types';

/* ──────────────────────────────────────────────────────────────────────
 * System Context
 * ────────────────────────────────────────────────────────────────────── */

/**
 * Role context provided to Gemini across all calls.
 * Sets the model's identity as a neutral media analyst.
 */
export const SYSTEM_CONTEXT = `You are a senior investigative journalist and media analyst. Your job is to find real news coverage of stories, accurately summarize what different outlets report, identify editorial framing and spin, and extract the factual core that all sources agree on. You never fabricate sources. You only cite outlets you actually found through search. You are politically neutral — you identify bias in all directions without taking sides.`;

/* ──────────────────────────────────────────────────────────────────────
 * Perspective Guidance
 * ────────────────────────────────────────────────────────────────────── */

/** Maps each perspective label to its search guidance for Gemini */
const PERSPECTIVE_GUIDANCE: Record<PerspectiveLabel, string> = {
  progressive: `Focus on coverage from progressive-leaning, left-of-center, or liberal outlets. These might include outlets like The Guardian, MSNBC, HuffPost, The New York Times opinion pages, Vox, The Washington Post, Mother Jones, or similar publications known for progressive editorial perspectives.`,

  conservative: `Focus on coverage from conservative-leaning, right-of-center outlets. These might include outlets like Fox News, The Daily Wire, National Review, The Wall Street Journal opinion pages, New York Post, The Federalist, or similar publications known for conservative editorial perspectives.`,

  international: `Focus on coverage from international and non-US outlets to provide a global perspective. These might include outlets like BBC, Al Jazeera, Reuters, Deutsche Welle, The Economist, France 24, South China Morning Post, Dawn, or similar publications that cover the story from outside the American political framework.`,
};

/** Human-readable descriptions for each perspective */
const PERSPECTIVE_DESCRIPTIONS: Record<PerspectiveLabel, string> = {
  progressive: 'progressive-leaning and left-of-center',
  conservative: 'conservative-leaning and right-of-center',
  international: 'international and non-US',
};

/* ──────────────────────────────────────────────────────────────────────
 * Prompt Builders
 * ────────────────────────────────────────────────────────────────────── */

/**
 * Builds the story validation prompt (Call 0).
 * Quickly checks whether the input is actually a news story or claim.
 */
export function buildStoryValidationPrompt(query: string): string {
  return `Determine whether the following text is a news story, headline, or factual claim that could be researched through news sources. It does NOT need to be a real story — it just needs to be the kind of thing news outlets would cover.

Text: "${query}"

Respond with ONLY a JSON object, no markdown fencing, no preamble:
{
  "isValidNewsQuery": true or false,
  "reason": "Brief explanation of why this is or isn't a news query"
}`;
}

/**
 * Builds the perspective search prompt (Calls 1-3).
 * Instructs Gemini to search for and summarize coverage from a specific
 * ideological orientation. Search Grounding must be enabled for this call.
 */
export function buildPerspectivePrompt(
  query: string,
  perspective: PerspectiveLabel
): string {
  const description = PERSPECTIVE_DESCRIPTIONS[perspective];
  const guidance = PERSPECTIVE_GUIDANCE[perspective];

  return `Search for recent news coverage of the following story from ${description} sources.

Story: "${query}"

${guidance}

Based on what you find, return ONLY a JSON object with no markdown fencing, no preamble:
{
  "summary": "A 2-3 paragraph summary of how these sources covered this story",
  "uniqueClaims": ["Claim or framing point that this perspective uniquely emphasized"],
  "tone": "A single word describing the overall tone (e.g., alarmed, measured, dismissive, celebratory, cautious, critical)"
}

Important:
- Only summarize what the sources actually say. Do not inject your own analysis.
- The uniqueClaims should be things THIS perspective emphasizes that others might not.
- Include 3-5 unique claims.
- The tone should be a single descriptive word.`;
}

/**
 * Builds one grounded prompt that retrieves progressive, conservative, and
 * international coverage together (single Search Grounding round-trip).
 */
export function buildAllPerspectivesPrompt(query: string): string {
  return `Use Google Search to find recent news coverage of the following story. In one research pass, examine how the story is covered through THREE distinct lenses — you must address all three.

Story: "${query}"

LENS 1 — Progressive-leaning and left-of-center outlets:
${PERSPECTIVE_GUIDANCE.progressive}

LENS 2 — Conservative-leaning and right-of-center outlets:
${PERSPECTIVE_GUIDANCE.conservative}

LENS 3 — International and non-US outlets:
${PERSPECTIVE_GUIDANCE.international}

Return ONLY a JSON object with no markdown fencing, no preamble:
{
  "progressive": {
    "summary": "2-3 paragraphs: how progressive-leaning sources covered this",
    "uniqueClaims": ["3-5 framing points this lens emphasized"],
    "tone": "single descriptive word"
  },
  "conservative": {
    "summary": "2-3 paragraphs: how conservative-leaning sources covered this",
    "uniqueClaims": ["3-5 framing points this lens emphasized"],
    "tone": "single descriptive word"
  },
  "international": {
    "summary": "2-3 paragraphs: how international sources covered this",
    "uniqueClaims": ["3-5 framing points this lens emphasized"],
    "tone": "single descriptive word"
  }
}

Rules:
- Only summarize what you actually found in search results. Do not invent outlets or quotes.
- Each lens must reflect that ideological or geographic slice of coverage, not generic commentary.
- uniqueClaims should highlight what THAT lens uniquely stresses compared to the others.`;
}

/**
 * Builds the combined analysis prompt (Call 2).
 *
 * Takes the raw grounded research text from the search call and, in a single
 * schema-constrained pass (no search tool), produces BOTH the three structured
 * lenses AND the synthesis (consensus, spin, stripped truth). Folding the old
 * "structure" and "synthesis" calls into one halves the per-analysis request
 * count — important on the Gemini free-tier daily quota.
 */
export function buildAnalysisPrompt(researchText: string): string {
  return `Below are research notes on how a news story was covered across three ideological lenses (progressive, conservative, international). Work ONLY from these notes — do not add new facts, outlets, or claims. If a lens is thin, summarize what little is there rather than inventing detail.

Produce two things:

1. For each lens (progressive, conservative, international):
   - summary: 2-3 paragraphs on how that lens covered the story
   - uniqueClaims: 3-5 short framing points that lens emphasized (include what exists if fewer)
   - tone: a single descriptive word (e.g., alarmed, measured, dismissive, critical)

2. A cross-lens synthesis:
   - consensusFacts: 4-8 factual statements that genuinely appear across all three lenses
   - spinIndicators: for each lens, what it uniquely emphasized or spun (framing choices, NOT factual errors)
   - strippedTruth: a 2-3 paragraph factual summary stripped of all editorial framing, written like a neutral wire-service report — just verified facts, actions taken, and documented consequences. No judgment-implying adjectives, no framing that favors any side.

RESEARCH NOTES:
${researchText}`;
}
