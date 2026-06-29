# Architecture

## Overview

News Triangulator is a Next.js 14 web application that pairs **Tavily** (live news search) with **Groq** (`llama-3.3-70b-versatile`, fast LLM synthesis) to fetch and compare how ideologically distinct news outlets covered the same story. It extracts what all sources agree on (consensus facts), what each source uniquely emphasizes (spin layer), and presents a "stripped truth" view of the story beneath all editorial framing. Both services run on free tiers — no Google Cloud, no billing.

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
│  • Delegates to TriangulatorService                     │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│        TRIANGULATOR SERVICE (src/lib/triangulator.ts)    │
│                                                          │
│  1. searchAllPerspectives(query)  — src/lib/search.ts    │
│     ├── Progressive  ─┐                                 │
│     ├── Conservative  ├── 3 Tavily searches (parallel), │
│     └── International ─┘   each restricted to that lens's │
│                            outlet list (include_domains) │
│                                                          │
│  2. groqJsonCompletion(...)       — src/lib/groq.ts      │
│     One LLM call (JSON mode) → 3 structured lenses +     │
│     consensus + spin + stripped truth                   │
│                                                          │
│  • Search + LLM both retry transient 5xx/429 w/ backoff │
└───────────────┬─────────────────────────┬───────────────┘
                │                         │
                ▼                         ▼
┌───────────────────────────┐ ┌───────────────────────────┐
│  TAVILY SEARCH API         │ │  GROQ API (OpenAI-compat)  │
│  • POST /search per lens   │ │  • llama-3.3-70b-versatile │
│  • topic: news             │ │  • response_format:        │
│  • include_domains per lens│ │      json_object           │
│  • returns title/url/text  │ │  • no web access           │
│  • Auth: TAVILY_API_KEY    │ │  • Auth: GROQ_API_KEY      │
└───────────────────────────┘ └───────────────────────────┘
```

## Why This Split?

The LLM is the wrong tool for searching the web, and most free LLM APIs can't anyway. So the two concerns are separated:

### Step 1: Search (Tavily, 3 calls)
`searchAllPerspectives` runs three **parallel** Tavily searches — one per lens — each restricted to that lens's outlets via `include_domains` (see `PERSPECTIVE_DOMAINS` in [src/lib/search.ts](../src/lib/search.ts)). This guarantees the "progressive" results come from progressive outlets, etc., which is more accurate than one undifferentiated search. Tavily returns each result's title, URL, and an extracted content excerpt. Real source URLs are captured per lens.

### Step 2: Synthesis (Groq, 1 call)
`groqJsonCompletion` sends the grouped results to Groq in **JSON mode** and gets back a single object containing all three structured lenses (summary, unique claims, tone) plus the synthesis — **consensus facts**, **spin indicators**, and the **stripped truth**. The model is instructed to work only from the supplied results, never its own knowledge.

### Reliability
The Tavily client throws a typed `SearchError` (with HTTP status); the Groq client retries transient `429`/`5xx` with exponential backoff and jitter before throwing a `GroqError`. The service wraps both in `TriangulationError` (with a `phase`), and the API route maps those to clear HTTP responses. Missing/thin fields in the model output are coerced to sensible defaults so a partial response degrades gracefully instead of failing.

## How Search Works (Tavily)

For each lens, `tavilySearch` issues:

```
POST https://api.tavily.com/search
Authorization: Bearer $TAVILY_API_KEY
{ "query": "...", "topic": "news", "search_depth": "basic",
  "max_results": 5, "include_domains": [ ...lens outlets... ], "days": 30 }
