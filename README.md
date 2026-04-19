# News Triangulator 🔺

> **See the truth beneath the headlines.** Paste any news story and see how progressive, conservative, and international sources covered it differently — then read what all versions actually agree on.

News Triangulator uses **Gemini 2.0 Flash** with **Google Search Grounding** to perform live searches across ideologically distinct news sources, compare their coverage, and extract the factual core that survives triangulation.

<!-- screenshot placeholder: replace with actual screenshot after deployment -->
![News Triangulator Screenshot](docs/screenshot-placeholder.png)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 14 (App Router) |
| **Language** | TypeScript (strict mode) |
| **Styling** | Tailwind CSS |
| **AI** | Gemini 2.0 Flash via `@google/genai` SDK |
| **Search** | Google Search Grounding (live web search) |
| **Deployment** | Docker → Google Cloud Run |
| **Package Manager** | pnpm |

## Quick Start

### Prerequisites
- Node.js 20+
- pnpm (`npm install -g pnpm`)
- A Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)

### Setup

```bash
# Clone the repository
git clone https://github.com/your-username/news-triangulator.git
cd news-triangulator

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local and add your GEMINI_API_KEY

# Start the dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) and paste a news headline.

## How It Works

1. **You paste a news story, headline, or claim**
2. **Three parallel searches** — Gemini searches for progressive, conservative, and international coverage simultaneously
3. **AI synthesis** — A fourth call extracts consensus facts, identifies spin per perspective, and writes a stripped-truth summary
4. **Visual comparison** — Three columns show each perspective's coverage, sources, and unique claims
5. **The truth layer** — The bottom section shows what every source agrees on — the factual skeleton beneath all editorial framing

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](docs/ARCHITECTURE.md) | System design, data flow, component hierarchy |
| [Gemini Prompts](docs/GEMINI_PROMPTS.md) | Every AI prompt with reasoning |
| [Deployment](docs/DEPLOYMENT.md) | Step-by-step Cloud Run deployment |
| [Environment Setup](docs/ENV_SETUP.md) | All environment variables explained |
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
