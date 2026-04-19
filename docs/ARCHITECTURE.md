# Architecture

## Overview

News Triangulator is a Next.js 14 web application that uses **Gemini 2.5 Flash** on **Vertex AI** with **Google Search Grounding** to fetch and compare how ideologically distinct news sources covered the same story. It extracts what all sources agree on (consensus facts), what each source uniquely emphasizes (spin layer), and presents a "stripped truth" view of the story beneath all editorial framing.

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
│  1. Fetch all three perspectives in ONE grounded call   │
│     ├── Progressive  ─┐                                 │
│     ├── Conservative  ├── Google Search Grounding       │
│     └── International ─┘   (single generate_content)    │
│  2. Synthesize: extract consensus, spin, stripped truth  │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│      VERTEX AI / GEMINI (gemini-2.5-flash)                │
│                                                          │
│  • SDK: @google/genai (GoogleGenAI, vertexai: true)     │
│  • Auth: Application Default Credentials (ADC)          │
│  • tools: [{ googleSearch: {} }]                        │
│  • Returns: text + groundingMetadata                    │
│    ├── groundingChunks (source URLs + titles)           │
│    └── groundingSupports (citation mappings)            │
└─────────────────────────────────────────────────────────┘
```

## Why the Two-Call Pattern?

The application makes **two sequential** Gemini calls per request (plus an optional third for validation):

### Call 0: Story Validation (opt-in)
Disabled by default. Set `GEMINI_STORY_VALIDATION=true` to enable a lightweight pre-flight check that the input is an actual news story or claim, not gibberish. This prevents wasting the grounded search call on invalid input. This call does **not** use Search Grounding.

### Call 1: Combined Perspective Fetch (Google Search Grounded)
A single `generateContent` call instructs Gemini to research the story through three lenses — progressive, conservative, and international — and return all three perspectives in one JSON response. Google Search Grounding (`tools: [{ googleSearch: {} }]`) lets Gemini run live searches during this call.

**Why one call instead of three parallel ones?** Vertex AI's grounded search endpoint is counted per `generate_content` request toward daily quota. Bundling three lenses into one grounded call uses one-third the quota while still producing differentiated perspectives (the prompt enumerates each lens explicitly with its own output slot). The latency cost is modest because the heavy work — Google Search + page fetching — still parallelizes internally.

### Call 2: Synthesis
Takes the three perspective summaries from Call 1 and asks Gemini to:
1. Extract **consensus facts** — things all three perspectives agree on
2. Identify **spin indicators** — what each perspective uniquely emphasized or framed
3. Write the **stripped truth** — a factual skeleton of the story with all editorial framing removed

This call does NOT use Search Grounding because it operates purely on the already-gathered data.

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

The service authenticates to Vertex AI using **Application Default Credentials (ADC)**:

- **Local dev**: `gcloud auth application-default login` stores credentials in your user config
- **Cloud Run**: the service's runtime service account is used automatically — grant it `roles/aiplatform.user` on the project
- **No API keys** are read by the service

The project ID (`news-triangulator`) and location (`us-central1`) are hardcoded in [src/lib/gemini.ts](src/lib/gemini.ts). Change those constants if deploying to another project or region.

## Data Flow

1. **User Input**: User pastes a news headline/story/claim into the textarea
2. **Client State**: `useTriangulate` hook transitions through states: `idle` → `validating` → `fetching-perspectives` → `synthesizing` → `complete`
3. **API Route**: POST `/api/triangulate` validates input, rate-limits, calls `GeminiService`
4. **GeminiService**: Orchestrates the two-call flow (plus optional validation), parses JSON responses, extracts grounding sources
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
- **GeminiService**: Stateless service class instantiated per request. Uses the `@google/genai` SDK in Vertex AI mode (`new GoogleGenAI({ vertexai: true, project, location })`).
- **Prompts**: All prompts are defined as exportable constant functions in `src/lib/prompts.ts`. This is the single source of truth — changing AI behavior never requires touching service code.
- **Error Handling**: Custom `GeminiServiceError` class preserves original error context. API route catches and returns appropriate HTTP status codes; upstream 429s from Vertex are surfaced as `GEMINI_QUOTA_EXCEEDED`.
