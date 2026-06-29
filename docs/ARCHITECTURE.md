# Architecture

## Overview

News Triangulator is a Next.js 14 web application that uses **Gemini 2.5 Flash-Lite** via the **Gemini Developer API** (key-based auth) with **Google Search Grounding** to fetch and compare how ideologically distinct news sources covered the same story. It extracts what all sources agree on (consensus facts), what each source uniquely emphasizes (spin layer), and presents a "stripped truth" view of the story beneath all editorial framing.

## System Design

```
┌─────────────────────────────────────────────────────────┐
│                     FRONTEND (React)                     │
│                                                          │
│  TriangulatorForm → useTriangulate hook → ResultsPanel  │
│                          │                               │
│                     fetch POST                           │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              API LAYER (Next.js Route Handler)            │
│              POST /api/triangulate                        │
│                                                          │
│  • Input validation (non-empty, ≤2000 chars)            │
│  • Rate limiting (10 req/IP/min, in-memory)             │
│  • Delegates to GeminiService                           │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              GEMINI SERVICE (src/lib/gemini.ts)          │
│                                                          │
│  0. (Optional) Validate story — only when               │
│     GEMINI_STORY_VALIDATION=true                        │
│  1. searchCoverage: ONE grounded call gathers live       │
│     coverage across all three lenses as research text    │
│     ├── Progressive  ─┐                                 │
│     ├── Conservative  ├── Google Search Grounding       │
│     └── International ─┘   (free-form text + sources)   │
│  2. analyzeCoverage: ONE schema-constrained call turns   │
│     the research into the 3 structured lenses AND the    │
│     synthesis (consensus, spin, stripped truth)          │
│                                                          │
│  • All calls retry transient 503/500/429 with backoff   │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│      GEMINI DEVELOPER API (gemini-2.5-flash-lite)         │
│                                                          │
│  • SDK: @google/genai (GoogleGenAI, apiKey)             │
│  • Auth: GEMINI_API_KEY (free tier)                     │
│  • Grounded call: tools: [{ googleSearch: {} }]         │
│  • Analysis call: responseSchema (constrained decoding) │
│  • Grounded response includes groundingMetadata:        │
│    ├── groundingChunks (source URLs + titles)           │
│    └── groundingSupports (citation mappings)            │
└─────────────────────────────────────────────────────────┘
```

## Why the Two-Call Pattern?

The application makes **two sequential** Gemini calls per request (plus an optional third for validation):

### Call 0: Story Validation (opt-in)
Disabled by default. Set `GEMINI_STORY_VALIDATION=true` to enable a lightweight pre-flight check that the input is an actual news story or claim, not gibberish. This prevents wasting the grounded search call on invalid input. This call uses a `responseSchema` and does **not** use Search Grounding.

### Call 1: Grounded Search (`searchCoverage`)
A single `generateContent` call with Google Search Grounding (`tools: [{ googleSearch: {} }]`) instructs Gemini to research the story through three lenses — progressive, conservative, and international — and write up what it finds as free-form research text. Source URLs and titles are extracted from the response's `groundingMetadata`.

**Why free-form here?** Search Grounding cannot be combined with a `responseSchema` (constrained decoding), so the grounded call's output is unstructured prose. Structuring happens in Call 2, which keeps each lens reliable.

### Call 2: Combined Analysis (`analyzeCoverage`)
A single schema-constrained call (no search tool) takes the research text and produces **both** outputs at once:
1. The three structured lenses (summary, unique claims, tone)
2. The synthesis — **consensus facts**, **spin indicators**, and the **stripped truth**

Because it passes a `responseSchema`, Gemini uses constrained decoding and returns complete, syntactically valid JSON every time. Folding the old separate "structure" and "synthesis" calls into one keeps each triangulation to **two requests** against the free-tier daily quota.

### Reliability
Every model call is wrapped in `generateWithRetry`, which retries transient upstream failures (`503` high-demand, `500` internal, `429` rate spikes) with exponential backoff and jitter. Persistent quota exhaustion surfaces to the user as a clear "try again" message.

## How Search Grounding Works

