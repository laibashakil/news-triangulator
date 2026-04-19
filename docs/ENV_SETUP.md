# Environment Variables Setup

This document explains every environment variable the application needs, where to get each value, and how to configure them for both local development and Cloud Run deployment.

---

## Required Variables

### `GEMINI_API_KEY`

| Property | Value |
|----------|-------|
| **Required** | Yes |
| **Where to get it** | [Google AI Studio → Get API Key](https://aistudio.google.com/apikey) |
| **Used by** | Server-side only (`src/lib/gemini.ts`) |
| **Never exposed to** | Client-side / browser |

This is the API key for the Gemini API. It authenticates your requests to Google's generative AI models. The free tier includes a generous quota for development and demo purposes.

**Steps to obtain**:
1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Click "Get API Key" in the top navigation
3. Click "Create API Key"
4. Select your Google Cloud project (or create one)
5. Copy the generated key

### `NEXT_PUBLIC_APP_URL`

| Property | Value |
|----------|-------|
| **Required** | No (defaults work for local dev) |
| **Local value** | `http://localhost:3000` |
| **Production value** | Your Cloud Run service URL |
| **Used by** | Client-side (for API calls and meta tags) |

The base URL of the deployed application. The `NEXT_PUBLIC_` prefix makes this available in browser-side code.

### `NODE_ENV`

| Property | Value |
|----------|-------|
| **Required** | No (Next.js sets this automatically) |
| **Local value** | `development` (set by `next dev`) |
| **Production value** | `production` (set in Dockerfile) |
| **Used by** | Next.js internals, conditional logic |

## Local Development Setup

### 1. Create `.env.local` file

```bash
# Copy the example file
cp .env.example .env.local
```

### 2. Fill in the values

```env
# .env.local — DO NOT COMMIT THIS FILE

# Required: Your Gemini API key from Google AI Studio
GEMINI_API_KEY=your_api_key_here

# Optional: App URL (defaults to localhost:3000 in dev)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional: Set by Next.js automatically
NODE_ENV=development
```

### 3. Verify

```bash
pnpm dev
# The app should start without "missing API key" errors
```

## Cloud Run Configuration

In Cloud Run, environment variables are set via the deployment command or the Cloud Console.

### Using Secret Manager (recommended for API keys)

```bash
# Store the key as a secret
echo -n "your_api_key" | gcloud secrets create gemini-api-key \
  --replication-policy="automatic" \
  --data-file=-

# Reference in deployment
gcloud run deploy news-triangulator \
  --set-secrets="GEMINI_API_KEY=gemini-api-key:latest" \
  --set-env-vars="NODE_ENV=production,NEXT_PUBLIC_APP_URL=https://your-service.run.app"
```

### Using Plain Environment Variables (not recommended for secrets)

```bash
gcloud run deploy news-triangulator \
  --set-env-vars="GEMINI_API_KEY=your_key,NODE_ENV=production"
```

## Security Notes

- **Never** commit `.env.local` or any file containing real API keys
- The `.gitignore` file excludes `.env*` files (except `.env.example`)
- In production, always use Secret Manager for `GEMINI_API_KEY`
- `NEXT_PUBLIC_` prefixed variables are exposed to the browser — never put secrets in them
