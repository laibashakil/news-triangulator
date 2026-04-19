# News Triangulator 🔺

> **See the truth beneath the headlines.** Paste any news story and see how progressive, conservative, and international sources covered it differently — then read what all versions actually agree on.

News Triangulator uses **Gemini 2.5 Flash** with **Google Search Grounding** on **Vertex AI** to perform live searches across ideologically distinct news sources, compare their coverage, and extract the factual core that survives triangulation.


## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 14 (App Router) |
| **Language** | TypeScript (strict mode) |
| **Styling** | Tailwind CSS |
| **AI** | Gemini 2.5 Flash on Vertex AI via the `@google/genai` SDK |
| **Search** | Google Search Grounding (live web search) |
| **Auth** | Google Cloud Application Default Credentials (ADC) |
| **Deployment** | Docker → Google Cloud Run |
| **Package Manager** | pnpm |

## Quick Start

### Prerequisites
- Node.js 20+
- pnpm (`npm install -g pnpm`)
- Google Cloud CLI ([`gcloud`](https://cloud.google.com/sdk/docs/install)) authenticated to a project where the **Vertex AI API** is enabled and billing is on
- The project ID hardcoded in [src/lib/gemini.ts](src/lib/gemini.ts) is `news-triangulator` in `us-central1`; change those constants if you deploy to a different project/region

### Setup

```bash
# Clone the repository
git clone https://github.com/your-username/news-triangulator.git
cd news-triangulator

# Install dependencies
pnpm install

# Authenticate to Google Cloud (one-time, for local dev)
gcloud auth application-default login
gcloud config set project news-triangulator
gcloud services enable aiplatform.googleapis.com

# (Optional) copy the env template for non-secret settings
cp .env.example .env.local

# Start the dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) and paste a news headline.

> **No API key required.** The Vertex AI SDK picks up your ADC credentials automatically. See [docs/ENV_SETUP.md](docs/ENV_SETUP.md) for service-account setup and other environment details.

## How It Works

1. **You paste a news story, headline, or claim**
2. **One grounded search, three lenses** — a single Gemini call uses Google Search Grounding to gather progressive, conservative, and international coverage in one research pass
3. **AI synthesis** — a second call extracts consensus facts, identifies spin per perspective, and writes a stripped-truth summary
4. **Visual comparison** — three columns show each perspective's coverage, sources, and unique claims
5. **The truth layer** — the bottom section shows what every source agrees on — the factual skeleton beneath all editorial framing

> An optional third call (story validation) runs first when `GEMINI_STORY_VALIDATION=true` to reject gibberish before spending the grounded search.

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](docs/ARCHITECTURE.md) | System design, data flow, component hierarchy |
| [Gemini Prompts](docs/GEMINI_PROMPTS.md) | Every AI prompt with reasoning |
| [Deployment](docs/DEPLOYMENT.md) | Step-by-step Cloud Run deployment |
| [Environment Setup](docs/ENV_SETUP.md) | Authentication and environment variables |
| [Demo Script](docs/DEMO_SCRIPT.md) | 2-minute hackathon presentation guide |
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
├── Dockerfile               # Multi-stage Docker build
├── .env.example             # Environment variable template
└── tailwind.config.ts       # Design tokens & theme
```

## License

MIT