When `tools: [{ googleSearch: {} }]` is passed in the `config` to `ai.models.generateContent`:

1. Gemini analyzes the prompt and generates one or more Google Search queries
2. It executes those queries against live Google Search results
3. It processes the returned web pages and synthesizes the information
4. The response includes both the generated text AND `groundingMetadata` on each candidate:
   - `groundingChunks`: Array of source objects with `web.uri` and `web.title`
   - `groundingSupports`: Maps specific text segments to source indices
   - `webSearchQueries`: The actual search queries Gemini generated

We extract the source names and URLs from `groundingChunks` to populate the `consultedSources` field on the triangulation result. This means the sources shown in the UI are **real outlets that Gemini actually found and cited**, not hallucinated source names.

## Authentication

The service authenticates to the **Gemini Developer API** with a single API key:

- **Key**: read from the `GEMINI_API_KEY` environment variable (`new GoogleGenAI({ apiKey })`)
- **Local dev**: set `GEMINI_API_KEY` in `.env.local`
- **Production (Vercel)**: set `GEMINI_API_KEY` in Project Settings → Environment Variables
- Get a free key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey) — no billing required

The model is set via the `MODEL_ID` constant in [src/lib/gemini.ts](src/lib/gemini.ts) (`gemini-2.5-flash-lite`). See [ENV_SETUP.md](ENV_SETUP.md) for details.

## Data Flow

1. **User Input**: User pastes a news headline/story/claim into the textarea
2. **Client State**: `useTriangulate` hook transitions through states: `idle` → `validating` → `fetching-perspectives` → `synthesizing` → `complete`
3. **API Route**: POST `/api/triangulate` validates input, rate-limits, calls `GeminiService`
4. **GeminiService**: Orchestrates the two-call flow — grounded search then combined analysis (plus optional validation), parses JSON responses, extracts grounding sources
5. **Response**: Returns a `TriangulationResult` with three perspectives, consensus facts, spin indicators, and stripped truth
6. **Rendering**: `ResultsPanel` displays three `PerspectiveColumn` components + `ConsensusLayer`

## Component Hierarchy

```
layout.tsx (root layout, Inter font, dark theme)
└── page.tsx (hero section + main content)
    ├── TriangulatorForm (textarea + submit button)
    ├── LoadingSpinner (multi-stage progress during fetch)
    └── ResultsPanel (orchestrates results display)
        ├── PerspectiveColumn × 3 (progressive, conservative, international)
        │   ├── Badge (tone indicator)
        │   ├── SourceChip × N (clickable source pills)
        │   └── Card (unique claims callout blocks)
        └── ConsensusLayer
            ├── Consensus facts list
            └── Stripped truth paragraph
```

## Frontend Architecture

- **State Management**: Single `useTriangulate` custom hook manages the entire client-side state machine. No external state libraries needed — the data flow is unidirectional and simple.
- **Component Pattern**: All UI primitives (`Button`, `Card`, `Badge`, `LoadingSpinner`) are in `src/components/ui/`. Feature-specific components are in `src/components/`.
- **Styling**: Tailwind CSS with custom design tokens defined in `tailwind.config.ts`. Dark navy background, three perspective accent colors (amber, blue, teal).
- **TypeScript**: Strict mode enabled. All component props have explicit interfaces. Zero `any` types.

## Backend Architecture

- **API Route**: Single POST endpoint at `/api/triangulate`. Handles validation, rate limiting, and error responses.
- **GeminiService**: Stateless service class instantiated per request. Uses the `@google/genai` SDK in Developer API mode (`new GoogleGenAI({ apiKey })`). Non-grounded calls pass a `responseSchema` for guaranteed-valid JSON; all calls go through `generateWithRetry` for transient-error backoff.
- **Prompts**: All prompts are defined as exportable constant functions in `src/lib/prompts.ts`. This is the single source of truth — changing AI behavior never requires touching service code.
- **Error Handling**: Custom `GeminiServiceError` class preserves original error context. API route catches and returns appropriate HTTP status codes; upstream `429`s are surfaced as `GEMINI_QUOTA_EXCEEDED`, and persistent `503`/`500` as a `503` "high demand, try again" message.
