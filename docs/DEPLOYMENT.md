# Deployment Guide — Google Cloud Run

This guide walks you through deploying News Triangulator to **Google Cloud Run** from scratch. It assumes you have a Google Cloud project with billing enabled and the `gcloud` CLI installed, but have never deployed to Cloud Run before.

The app calls Gemini 2.5 Flash through **Vertex AI** using **Application Default Credentials**, so there are no API keys to manage in Secret Manager — authentication is handled by a service account attached to the Cloud Run service.

---

## Prerequisites

- [Google Cloud SDK (gcloud CLI)](https://cloud.google.com/sdk/docs/install) installed and authenticated
- A Google Cloud project with billing enabled
- Docker installed locally (for building images, or use Cloud Build)

## Step 1: Authenticate and Set Your Project

```bash
# Login to Google Cloud
gcloud auth login

# Set your project (replace with your project ID; must match VERTEX_PROJECT in src/lib/gemini.ts)
gcloud config set project YOUR_PROJECT_ID

# Enable required APIs
gcloud services enable aiplatform.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable artifactregistry.googleapis.com
gcloud services enable cloudbuild.googleapis.com
```

> If your project ID differs from `news-triangulator`, update the `VERTEX_PROJECT` constant in [src/lib/gemini.ts](../src/lib/gemini.ts) before building the image. `VERTEX_LOCATION` should match the region you plan to deploy in (default `us-central1`).

## Step 2: Create a Runtime Service Account for Cloud Run

Instead of mounting an API key, we attach a dedicated service account to the Cloud Run service and grant it Vertex AI access.

```bash
# Create the service account
gcloud iam service-accounts create news-triangulator-runtime \
  --display-name="News Triangulator Cloud Run runtime"

# Grab the full email (stash in a shell variable for the commands below)
SA_EMAIL="news-triangulator-runtime@YOUR_PROJECT_ID.iam.gserviceaccount.com"

# Grant it Vertex AI user access
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/aiplatform.user"
```

`roles/aiplatform.user` is sufficient to call `generateContent` with Google Search Grounding. No Secret Manager roles are needed.

## Step 3: Create an Artifact Registry Repository

```bash
gcloud artifacts repositories create news-triangulator \
  --repository-format=docker \
  --location=us-central1 \
  --description="News Triangulator container images"
```

## Step 4: Understand the Dockerfile

The included `Dockerfile` uses a **multi-stage build**:

```
Stage 1 (builder):
  - Base: node:20-alpine
  - Installs pnpm
  - Copies package files and installs dependencies
  - Copies source code and builds the Next.js application
  - The `output: 'standalone'` config produces a minimal build

Stage 2 (runner):
  - Base: node:20-alpine (clean image)
  - Copies ONLY the standalone build output
  - Does NOT copy source files or full node_modules
  - Sets NODE_ENV=production
  - Exposes port 8080 (Cloud Run default)
  - Starts the server
```

This produces an image typically under 200MB — much smaller than copying the entire project.

## Step 5: Build and Push the Container Image

```bash
# Configure Docker to use Artifact Registry
gcloud auth configure-docker us-central1-docker.pkg.dev

# Build the image (from the project root directory)
docker build -t us-central1-docker.pkg.dev/YOUR_PROJECT_ID/news-triangulator/app:latest .

# Push the image
docker push us-central1-docker.pkg.dev/YOUR_PROJECT_ID/news-triangulator/app:latest
```

### Alternative: Build with Cloud Build (no local Docker needed)

```bash
gcloud builds submit --tag us-central1-docker.pkg.dev/YOUR_PROJECT_ID/news-triangulator/app:latest .
```

## Step 6: Deploy to Cloud Run

```bash
gcloud run deploy news-triangulator \
  --image=us-central1-docker.pkg.dev/YOUR_PROJECT_ID/news-triangulator/app:latest \
  --region=us-central1 \
  --platform=managed \
  --allow-unauthenticated \
  --port=8080 \
  --memory=512Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=3 \
  --service-account="${SA_EMAIL}" \
  --set-env-vars="NODE_ENV=production,NEXT_PUBLIC_APP_URL=https://YOUR_SERVICE_URL"
```

**Flag explanations**:

| Flag | Purpose |
|------|---------|
| `--allow-unauthenticated` | Makes the service publicly accessible |
| `--port=8080` | Cloud Run default port; matches Dockerfile EXPOSE |
| `--memory=512Mi` | Sufficient for Next.js SSR + Gemini API calls |
| `--min-instances=0` | Scale to zero when not in use (saves cost) |
| `--max-instances=3` | Prevents runaway scaling (and quota abuse) |
| `--service-account` | Runtime identity used for Vertex AI auth (set up in Step 2) |

> Deliberately absent: `--set-secrets`. There is no API key to mount — Vertex AI credentials flow from the attached service account.

## Step 7: Update the App URL

After deployment, Cloud Run assigns a URL like `https://news-triangulator-xxxxx-uc.a.run.app`. Update the deployment with this URL:

```bash
# Get the service URL
gcloud run services describe news-triangulator \
  --region=us-central1 \
  --format="value(status.url)"

# Update the environment variable with the actual URL
gcloud run services update news-triangulator \
  --region=us-central1 \
  --set-env-vars="NEXT_PUBLIC_APP_URL=https://news-triangulator-xxxxx-uc.a.run.app"
```

## Step 8: Verify the Deployment

```bash
# Check the service status
gcloud run services describe news-triangulator --region=us-central1

# Hit the home page
curl https://news-triangulator-xxxxx-uc.a.run.app

# Test the API endpoint
curl -X POST https://news-triangulator-xxxxx-uc.a.run.app/api/triangulate \
  -H "Content-Type: application/json" \
  -d '{"query": "US Federal Reserve interest rate decision"}'
```

## Updating the Deployment

To deploy a new version:

```bash
# Rebuild and push
docker build -t us-central1-docker.pkg.dev/YOUR_PROJECT_ID/news-triangulator/app:latest .
docker push us-central1-docker.pkg.dev/YOUR_PROJECT_ID/news-triangulator/app:latest

# Redeploy (Cloud Run will pull the new :latest image)
gcloud run deploy news-triangulator \
  --image=us-central1-docker.pkg.dev/YOUR_PROJECT_ID/news-triangulator/app:latest \
  --region=us-central1
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Container failed to start" | Check logs: `gcloud run services logs read news-triangulator --region=us-central1` |
| `PERMISSION_DENIED` calling Vertex AI | Confirm the runtime SA has `roles/aiplatform.user` on the project and that `aiplatform.googleapis.com` is enabled |
| `Could not load the default credentials` in logs | The service was deployed without `--service-account`. Redeploy with the flag set to `${SA_EMAIL}` |
| 429 `GEMINI_QUOTA_EXCEEDED` in API responses | Vertex AI per-minute quota hit — raise it in the Cloud Console or lower `--max-instances` |
| Slow cold starts | Set `--min-instances=1` (costs more but eliminates cold starts) |
| 503 errors under load | Increase `--max-instances` and `--memory` |
