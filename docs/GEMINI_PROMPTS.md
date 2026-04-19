# Gemini Prompts Documentation

This file documents every prompt sent to the Gemini API, the reasoning behind each prompt's structure, and how they chain together. **This is the single source of truth for all AI instructions.** Prompt changes should be made in [src/lib/prompts.ts](../src/lib/prompts.ts) — never in the service code.

All calls run against **Gemini 2.5 Flash** on **Vertex AI** via the `@google/genai` SDK (`GoogleGenAI` client with `vertexai: true`).

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
- Model: `gemini-2.5-flash`
- Search Grounding: **DISABLED** (no live search needed — this is purely analytical)
- `responseMimeType: 'application/json'`
- `maxOutputTokens: 8192`

---

## buildAllPerspectivesPrompt(query)

**Purpose**: The one grounded research call. Retrieves progressive, conservative, and international coverage in a single `generateContent` request so the whole triangulation uses exactly one grounded-search round trip against quota.

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
- Vertex AI charges and rate-limits per `generate_content` request, and grounded search calls count toward the stricter grounding quota. Bundling three lenses into one call uses one-third the quota budget of a parallel-fetch design.
- Explicit per-lens output slots in the JSON schema keep the perspectives differentiated despite the single call.
- Search Grounding can still parallelize the underlying web fetches internally, so wall-clock latency stays reasonable.

**Why list example outlets?**
- Listing example outlets guides Search Grounding toward the right search queries without mandating specific sources
- Saying "these might include" prevents errors when Gemini can't find coverage from those specific outlets
- Requesting `uniqueClaims` per lens makes cross-perspective comparison possible in the synthesis step
- Single-word `tone` creates a clean, displayable badge without subjective paragraphs

**Configuration**:
- Model: `gemini-2.5-flash`
- Search Grounding: **ENABLED** (`tools: [{ googleSearch: {} }]`)
- `maxOutputTokens: 8192`
- Note: `responseMimeType: 'application/json'` is not set here because it is not currently supported alongside grounded search; the service parses JSON defensively from the response text instead.

**Source Extraction**:
Sources are NOT returned by the prompt — they're extracted from the `groundingMetadata.groundingChunks` array on each candidate in the API response and exposed on the result as `consultedSources`. This is more reliable than asking the model to list sources, because:
1. These are URLs Gemini actually visited during search
2. They include the outlet title as parsed from the page
3. They can't be hallucinated — they're system-level metadata

> Note: [src/lib/prompts.ts](../src/lib/prompts.ts) also exports a `buildPerspectivePrompt` helper from an earlier three-call design. It is currently **unused** by `GeminiService`; the active flow uses `buildAllPerspectivesPrompt` instead.

---

## buildSynthesisPrompt(perspectives)

**Purpose**: Takes the three perspective summaries from the grounded call and extracts consensus, spin, and stripped truth. This is the final call of the triangulation.

**Parameters**:
- `perspectives`: Array of 3 `Perspective` objects (with summaries, unique claims, tone)

**Prompt Template**:
```
You are analyzing three different perspectives on the same news story.
Each perspective comes from a different ideological orientation of media coverage.

PROGRESSIVE PERSPECTIVE:
Summary: ${perspectives[0].summary}
Unique Claims: ${perspectives[0].uniqueClaims.join('; ')}
Tone: ${perspectives[0].tone}

CONSERVATIVE PERSPECTIVE:
Summary: ${perspectives[1].summary}
Unique Claims: ${perspectives[1].uniqueClaims.join('; ')}
Tone: ${perspectives[1].tone}

INTERNATIONAL PERSPECTIVE:
Summary: ${perspectives[2].summary}
Unique Claims: ${perspectives[2].uniqueClaims.join('; ')}
Tone: ${perspectives[2].tone}

Analyze these three perspectives and return ONLY a JSON object with no markdown fencing, no preamble:
{
  "consensusFacts": [
    "Factual statement that all three perspectives agree on"
  ],
  "spinIndicators": {
    "progressive":  ["What the progressive coverage uniquely emphasized or spun"],
    "conservative": ["What the conservative coverage uniquely emphasized or spun"],
    "international":["What the international coverage uniquely emphasized or spun"]
  },
  "strippedTruth": "A 2-3 paragraph factual summary stripped of all editorial framing..."
}

Rules:
- consensusFacts should contain 4-8 facts that genuinely appear across all three perspectives
- spinIndicators should highlight framing choices, NOT factual errors
- strippedTruth must read like a wire service report: neutral, factual, no editorial voice
```

**Why this prompt structure?**
- Feeding the raw perspective data (not just summaries) gives the synthesis model maximum context
- Separating `consensusFacts` from `spinIndicators` forces the model to distinguish between facts and framing
- The "wire-service report" instruction for `strippedTruth` is more concrete and graspable than "be neutral"
- Quantitative guidance (4-8 facts, 2-3 paragraphs) prevents both sparse and overwhelming output

**Configuration**:
- Model: `gemini-2.5-flash`
- Search Grounding: **DISABLED** (this call operates on already-gathered data, not live search)
- `responseMimeType: 'application/json'`
- `maxOutputTokens: 8192`

---

## Prompt Chaining Flow

```
User Input
    │
    ▼
[Call 0 — optional, only if GEMINI_STORY_VALIDATION=true]
    buildStoryValidationPrompt(query)
    │ → validates input is a news query
    │ → if invalid, returns error to user
    │
    ▼
[Call 1] buildAllPerspectivesPrompt(query)   ← Google Search Grounding
    │ → returns { progressive, conservative, international }
    │ → sources extracted from groundingMetadata
    │
    ▼
[Call 2] buildSynthesisPrompt([progressive, conservative, international])
    │ → returns consensusFacts, spinIndicators, strippedTruth
    │
    ▼
TriangulationResult object assembled and returned to client
```

Total Gemini calls per request: **2** (or **3** with validation enabled).

## JSON Parsing Strategy

All prompts instruct Gemini to return "ONLY a JSON object with no markdown fencing, no preamble." Despite this, Gemini occasionally wraps responses in ` ```json ... ``` ` blocks. The `GeminiService` class handles this by:

1. Attempting `JSON.parse()` on the raw response text
2. If that fails, stripping markdown code fences and attempting again
3. If that also fails, throwing a `GeminiServiceError` with the raw response for debugging

This defensive parsing is critical — malformed JSON should never reach the UI as a silent failure.
