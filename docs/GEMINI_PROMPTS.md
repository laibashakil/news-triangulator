# Gemini Prompts Documentation

This file documents every prompt sent to the Gemini API, the reasoning behind each prompt's structure, and how they chain together. **This is the single source of truth for all AI instructions.** Prompt changes should be made in [src/lib/prompts.ts](../src/lib/prompts.ts) — never in the service code.

All calls run against **Gemini 2.5 Flash-Lite** via the **Gemini Developer API** using the `@google/genai` SDK (`GoogleGenAI` client with `apiKey`). The model is set by the `MODEL_ID` constant in [src/lib/gemini.ts](../src/lib/gemini.ts).

---

## SYSTEM_CONTEXT

**Purpose**: Sets Gemini's role identity across all calls. Passed via `config.systemInstruction` on every `generateContent` request.

```
You are a senior investigative journalist and media analyst. Your job is to
find real news coverage of stories, accurately summarize what different
outlets report, identify editorial framing and spin, and extract the factual
core that all sources agree on. You never fabricate sources. You only cite
outlets you actually found through search. You are politically neutral — you
identify bias in all directions without taking sides.
```

**Why this framing?**
- "Senior investigative journalist" primes the model for analytical, evidence-based output
- "Media analyst" signals that identifying bias is the task, not reporting one perspective
- "Never fabricate sources" reinforces that Search Grounding results should be honestly reported
- "Politically neutral" prevents the model from defaulting to any ideological lean

---

## buildStoryValidationPrompt(query)

**Purpose**: Optional Call 0 that verifies the input is actually a news story or claim. Only runs when `GEMINI_STORY_VALIDATION=true`.

**Parameters**:
- `query`: The user's input text

**Prompt Template**:
```
Determine whether the following text is a news story, headline, or factual
claim that could be researched through news sources. It does NOT need to be
a real story — it just needs to be the kind of thing news outlets would cover.

Text: "${query}"

Respond with ONLY a JSON object, no markdown fencing, no preamble:
{
  "isValidNewsQuery": true or false,
  "reason": "Brief explanation of why this is or isn't a news query"
}
```

**Why this prompt?**
- Prevents wasting the expensive Search Grounding call on gibberish
- The "does NOT need to be a real story" clause prevents false rejections of obscure stories
- Asking for a reason helps with debugging and user-facing error messages
- JSON-only instruction prevents markdown wrapping that would break parsing

**Configuration**:
- Model: `gemini-2.5-flash-lite`
- Search Grounding: **DISABLED** (no live search needed — this is purely analytical)
- `responseMimeType: 'application/json'` + `responseSchema` (constrained decoding guarantees valid JSON)
- `maxOutputTokens: 8192`

---

## buildAllPerspectivesPrompt(query)

**Purpose**: The one grounded research call (`searchCoverage`). Instructs Gemini to research progressive, conservative, and international coverage in a single grounded `generateContent` request. Its output is treated as free-form **research text** that feeds the analysis call — the structuring into clean JSON happens there, not here.

**Parameters**:
- `query`: The user's input text

**Prompt Template**:
```
Use Google Search to find recent news coverage of the following story. In one
research pass, examine how the story is covered through THREE distinct lenses —
you must address all three.

Story: "${query}"

LENS 1 — Progressive-leaning and left-of-center outlets:
Focus on coverage from progressive-leaning, left-of-center, or liberal outlets.
These might include outlets like The Guardian, MSNBC, HuffPost, The New York
Times opinion pages, Vox, The Washington Post, Mother Jones, or similar
publications known for progressive editorial perspectives.

LENS 2 — Conservative-leaning and right-of-center outlets:
Focus on coverage from conservative-leaning, right-of-center outlets.
These might include outlets like Fox News, The Daily Wire, National Review,
The Wall Street Journal opinion pages, New York Post, The Federalist, or
similar publications known for conservative editorial perspectives.

LENS 3 — International and non-US outlets:
Focus on coverage from international and non-US outlets to provide a global
perspective. These might include outlets like BBC, Al Jazeera, Reuters,
Deutsche Welle, The Economist, France 24, South China Morning Post, Dawn, or
similar publications that cover the story from outside the American political
framework.

Return ONLY a JSON object with no markdown fencing, no preamble:
{
  "progressive":  { "summary": "...", "uniqueClaims": [...], "tone": "..." },
  "conservative": { "summary": "...", "uniqueClaims": [...], "tone": "..." },
  "international":{ "summary": "...", "uniqueClaims": [...], "tone": "..." }
}

Rules:
- Only summarize what you actually found in search results. Do not invent outlets or quotes.
- Each lens must reflect that ideological or geographic slice of coverage, not generic commentary.
- uniqueClaims should highlight what THAT lens uniquely stresses compared to the others.
```

**Why one prompt instead of three parallel calls?**
- The Gemini free tier rate-limits per `generate_content` request on a per-day basis. Bundling three lenses into one grounded call uses one-third the request budget of a parallel-fetch design.
- Enumerating each lens explicitly with its own output slot keeps the perspectives differentiated despite the single call.
- Search Grounding can still parallelize the underlying web fetches internally, so wall-clock latency stays reasonable.

