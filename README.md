# News Triangulator 🔺

> **See the truth beneath the headlines.** Paste any news story and see how progressive, conservative, and international sources covered it differently — then read what all versions actually agree on.

News Triangulator uses **Gemini 2.5 Flash-Lite** with **Google Search Grounding** (via the free **Gemini Developer API**) to perform live searches across ideologically distinct news sources, compare their coverage, and extract the factual core that survives triangulation.

## Live Deployment

| | |
|---|---|
| **Platform** | Vercel (free tier) |
| **AI** | Gemini Developer API free tier (API-key auth) |
| **Env var** | `GEMINI_API_KEY` — set in Vercel → Project Settings → Environment Variables |

To deploy:
1. Push to GitHub.
2. Import the repo at [vercel.com](https://vercel.com) (Next.js is auto-detected).
3. Add `GEMINI_API_KEY` under **Project Settings → Environment Variables** (get a free key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey)).
4. Deploy. Pushes to `main` auto-redeploy.

> **Free-tier note:** each analysis makes **2 Gemini calls** (one grounded search + one combined structure/synthesis). The free Developer API has a daily request cap that varies by model, so heavy traffic can hit rate limits — the app retries transient `503`/`429` errors with backoff and surfaces a clear "try again" message when the daily quota is exhausted.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 14 (App Router) |
| **Language** | TypeScript (strict mode) |
| **Styling** | Tailwind CSS |
| **AI** | Gemini 2.5 Flash-Lite via the `@google/genai` SDK (Developer API mode) |
| **Search** | Google Search Grounding (live web search) |
| **Auth** | `GEMINI_API_KEY` (free Gemini Developer API key) |
| **Deployment** | Vercel |
| **Package Manager** | pnpm |

## Quick Start

### Prerequisites
- Node.js 20+
- pnpm (`npm install -g pnpm`)
- A free **Gemini API key** from [aistudio.google.com/apikey](https://aistudio.google.com/apikey) (no billing required)
- The model is set in [src/lib/gemini.ts](src/lib/gemini.ts) via `MODEL_ID` (`gemini-2.5-flash-lite`); change it there to trade quality for a higher/lower free-tier daily quota

### Setup

```bash
# Clone the repository
git clone https://github.com/your-username/news-triangulator.git
cd news-triangulator

# Install dependencies
pnpm install

# Add your Gemini API key
cp .env.example .env.local
# then edit .env.local and set GEMINI_API_KEY=...

# Start the dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) and paste a news headline.

> The `@google/genai` SDK reads `GEMINI_API_KEY` from the environment. Keep your key in `.env.local` (gitignored) locally and in Vercel's environment variables in production.

## How It Works

1. **You paste a news story, headline, or claim**
2. **One grounded search, three lenses** — a single Gemini call uses Google Search Grounding to gather progressive, conservative, and international coverage in one research pass
3. **AI synthesis** — a second, schema-constrained call structures the three lenses and extracts consensus facts, spin per perspective, and a stripped-truth summary
4. **Visual comparison** — three columns show each perspective's coverage, sources, and unique claims
5. **The truth layer** — the bottom section shows what every source agrees on — the factual skeleton beneath all editorial framing

> An optional third call (story validation) runs first when `GEMINI_STORY_VALIDATION=true` to reject gibberish before spending the grounded search.

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](docs/ARCHITECTURE.md) | System design, data flow, component hierarchy |
| [Gemini Prompts](docs/GEMINI_PROMPTS.md) | Every AI prompt with reasoning |
| [Deployment](docs/DEPLOYMENT.md) | Step-by-step Vercel deployment |
| [Environment Setup](docs/ENV_SETUP.md) | Authentication and environment variables |
| [Known Limitations](docs/KNOWN_LIMITATIONS.md) | Honest assessment of what doesn't work perfectly |

## Project Structure

```
news-triangulator/
├── docs/                    # All documentation
├── src/
│   ├── app/                 # Next.js App Router pages & API routes
│   ├── components/          # React components
│   │   └── ui/              # Reusable UI primitives
│   ├── hooks/               # Custom React hooks
│   └── lib/                 # Core services, types, prompts
├── .env.example             # Environment variable template
├── next.config.js           # Next.js configuration
└── tailwind.config.ts       # Design tokens & theme
```

## License

MIT
