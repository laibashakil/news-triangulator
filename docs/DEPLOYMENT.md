# Deployment Guide — Vercel

This guide walks you through deploying News Triangulator to **Vercel** on the free tier. The app calls Gemini through the **Gemini Developer API** using a single `GEMINI_API_KEY` environment variable — no Google Cloud project, billing, or service accounts required.

---

## Prerequisites

- A [GitHub](https://github.com) account with this repo pushed to it
- A free [Vercel](https://vercel.com) account (sign in with GitHub)
- A free **Gemini API key** from [aistudio.google.com/apikey](https://aistudio.google.com/apikey)

## Step 1: Get a Gemini API Key

1. Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
2. Click **Create API key** (no billing setup is required for the free tier).
3. Copy the key — you'll paste it into Vercel in Step 3.

> The free tier enforces a **per-day request quota that varies by model**. The app defaults to `gemini-2.5-flash-lite` (set as `MODEL_ID` in [src/lib/gemini.ts](../src/lib/gemini.ts)), which has a generous free daily allowance and supports Google Search grounding.

## Step 2: Import the Project into Vercel

1. Push your code to GitHub.
2. At [vercel.com](https://vercel.com), click **Add New… → Project**.
3. Import your `news-triangulator` repository.
4. Vercel auto-detects Next.js — leave the default build settings:
   - **Framework Preset**: Next.js
   - **Build Command**: `next build` (default)
   - **Install Command**: `pnpm install` (auto-detected from `pnpm-lock.yaml`)
   - **Output Directory**: default

## Step 3: Add the Environment Variable

Before (or after) the first deploy, go to **Project Settings → Environment Variables** and add:

| Name | Value | Environments |
|------|-------|--------------|
| `GEMINI_API_KEY` | your key from Step 1 | Production, Preview, Development |

> If you add it after the first deploy, trigger a redeploy so the new variable is picked up.

Optional variables:

| Name | Purpose |
|------|---------|
| `GEMINI_STORY_VALIDATION` | Set to `true` to enable the pre-flight "is this a news query?" check (adds one request per analysis). Off by default. |
| `NEXT_PUBLIC_APP_URL` | Your deployed URL, if you want it referenced in client code/meta tags. |

## Step 4: Deploy

Click **Deploy**. Vercel builds the app and assigns a URL like `https://news-triangulator-xxxx.vercel.app`.

Every push to the `main` branch triggers an automatic production redeploy. Pull requests get their own preview deployments.

## Step 5: Verify

```bash
# Home page
curl https://your-app.vercel.app

# API endpoint
curl -X POST https://your-app.vercel.app/api/triangulate \
  -H "Content-Type: application/json" \
  -d '{"query": "US Federal Reserve interest rate decision"}'
```

A successful response is `{"success": true, "data": { ... }}` with three perspectives, consensus facts, and the stripped-truth summary.

## Local Development

```bash
pnpm install
cp .env.example .env.local      # then set GEMINI_API_KEY=... in .env.local
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). See [ENV_SETUP.md](ENV_SETUP.md) for environment-variable details.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `GEMINI_API_KEY is not set` error | Add the variable in Vercel → Project Settings → Environment Variables, then redeploy. Locally, set it in `.env.local`. |
| `429` / `GEMINI_QUOTA_EXCEEDED` | You hit the free-tier **daily** request quota. Wait for the reset (~24h), switch `MODEL_ID` to a model with a higher free quota, or reduce traffic. The app already retries transient rate spikes with backoff. |
| `503` "high demand" / "try again in a moment" | Transient free-tier capacity throttling on Google's side. The app retries automatically; if it persists, wait a moment and retry. |
| Build fails on Vercel | Run `pnpm build` locally to reproduce. The project does **not** use `output: 'standalone'` (that was for the old Docker image). |
| Empty/odd results for a query | The story may have thin coverage from one lens, or the input wasn't a researchable news claim. Try a more specific headline. |

---

> **Migrated from Google Cloud Run.** This project previously deployed as a Docker image to Cloud Run using Vertex AI with Application Default Credentials. It now runs on Vercel with the key-based Gemini Developer API. The old `Dockerfile` is no longer used by this deployment path.