**Why list example outlets?**
- Listing example outlets guides Search Grounding toward the right search queries without mandating specific sources
- Saying "these might include" prevents errors when Gemini can't find coverage from those specific outlets
- Requesting `uniqueClaims` per lens makes cross-perspective comparison possible in the synthesis step
- Single-word `tone` creates a clean, displayable badge without subjective paragraphs

**Configuration**:
- Model: `gemini-2.5-flash-lite`
- Search Grounding: **ENABLED** (`tools: [{ googleSearch: {} }]`)
- `maxOutputTokens: 8192`
- Note: no `responseSchema`/`responseMimeType` here — constrained decoding cannot be combined with the `googleSearch` tool. The grounded output is captured as research text and structured in the next call instead.

**Source Extraction**:
Sources are NOT returned by the prompt — they're extracted from the `groundingMetadata.groundingChunks` array on each candidate in the API response and exposed on the result as `consultedSources`. This is more reliable than asking the model to list sources, because:
1. These are URLs Gemini actually visited during search
2. They include the outlet title as parsed from the page
3. They can't be hallucinated — they're system-level metadata

> Note: [src/lib/prompts.ts](../src/lib/prompts.ts) also exports a `buildPerspectivePrompt` helper from an earlier three-call design. It is currently **unused** by `GeminiService`; the active flow uses `buildAllPerspectivesPrompt` instead.

---

## buildAnalysisPrompt(researchText)

**Purpose**: The single post-search call (`analyzeCoverage`). Takes the free-form research text from the grounded call and, in one schema-constrained pass, produces **both** the three structured lenses **and** the synthesis (consensus, spin, stripped truth). This is the final call of the triangulation.

**Parameters**:
- `researchText`: The grounded call's free-form write-up of coverage across the three lenses

**Prompt Template**:
```
Below are research notes on how a news story was covered across three ideological
lenses (progressive, conservative, international). Work ONLY from these notes — do
not add new facts, outlets, or claims. If a lens is thin, summarize what little is
there rather than inventing detail.

Produce two things:

1. For each lens (progressive, conservative, international):
   - summary: 2-3 paragraphs on how that lens covered the story
   - uniqueClaims: 3-5 short framing points that lens emphasized
   - tone: a single descriptive word

2. A cross-lens synthesis:
   - consensusFacts: 4-8 factual statements that appear across all three lenses
   - spinIndicators: for each lens, what it uniquely emphasized or spun
   - strippedTruth: a 2-3 paragraph factual summary stripped of all editorial
     framing, written like a neutral wire-service report

RESEARCH NOTES:
${researchText}
```

**Why fold structuring and synthesis into one call?**
- It halves the per-analysis request count (1 grounded + 1 analysis = **2 total**), which matters against the free-tier daily quota.
- The single call sees the full research at once, so the lenses and the synthesis stay consistent with each other.
- Passing a combined `responseSchema` (the three lens objects plus the synthesis fields) means constrained decoding returns complete, valid JSON every time — no flaky-JSON failures.

**Why this prompt structure?**
- "Work ONLY from these notes" keeps the model from hallucinating beyond what grounding found.
- Separating `consensusFacts` from `spinIndicators` forces the model to distinguish facts from framing.
- The "wire-service report" instruction for `strippedTruth` is more concrete than "be neutral."
- Quantitative guidance (4-8 facts, 2-3 paragraphs) prevents both sparse and overwhelming output.

**Configuration**:
- Model: `gemini-2.5-flash-lite`
- Search Grounding: **DISABLED** (operates on already-gathered research, not live search)
- `responseMimeType: 'application/json'` + combined `responseSchema`
- `maxOutputTokens: 8192`

---

## Prompt Chaining Flow

```
User Input
    │
    ▼
[Call 0 — optional, only if GEMINI_STORY_VALIDATION=true]
    buildStoryValidationPrompt(query)        ← responseSchema, no grounding
    │ → validates input is a news query; if invalid, returns error to user
    │
    ▼
[Call 1] buildAllPerspectivesPrompt(query)   ← Google Search Grounding
    │ → returns free-form research text across the three lenses
    │ → sources extracted from groundingMetadata
    │
    ▼
[Call 2] buildAnalysisPrompt(researchText)   ← combined responseSchema, no grounding
    │ → returns { progressive, conservative, international,
    │            consensusFacts, spinIndicators, strippedTruth }
    │
    ▼
TriangulationResult object assembled and returned to client
```

Total Gemini calls per request: **2** (or **3** with validation enabled). Every call is wrapped in `generateWithRetry` for transient `503`/`500`/`429` backoff.

## JSON Parsing Strategy

The non-grounded calls (validation and analysis) pass a `responseSchema`, so Gemini uses **constrained decoding** and returns syntactically valid JSON by construction. The `GeminiService` parser is still defensive as a backstop:

1. Attempt `JSON.parse()` on the raw response text
2. If that fails, strip markdown code fences and retry
3. If that fails, isolate the outermost `{ … }` and strip trailing commas, then retry
4. If all fail, throw a `GeminiServiceError` with the raw response for debugging

Combining constrained decoding with defensive parsing means malformed JSON effectively never reaches the UI as a silent failure.
