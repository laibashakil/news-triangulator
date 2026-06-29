# Environment & Authentication Setup

News Triangulator uses two free services, each authenticated with a simple API key — no Google Cloud, billing, or Application Default Credentials. This document explains how to get the keys, where to set them, and which environment variables the app reads.

- **Tavily** — live news search ([src/lib/search.ts](../src/lib/search.ts))
- **Groq** — LLM synthesis ([src/lib/groq.ts](../src/lib/groq.ts))

---

## Getting the Keys

**Tavily** (`TAVILY_API_KEY`):
1. Sign up at [app.tavily.com](https://app.tavily.com).
2. Copy the key (`tvly-…`). Free tier ≈ 1,000 searches/month.

**Groq** (`GROQ_API_KEY`):
1. Sign up at [console.groq.com](https://console.groq.com).
2. Create a key (`gsk_…`). Free tier is generous and fast.

### Local Development

```bash
cp .env.example .env.local
# edit .env.local and set:
# TAVILY_API_KEY=tvly-...
# GROQ_API_KEY=gsk_...

pnpm dev
```

### Production (Vercel)

Add both keys under **Project Settings → Environment Variables**, then deploy. See [DEPLOYMENT.md](DEPLOYMENT.md) for the full walk-through.

---

## Environment Variables

### `TAVILY_API_KEY` (required)

| Property | Value |
|----------|-------|
| **Required** | Yes |
| **Source** | [app.tavily.com](https://app.tavily.com) |
| **Used by** | Server-side only ([src/lib/search.ts](../src/lib/search.ts)) |

Authenticates the live news search. Without it the API route returns a configuration error.

### `GROQ_API_KEY` (required)

| Property | Value |
|----------|-------|
| **Required** | Yes |
| **Source** | [console.groq.com](https://console.groq.com) |
| **Used by** | Server-side only ([src/lib/groq.ts](../src/lib/groq.ts)) |

Authenticates the LLM synthesis call. Without it the API route returns a configuration error.

### `NEXT_PUBLIC_APP_URL` (optional)

| Property | Value |
|----------|-------|
| **Required** | No (defaults work for local dev) |
| **Local value** | `http://localhost:3000` |
| **Production value** | Your Vercel URL |
| **Used by** | Client-side (API calls and meta tags) |

The base URL of the deployed app. The `NEXT_PUBLIC_` prefix exposes it to browser code — never put secrets in a `NEXT_PUBLIC_` variable.

### `NODE_ENV`

Set automatically by Next.js (`development` under `next dev`, `production` in a deployed build). No need to configure it manually.

---

## Tuning (in code, not env)

| Setting | Location | Default |
|---------|----------|---------|
| Outlets searched per lens | `PERSPECTIVE_DOMAINS` in [src/lib/search.ts](../src/lib/search.ts) | curated lists |
| Results per lens / recency window | `MAX_RESULTS_PER_LENS`, `RECENCY_DAYS` in [src/lib/search.ts](../src/lib/search.ts) | 5 results, 30 days |
| LLM model | `GROQ_MODEL` in [src/lib/groq.ts](../src/lib/groq.ts) | `llama-3.3-70b-versatile` |

---

## Local `.env.local` Template

```env
# .env.local — DO NOT COMMIT THIS FILE

# Required: free Tavily key from https://app.tavily.com
TAVILY_API_KEY=tvly-...

# Required: free Groq key from https://console.groq.com
GROQ_API_KEY=gsk_...

# Optional: app URL (defaults to http://localhost:3000 in dev)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Security Notes

- `.gitignore` already excludes `.env*` files except `.env.example` — verify your keys never appear in `git status`.
- Both keys are read server-side only; they are never bundled into client code.
- `NEXT_PUBLIC_`-prefixed variables are exposed to the browser at build time; never put an API key in one.
- If a key leaks, revoke it in the Tavily/Groq dashboard and create a new one.
