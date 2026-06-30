# Deployment Guide — Vercel

This guide walks you through deploying News Triangulator to **Vercel** on the free tier. The app uses two free services and no Google Cloud, billing, or service accounts:

- **Tavily** — live news search ([app.tavily.com](https://app.tavily.com))
- **Groq** — fast LLM synthesis ([console.groq.com](https://console.groq.com))

---

## Prerequisites

- A [GitHub](https://github.com) account with this repo pushed to it
- A free [Vercel](https://vercel.com) account (sign in with GitHub)
- A free **Tavily API key** and a free **Groq API key**

## Step 1: Get the API Keys

**Tavily** (search):
1. Sign up at [app.tavily.com](https://app.tavily.com).
2. Copy your API key (starts with `tvly-`). The free tier includes ~1,000 searches/month.

**Groq** (LLM):
1. Sign up at [console.groq.com](https://console.groq.com).
2. Create an API key (starts with `gsk_`). The free tier is generous and fast.

## Step 2: Import the Project into Vercel

1. Push your code to GitHub.
2. At [vercel.com](https://vercel.com), click **Add New… → Project**.
3. Import your `news-triangulator` repository.
4. Vercel auto-detects Next.js — leave the default build settings:
   - **Framework Preset**: Next.js
   - **Build Command**: `next build` (default)
   - **Install Command**: `pnpm install` (auto-detected from `pnpm-lock.yaml`)

## Step 3: Add the Environment Variables

Go to **Project Settings → Environment Variables** and add both:

| Name | Value | Environments |
|------|-------|--------------|
| `TAVILY_API_KEY` | your `tvly-…` key | Production, Preview, Development |
| `GROQ_API_KEY` | your `gsk_…` key | Production, Preview, Development |

> If you add them after the first deploy, trigger a redeploy so they're picked up.

Optional:

| Name | Purpose |
|------|---------|
| `NEXT_PUBLIC_APP_URL` | Your deployed URL, if you want it referenced in client code/meta tags. |

## Step 4: Deploy

Click **Deploy**. Every push to `main` triggers an automatic production redeploy; pull requests get preview deployments.

The live deployment is at **[https://news-triangulator.vercel.app](https://news-triangulator.vercel.app)**.

## Step 5: Verify

```bash
# Home page
curl https://news-triangulator.vercel.app

# API endpoint
curl -X POST https://news-triangulator.vercel.app/api/triangulate \
  -H "Content-Type: application/json" \
  -d '{"query": "US Federal Reserve interest rate decision"}'
```

A successful response is `{"success": true, "data": { ... }}` with three perspectives, consensus facts, and the stripped-truth summary.

## Local Development

```bash
pnpm install
cp .env.example .env.local      # then set TAVILY_API_KEY and GROQ_API_KEY
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). See [ENV_SETUP.md](ENV_SETUP.md) for environment-variable details.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `TAVILY_API_KEY is not set` / `GROQ_API_KEY is not set` | Add the variable in Vercel → Project Settings → Environment Variables, then redeploy. Locally, set it in `.env.local`. |
| `429` rate-limit error | A free-tier limit (Tavily monthly searches or Groq rate limit) was hit. Wait and retry; the app already retries transient spikes with backoff. |
| `503` "provider temporarily unavailable" | Tavily or Groq returned a transient `5xx`. The app retries automatically; if it persists, wait a moment. |
| `502` "no coverage found" | Tavily found no articles from the tracked outlets for that query. Try a more specific or more widely-covered headline. |
| Build fails on Vercel | Run `pnpm build` locally to reproduce. The project does **not** use `output: 'standalone'`. |
| Want different outlets per lens | Edit `PERSPECTIVE_DOMAINS` in [src/lib/search.ts](../src/lib/search.ts). |
| Want a different LLM | Edit `GROQ_MODEL` in [src/lib/groq.ts](../src/lib/groq.ts) (any Groq chat model with JSON mode). |

---

> **Migrated from Google Cloud Run / Vertex AI, then from the Gemini Developer API.** Earlier versions used Gemini with Google Search grounding; this version uses Tavily + Groq so it runs entirely on free, billing-free tiers.
