# Environment & Authentication Setup

News Triangulator calls Gemini 2.5 Flash through **Vertex AI**, so authentication is handled by **Google Cloud Application Default Credentials (ADC)** — not by a `GEMINI_API_KEY`. This document explains how to authenticate locally, how to authenticate on Cloud Run, and which environment variables the app actually reads.

---

## Authentication

The service is created in [src/lib/gemini.ts](src/lib/gemini.ts) with:

```ts
new GoogleGenAI({
  vertexai: true,
  project: 'news-triangulator',
  location: 'us-central1',
});
```

The `@google/genai` SDK resolves credentials in this order when `vertexai: true`:

1. A service-account JSON file pointed to by `GOOGLE_APPLICATION_CREDENTIALS`
2. The compute service account on Google Cloud runtimes (Cloud Run, GCE, GKE, etc.)
3. The user credentials stored by `gcloud auth application-default login`

In all three cases, the identity must have **`roles/aiplatform.user`** (or a superset) on the target project, and the **Vertex AI API** (`aiplatform.googleapis.com`) must be enabled.

### Local Development

```bash
# Install the Google Cloud CLI first: https://cloud.google.com/sdk/docs/install

# Set your project (use the one that matches the constant in src/lib/gemini.ts,
# or change that constant to match your project)
gcloud config set project news-triangulator

# Enable the Vertex AI API (idempotent)
gcloud services enable aiplatform.googleapis.com

# Create ADC credentials for your user
gcloud auth application-default login
```

After this, `pnpm dev` will pick up your credentials automatically — no env var needed.

### Cloud Run

See [DEPLOYMENT.md](DEPLOYMENT.md) for the full walk-through. In short:

- Grant the Cloud Run service's runtime service account `roles/aiplatform.user` on the project
- Enable `aiplatform.googleapis.com`
- Do **not** set `GOOGLE_APPLICATION_CREDENTIALS` — Cloud Run attaches the service-account credentials automatically

### Project ID & Location

Both are hardcoded in [src/lib/gemini.ts](src/lib/gemini.ts):

```ts
const VERTEX_PROJECT = 'news-triangulator';
const VERTEX_LOCATION = 'us-central1';
```

Change these if you deploy to a different project or region. They are deliberately code-level rather than env-var-configurable to keep the demo simple.

---

## Environment Variables

### `GEMINI_STORY_VALIDATION`

| Property | Value |
|----------|-------|
| **Required** | No |
| **Default** | unset (validation skipped) |
| **Values** | `true` to enable |
| **Used by** | Server-side only ([src/lib/gemini.ts](src/lib/gemini.ts)) |

When set to `true`, the triangulation flow runs an extra pre-flight Gemini call to verify the input is a plausible news story before spending the grounded search call. Defaults off to keep quota use minimal.

### `NEXT_PUBLIC_APP_URL`

| Property | Value |
|----------|-------|
| **Required** | No (defaults work for local dev) |
| **Local value** | `http://localhost:3000` |
| **Production value** | Your Cloud Run service URL |
| **Used by** | Client-side (for API calls and meta tags) |

The base URL of the deployed application. The `NEXT_PUBLIC_` prefix makes this available in browser-side code. Never put secrets in a `NEXT_PUBLIC_` variable.

### `NODE_ENV`

| Property | Value |
|----------|-------|
| **Required** | No (Next.js sets this automatically) |
| **Local value** | `development` (set by `next dev`) |
| **Production value** | `production` (set in Dockerfile) |

### `GOOGLE_APPLICATION_CREDENTIALS` (optional)

Only set this if you want to authenticate via a service-account JSON file instead of `gcloud auth application-default login`. Point it to the absolute path of the key file. Not required on Cloud Run.

---

## Local `.env.local` Template

```env
# .env.local — DO NOT COMMIT THIS FILE

# Optional: app URL (defaults to http://localhost:3000 in dev)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional: enable the pre-flight validation call (off by default)
# GEMINI_STORY_VALIDATION=true

# Optional: point at a service-account JSON instead of using gcloud ADC
# GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.json
```

There is **no `GEMINI_API_KEY`** to set. If you copied this project from an earlier commit that referenced one, delete it — the Vertex AI path ignores it.

---

## Security Notes

- `.gitignore` already excludes `.env*` files except `.env.example`
- Never commit service-account JSON files; keep them out of the repo
- On Cloud Run, prefer the attached service account over mounting a key file — it rotates automatically and is never written to disk
- `NEXT_PUBLIC_`-prefixed variables are exposed to the browser by Next.js at build time; never put credentials in them
