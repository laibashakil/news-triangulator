# Architecture

## Overview

News Triangulator is a Next.js 14 web application that uses **Gemini 2.0 Flash** with **Google Search Grounding** to fetch and compare how ideologically distinct news sources covered the same story. It extracts what all sources agree on (consensus facts), what each source uniquely emphasizes (spin layer), and presents a "stripped truth" view of the story beneath all editorial framing.

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
│  1. Validate story (is this actually a news claim?)     │
│  2. Fetch 3 perspectives concurrently (Promise.all):    │
│     ├── Progressive perspective  ─┐                     │
│     ├── Conservative perspective  ├── Google Search      │
│     └── International perspective ─┘   Grounding enabled │
│  3. Synthesize: extract consensus, spin, stripped truth  │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              GEMINI API (gemini-2.0-flash)                │
│                                                          │
│  • model: gemini-2.0-flash                              │
│  • tools: [{ googleSearch: {} }]                        │
│  • Returns: text + groundingMetadata                    │
│    ├── groundingChunks (source URLs + titles)           │
│    └── groundingSupports (citation mappings)            │
└─────────────────────────────────────────────────────────┘
```

## Why the Four-Call Pattern?

The application makes **four sequential groups** of Gemini API calls:

### Call 0: Story Validation (optional fast-path)
A lightweight call to verify the input is an actual news story or claim, not gibberish or a random question. This prevents wasting three Search Grounding calls (which cost more) on invalid input.

### Calls 1-3: Perspective Fetches (concurrent via Promise.all)
Three parallel calls, one for each ideological orientation:
- **Progressive**: Instructs Gemini to search for and summarize coverage from progressive-leaning outlets
- **Conservative**: Same, but seeking conservative-leaning outlets
- **International**: Same, but seeking international/non-US outlets for a global perspective

**Why parallel?** Each call involves a live Google Search, which takes 2-5 seconds. Running them sequentially would mean 6-15 seconds of wait time. Running them concurrently with `Promise.all` means the total wait is the duration of the slowest single call — typically 3-6 seconds.

**Why not one call?** A single prompt asking for all three perspectives would force Gemini to do everything in one shot, leading to:
- Less focused searching (the search queries would be too broad)
- Weaker perspective separation (the model would blend viewpoints)
- Longer response times (one massive generation vs three focused ones)
- No granularity in error handling (if one perspective fails, you lose everything)

### Call 4: Synthesis
Takes the three perspective summaries and asks Gemini to:
1. Extract **consensus facts** — things all three perspectives agree on
2. Identify **spin indicators** — what each perspective uniquely emphasized or framed
3. Write the **stripped truth** — a factual skeleton of the story with all editorial framing removed

This call does NOT use Search Grounding because it operates purely on the already-gathered data.

## How Search Grounding Works

When `tools: [{ googleSearch: {} }]` is passed to Gemini:

1. Gemini analyzes the prompt and generates one or more Google Search queries
2. It executes those queries against live Google Search results
3. It processes the returned web pages and synthesizes the information
4. The response includes both the generated text AND `groundingMetadata`:
   - `groundingChunks`: Array of source objects with `web.uri` and `web.title`
   - `groundingSupports`: Maps specific text segments to source indices
   - `webSearchQueries`: The actual search queries Gemini generated

We extract the source names and URLs from `groundingChunks` to populate the `sources` field in each `Perspective` object. This means the sources shown in the UI are **real outlets that Gemini actually found and cited**, not hallucinated source names.

## Data Flow

1. **User Input**: User pastes a news headline/story/claim into the textarea
2. **Client State**: `useTriangulate` hook transitions through states: `idle` → `validating` → `fetching-perspectives` → `synthesizing` → `complete`
3. **API Route**: POST `/api/triangulate` validates input, rate-limits, calls `GeminiService`
4. **GeminiService**: Orchestrates the four-call flow, parses JSON responses, extracts grounding sources
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
- **GeminiService**: Stateless service class instantiated per request. Uses the `@google/genai` SDK.
- **Prompts**: All prompts are defined as exportable constant functions in `src/lib/prompts.ts`. This is the single source of truth — changing AI behavior never requires touching service code.
- **Error Handling**: Custom `GeminiServiceError` class preserves original error context. API route catches and returns appropriate HTTP status codes.
