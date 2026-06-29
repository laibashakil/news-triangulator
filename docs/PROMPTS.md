# Prompts Documentation

This file documents the prompts sent to the LLM, the reasoning behind their structure, and how the pipeline chains together. **This is the single source of truth for all AI instructions.** Prompt changes should be made in [src/lib/prompts.ts](../src/lib/prompts.ts) — never in the service code.

The LLM (Groq, `llama-3.3-70b-versatile`) **does not search the web**. Live coverage is gathered by the Tavily search API ([src/lib/search.ts](../src/lib/search.ts)); the LLM only analyzes those results. Prompts therefore instruct the model to work strictly from supplied search results.

---

## SYSTEM_CONTEXT

**Purpose**: Sets the model's role identity. Passed as the `system` message on the synthesis call.

```
You are a senior investigative journalist and media analyst. You are given real
news search results from outlets across the political spectrum. Your job is to
accurately summarize what each group of outlets reported, identify editorial
framing and spin, and extract the factual core that all sources agree on. You
work ONLY from the supplied search results — never invent sources, quotes, or
facts not present in them. You are politically neutral: you identify bias in all
directions without taking sides. You always respond with valid JSON only.
```

**Why this framing?**
- "Senior investigative journalist / media analyst" primes analytical, evidence-based output.
- "Work ONLY from the supplied search results" is critical — it stops the model from filling gaps with its training data, keeping the output grounded in what Tavily actually found.
- "Politically neutral" prevents defaulting to any ideological lean.
- "Valid JSON only" reinforces the JSON-mode contract (Groq's `response_format: { type: 'json_object' }`).

---

## buildSynthesisPrompt(query, perspectives)

**Purpose**: The single LLM call. Takes the original query plus the per-lens Tavily results and produces **both** the three structured lenses **and** the cross-lens synthesis in one JSON object.

**Parameters**:
- `query`: the user's input text
- `perspectives`: the per-lens search results (`{ label, results: [{ title, url, content }] }[]`) from Tavily

**Shape of the prompt**:
1. States the user's story.
2. Lists the search results grouped by lens (progressive / conservative / international), each with title, URL, and Tavily's extracted excerpt.
3. Requests a single JSON object:

```json
{
  "progressive":  { "summary": "...", "uniqueClaims": ["..."], "tone": "..." },
  "conservative": { "summary": "...", "uniqueClaims": ["..."], "tone": "..." },
  "international":{ "summary": "...", "uniqueClaims": ["..."], "tone": "..." },
  "consensusFacts": ["..."],
  "spinIndicators": {
    "progressive":  ["..."],
    "conservative": ["..."],
    "international":["..."]
  },
  "strippedTruth": "..."
}
```

**Why one combined call?**
- It minimizes cost/latency to a single LLM round trip (the search step already did the I/O-heavy work).
- The model sees all three lenses at once, so the lenses and the synthesis stay consistent with each other.
- Groq's JSON mode guarantees syntactically valid JSON; the service parses it and applies sensible defaults for any thin lens.

**Why supply pre-grouped, domain-targeted results?**
- Each lens is searched against its own outlet list (see `PERSPECTIVE_DOMAINS` in [src/lib/search.ts](../src/lib/search.ts)), so the "progressive" block genuinely contains progressive-outlet coverage, etc. The model classifies framing within already-separated coverage rather than guessing which outlet leans which way.

**Rules baked into the prompt**:
- If a lens has no coverage, say so briefly and set `tone` to `n/a` rather than inventing detail.
- `summary` must reflect only the supplied excerpts.
- `consensusFacts`: only facts supported across the results.
- `spinIndicators`: framing choices, not factual errors.
- `strippedTruth`: neutral, wire-service voice.

---

## Pipeline Flow

```
User Input
    │
    ▼
[Tavily ×3]  searchAllPerspectives(query)         ← live news search, one per lens
    │ → progressive / conservative / international results (title, url, excerpt)
    │ → real source URLs captured per lens
    │
    ▼
[Groq ×1]    buildSynthesisPrompt(query, results) ← JSON mode, no web access
    │ → { 3 lenses, consensusFacts, spinIndicators, strippedTruth }
    │
    ▼
TriangulationResult assembled (sources attached per lens) and returned to client
```

Total LLM calls per request: **1** (plus 3 search API calls).

## JSON Parsing Strategy

Groq returns valid JSON via JSON mode, but the parser in [src/lib/triangulator.ts](../src/lib/triangulator.ts) is defensive as a backstop:

1. `JSON.parse()` on the raw content
2. If that fails, strip markdown code fences and retry
3. If that fails, isolate the outermost `{ … }` and drop trailing commas, then retry
4. If all fail, throw a `TriangulationError` (phase `parsing`)

The service then coerces any missing/empty fields to sensible defaults, so a thin or partial response degrades gracefully instead of failing the request.
