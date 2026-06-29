# News Triangulator 🔺

> **See the truth beneath the headlines.** Paste any news story and see how progressive, conservative, and international sources covered it differently — then read what all versions actually agree on.

News Triangulator pairs **Tavily** (live news search) with **Groq** (fast LLM synthesis) to search ideologically distinct news outlets, compare their coverage, and extract the factual core that survives triangulation — all on free tiers, no billing required.

## Live Deployment

| | |
|---|---|
| **Platform** | Vercel (free tier) |
| **Search** | Tavily API (free tier) |
| **AI** | Groq — `llama-3.3-70b-versatile` (free tier) |
| **Env vars** | `TAVILY_API_KEY`, `GROQ_API_KEY` — set in Vercel → Project Settings → Environment Variables |

To deploy:
1. Push to GitHub.
2. Import the repo at [vercel.com](https://vercel.com) (Next.js is auto-detected).
3. Add `TAVILY_API_KEY` and `GROQ_API_KEY` under **Project Settings → Environment Variables** (free keys: [app.tavily.com](https://app.tavily.com) and [console.groq.com](https://console.groq.com)).
4. Deploy. Pushes to `main` auto-redeploy.

> **Free-tier note:** each analysis makes **3 Tavily searches** (one per lens) + **1 Groq call**. Tavily's free tier (~1,000 searches/month) covers roughly 330 analyses/month; Groq's free tier is generous and fast. Transient `5xx`/`429` responses are retried with backoff.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 14 (App Router) |
| **Language** | TypeScript (strict mode) |
| **Styling** | Tailwind CSS |
| **Search** | Tavily API — domain-targeted news search per lens |
| **AI** | Groq `llama-3.3-70b-versatile` (OpenAI-compatible, JSON mode) |
| **Auth** | `TAVILY_API_KEY` + `GROQ_API_KEY` (both free tier) |
| **Deployment** | Vercel |
| **Package Manager** | pnpm |

## Quick Start

### Prerequisites
- Node.js 20+
- pnpm (`npm install -g pnpm`)
- A free **Tavily API key** from [app.tavily.com](https://app.tavily.com)
- A free **Groq API key** from [console.groq.com](https://console.groq.com)

### Setup

```bash
# Clone the repository
git clone https://github.com/your-username/news-triangulator.git
cd news-triangulator

# Install dependencies
pnpm install

# Add your API keys
cp .env.example .env.local
# then edit .env.local and set TAVILY_API_KEY=... and GROQ_API_KEY=...

# Start the dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) and paste a news headline.

> Keep your keys in `.env.local` (gitignored) locally, and in Vercel's environment variables in production. They are read server-side only.

## How It Works

1. **You paste a news story, headline, or claim**
2. **Three targeted searches** — Tavily runs one news search per lens, each restricted to that lens's outlets (e.g. Guardian/MSNBC/NYT for progressive, Fox/WSJ/National Review for conservative, BBC/Reuters/Al Jazeera for international)
3. **AI synthesis** — one Groq call (JSON mode) reads the results and produces the three structured lenses plus consensus facts, per-lens spin, and a stripped-truth summary
4. **Visual comparison** — three columns show each perspective's coverage, real source links, and unique claims
5. **The truth layer** — the bottom section shows what every source agrees on — the factual skeleton beneath all editorial framing

> Because each lens is searched against its own outlet list, the perspective columns reflect genuinely different slices of coverage rather than one undifferentiated search.

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](docs/ARCHITECTURE.md) | System design, data flow, component hierarchy |
| [Prompts](docs/PROMPTS.md) | The synthesis prompt and reasoning |
| [Deployment](docs/DEPLOYMENT.md) | Step-by-step Vercel deployment |
| [Environment Setup](docs/ENV_SETUP.md) | API keys and environment variables |
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
