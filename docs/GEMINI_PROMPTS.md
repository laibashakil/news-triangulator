# Gemini Prompts Documentation

This file documents every prompt sent to the Gemini API, the reasoning behind each prompt's structure, and how they chain together. **This is the single source of truth for all AI instructions.** Prompt changes should be made in `src/lib/prompts.ts` — never in the service code.

---

## SYSTEM_CONTEXT

**Purpose**: Sets Gemini's role identity across all calls.

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

**Purpose**: Quick check (Call 0) to verify the input is actually a news story or claim.

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
  "isValidNewsQuery": true/false,
  "reason": "Brief explanation of why this is or isn't a news query"
}
```

**Why this prompt?**
- Prevents wasting three expensive Search Grounding calls on gibberish
- The "does NOT need to be a real story" clause prevents false rejections of obscure stories
- Asking for a reason helps with debugging and user-facing error messages
- JSON-only instruction prevents markdown wrapping that would break parsing

**Configuration**:
- Model: `gemini-2.0-flash`
- Search Grounding: **DISABLED** (no live search needed — this is purely analytical)
- Temperature: Low (we want a consistent yes/no, not creative interpretation)

---

## buildPerspectivePrompt(query, perspective)

**Purpose**: Searches for and summarizes news coverage from a specific ideological orientation (Call 1-3).

**Parameters**:
- `query`: The user's input text
- `perspective`: One of `'progressive'`, `'conservative'`, or `'international'`

**Prompt Template**:
```
Search for recent news coverage of the following story from ${perspectiveDescription} sources.

Story: "${query}"

${perspectiveGuidance}

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
- The tone should be a single descriptive word.
```

**Perspective Guidance** (varies by perspective):

For **progressive**:
```
Focus on coverage from progressive-leaning, left-of-center, or liberal outlets.
These might include outlets like The Guardian, MSNBC, HuffPost, The New York Times
opinion pages, Vox, The Washington Post, Mother Jones, or similar publications
known for progressive editorial perspectives.
```

For **conservative**:
```
Focus on coverage from conservative-leaning, right-of-center outlets.
These might include outlets like Fox News, The Daily Wire, National Review,
The Wall Street Journal opinion pages, New York Post, The Federalist,
or similar publications known for conservative editorial perspectives.
```

For **international**:
```
Focus on coverage from international and non-US outlets to provide a global
perspective. These might include outlets like BBC, Al Jazeera, Reuters,
Deutsche Welle, The Economist, France 24, South China Morning Post, Dawn,
or similar publications that cover the story from outside the American
political framework.
```

**Why this prompt structure?**
- Listing example outlets guides Search Grounding toward the right search queries without mandating specific sources
- Saying "these might include" prevents errors when Gemini can't find coverage from those specific outlets
- Requesting `uniqueClaims` as an array makes cross-perspective comparison possible in the synthesis step
- Single-word `tone` creates a clean, displayable badge without subjective paragraphs

**Configuration**:
- Model: `gemini-2.0-flash`
- Search Grounding: **ENABLED** (`tools: [{ googleSearch: {} }]`)
- These three calls run concurrently via `Promise.all`

**Source Extraction**:
Sources are NOT returned by the prompt — they're extracted from the `groundingMetadata.groundingChunks` array in the API response. This is more reliable than asking the model to list sources, because:
1. These are URLs Gemini actually visited during search
2. They include the outlet title as parsed from the page
3. They can't be hallucinated — they're system-level metadata

---

## buildSynthesisPrompt(perspectives)

**Purpose**: Takes the three perspective summaries and extracts consensus, spin, and stripped truth (Call 4).

**Parameters**:
- `perspectives`: Array of 3 `Perspective` objects (with summaries, unique claims, etc.)

**Prompt Template**:
```
You are analyzing three different perspectives on the same news story.
Each perspective comes from a different ideological orientation of media coverage.

PROGRESSIVE PERSPECTIVE:
Summary: ${perspectives[0].summary}
Unique Claims: ${perspectives[0].uniqueClaims.join(', ')}
Tone: ${perspectives[0].tone}

CONSERVATIVE PERSPECTIVE:
Summary: ${perspectives[1].summary}
Unique Claims: ${perspectives[1].uniqueClaims.join(', ')}
Tone: ${perspectives[1].tone}

INTERNATIONAL PERSPECTIVE:
Summary: ${perspectives[2].summary}
Unique Claims: ${perspectives[2].uniqueClaims.join(', ')}
Tone: ${perspectives[2].tone}

Analyze these three perspectives and return ONLY a JSON object with no markdown fencing:
{
  "consensusFacts": [
    "Factual statement that all three perspectives agree on",
    "Another consensus fact"
  ],
  "spinIndicators": {
    "progressive": ["What the progressive coverage uniquely emphasized or spun"],
    "conservative": ["What the conservative coverage uniquely emphasized or spun"],
    "international": ["What the international coverage uniquely emphasized or spun"]
  },
  "strippedTruth": "A 2-3 paragraph factual summary of the story stripped of all editorial framing. Write this as a neutral wire-service report would — just the verified facts, actions taken, and their documented consequences. No adjectives that imply judgment. No framing that favors any side."
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
- Model: `gemini-2.0-flash`
- Search Grounding: **DISABLED** (this call operates on already-gathered data, not live search)
- Temperature: Moderate (we want some natural language flow in the stripped truth)

---

## Prompt Chaining Flow

```
User Input
    │
    ▼
[Call 0] buildStoryValidationPrompt(query)
    │ → validates input is a news query
    │ → if invalid, returns error to user
    │
    ▼
[Call 1-3] buildPerspectivePrompt(query, 'progressive')  ─┐
           buildPerspectivePrompt(query, 'conservative') ──┼── Promise.all
           buildPerspectivePrompt(query, 'international') ─┘
    │ → each returns JSON with summary, uniqueClaims, tone
    │ → sources extracted from groundingMetadata
    │
    ▼
[Call 4] buildSynthesisPrompt([progressive, conservative, international])
    │ → returns consensusFacts, spinIndicators, strippedTruth
    │
    ▼
TriangulationResult object assembled and returned to client
```

## JSON Parsing Strategy

All prompts instruct Gemini to return "ONLY a JSON object with no markdown fencing, no preamble." Despite this, Gemini occasionally wraps responses in ` ```json ... ``` ` blocks. The `GeminiService` class handles this by:

1. Attempting `JSON.parse()` on the raw response text
2. If that fails, stripping markdown code fences and attempting again
3. If that also fails, throwing a `GeminiServiceError` with the raw response for debugging

This defensive parsing is critical — malformed JSON should never reach the UI as a silent failure.