```

The response's `results[]` (each `{ title, url, content }`) become the per-lens coverage. Because every result comes from a real article URL, the sources shown in the UI are genuine — never hallucinated. Source lists are de-duplicated across lenses for the overall `consultedSources`, and kept per-lens for each column.

## Authentication

Two server-side API keys, each a simple bearer token:

- `TAVILY_API_KEY` — used by [src/lib/search.ts](../src/lib/search.ts)
- `GROQ_API_KEY` — used by [src/lib/groq.ts](../src/lib/groq.ts)

Set both in `.env.local` for local dev and in Vercel → Project Settings → Environment Variables for production. Get free keys at [app.tavily.com](https://app.tavily.com) and [console.groq.com](https://console.groq.com). See [ENV_SETUP.md](ENV_SETUP.md).

## Data Flow

1. **User Input**: User pastes a news headline/story/claim into the textarea
2. **Client State**: `useTriangulate` hook (`src/hooks/useTriangulate.ts`) transitions through states: `idle` → `validating` → `fetching-perspectives` → `synthesizing` → `complete` (or `error` from any stage)
3. **API Route**: POST `/api/triangulate` validates input, rate-limits, calls `TriangulatorService`
4. **TriangulatorService**: runs the 3 Tavily searches, calls Groq once, parses the JSON, attaches per-lens sources, coerces defaults
5. **Response**: Returns a `TriangulationResult` with three perspectives, consensus facts, spin indicators, and stripped truth
6. **Rendering**: `ResultsPanel` leads with `ConsensusLayer` (the factual core), then `PerspectiveComparison` (a 4-row aligned grid on desktop, tabbed interface on mobile), then the de-duplicated source list and timestamp

## Component Hierarchy

```
layout.tsx (root layout, fonts, dark theme)
└── page.tsx (hero section + main content)
    ├── TriangulatorForm (textarea + quick-fill chips + submit button)
    ├── LoadingSpinner (multi-stage progress: validating → fetching → synthesizing)
    └── ResultsPanel (orchestrates results display)
        ├── ConsensusLayer (factual core — shown first, the payoff)
        │   ├── Consensus facts list (numbered)
        │   └── Stripped truth paragraph
        ├── PerspectiveComparison (how each side framed it)
        │   ├── TriangleDiagram (three-vertex visual anchor)
        │   ├── Desktop (lg+): 4-row aligned comparison grid
        │   │   ├── Row: Sources — SourceChip × N per lens
        │   │   ├── Row: Summary — paragraph per lens
        │   │   ├── Row: Unique angle — claim list per lens
        │   │   └── Row: Spin & framing — spin indicators per lens
        │   └── Mobile (<lg): accessible tabbed interface (one perspective at a time)
        │       └── Same four rows per tab, full keyboard nav (arrow keys, Home, End)
        └── Consulted sources + analysis timestamp
```

**UI primitives** in `src/components/ui/`: `Button`, `Badge`, `LoadingSpinner`, `Card`, `TriangleDiagram`, `VertexMark`.

## Frontend Architecture

- **State Management**: Single `useTriangulate` custom hook manages the entire client-side state machine. No external state libraries — the data flow is unidirectional and simple.
- **Component Pattern**: UI primitives (`Button`, `Badge`, `LoadingSpinner`, …) live in `src/components/ui/`; feature components in `src/components/`.
- **Styling**: Tailwind CSS with custom design tokens in `tailwind.config.ts`. Dark navy background, three perspective accent colors.
- **TypeScript**: Strict mode. All component props have explicit interfaces. Zero `any` types.

## Backend Architecture

- **API Route**: Single POST endpoint at `/api/triangulate`. Handles validation, rate limiting, and error responses.
- **TriangulatorService** ([src/lib/triangulator.ts](../src/lib/triangulator.ts)): stateless orchestrator. Calls the search and Groq clients, parses/repairs the JSON, and assembles the `TriangulationResult`.
- **search.ts / groq.ts**: thin, dependency-free `fetch` clients for Tavily and Groq (no SDK packages). Groq retries transient errors internally.
- **Prompts**: defined as exportable functions in `src/lib/prompts.ts` — the single source of truth; changing AI behavior never requires touching service code.
- **Error Handling**: Custom `TriangulationError` (with `phase`: `search` | `synthesis` | `parsing` | `config`) preserves context. The API route maps upstream `429` → `QUOTA_EXCEEDED` (rate-limit), `5xx` → `503` "try again", search-with-no-results → `502`, and missing keys → a `config` 500.
