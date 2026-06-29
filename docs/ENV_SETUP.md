# Environment & Authentication Setup

News Triangulator calls Gemini through the **Gemini Developer API**, so authentication is handled by a single **`GEMINI_API_KEY`** — no Google Cloud project, billing, or Application Default Credentials required. This document explains how to get a key, where to set it, and which environment variables the app reads.

---

## Authentication

The service is created in [src/lib/gemini.ts](../src/lib/gemini.ts) with:

```ts
new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
```

The `@google/genai` SDK reads the key from the environment and authenticates against the Gemini Developer API. If `GEMINI_API_KEY` is missing, the service throws a clear configuration error rather than failing mid-request.

### Getting a Key

1. Visit [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
2. Click **Create API key** — the free tier needs no billing.
3. Use the key locally (in `.env.local`) and in Vercel (project environment variables).

### Local Development

```bash
cp .env.example .env.local
# edit .env.local and set:
# GEMINI_API_KEY=your-key-here

pnpm dev
```

### Production (Vercel)

Add `GEMINI_API_KEY` under **Project Settings → Environment Variables**, then deploy. See [DEPLOYMENT.md](DEPLOYMENT.md) for the full walk-through.

### Model Selection

The model is set in [src/lib/gemini.ts](../src/lib/gemini.ts):

```ts
const MODEL_ID = 'gemini-2.5-flash-lite';
```

`gemini-2.5-flash-lite` is the default because it has a generous free-tier daily quota and still supports Google Search grounding. Change it to `gemini-2.5-flash` for higher answer quality (lower free quota) or another grounding-capable model as needed.

---

## Environment Variables

### `GEMINI_API_KEY` (required)

| Property | Value |
|----------|-------|
| **Required** | Yes |
| **Source** | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| **Used by** | Server-side only ([src/lib/gemini.ts](../src/lib/gemini.ts)) |

The free Gemini Developer API key. Without it the API route returns a configuration error. Never expose it to the browser — it has no `NEXT_PUBLIC_` prefix and must stay server-side.

### `GEMINI_STORY_VALIDATION` (optional)

| Property | Value |
|----------|-------|
| **Required** | No |
| **Default** | unset (validation skipped) |
| **Values** | `true` to enable |
| **Used by** | Server-side only |

When `true`, the flow runs an extra pre-flight Gemini call to verify the input is a plausible news story before spending the grounded search. Off by default to conserve the free-tier daily quota.

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

## Local `.env.local` Template

```env
# .env.local — DO NOT COMMIT THIS FILE

# Required: free Gemini API key from https://aistudio.google.com/apikey
GEMINI_API_KEY=your-key-here

# Optional: app URL (defaults to http://localhost:3000 in dev)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional: enable the pre-flight validation call (off by default)
# GEMINI_STORY_VALIDATION=true
```

---

## Security Notes

- `.gitignore` already excludes `.env*` files except `.env.example` — verify your key never appears in `git status`.
- `GEMINI_API_KEY` is read server-side only. It is never bundled into client code.
- `NEXT_PUBLIC_`-prefixed variables are exposed to the browser at build time; never put the API key (or any secret) in one.
- If a key is ever committed or leaked, revoke it in Google AI Studio and create a new one.
