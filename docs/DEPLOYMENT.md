# Deployment Guide — Google Cloud Run

This guide walks you through deploying News Triangulator to **Google Cloud Run** from scratch. It assumes you have a Google Cloud project set up with billing enabled and the `gcloud` CLI installed, but have never deployed to Cloud Run before.

---

## Prerequisites

- [Google Cloud SDK (gcloud CLI)](https://cloud.google.com/sdk/docs/install) installed and authenticated
- A Google Cloud project with billing enabled
- Docker installed locally (for building images, or use Cloud Build)
- A Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)

## Step 1: Authenticate and Set Your Project

```bash
# Login to Google Cloud
gcloud auth login

# Set your project (replace with your project ID)
gcloud config set project YOUR_PROJECT_ID

# Enable required APIs
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
gcloud services enable secretmanager.googleapis.com
gcloud services enable artifactregistry.googleapis.com
```

## Step 2: Store API Key in Secret Manager

**Never hardcode API keys.** Use Google Cloud Secret Manager:

```bash
# Create the secret
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets create gemini-api-key \
  --replication-policy="automatic" \
  --data-file=-

# Grant Cloud Run access to the secret
gcloud secrets add-iam-policy-binding gemini-api-key \
  --member="serviceAccount:YOUR_PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

To find your project number:
```bash
gcloud projects describe YOUR_PROJECT_ID --format="value(projectNumber)"
```

## Step 3: Create an Artifact Registry Repository

```bash
# Create a Docker repository in Artifact Registry
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
  --set-secrets="GEMINI_API_KEY=gemini-api-key:latest" \
  --set-env-vars="NODE_ENV=production,NEXT_PUBLIC_APP_URL=https://YOUR_SERVICE_URL"
```

**Flag explanations**:
| Flag | Purpose |
|------|---------|
| `--allow-unauthenticated` | Makes the service publicly accessible |
| `--port=8080` | Cloud Run default port; matches Dockerfile EXPOSE |
| `--memory=512Mi` | Sufficient for Next.js SSR + Gemini API calls |
| `--min-instances=0` | Scale to zero when not in use (saves cost) |
| `--max-instances=3` | Prevents runaway scaling (and API key abuse) |
| `--set-secrets` | Mounts Secret Manager secrets as env variables |

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

# Hit the health check
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
| "Secret not found" | Verify the secret exists: `gcloud secrets list` |
| "Permission denied on secret" | Re-run the IAM binding command from Step 2 |
| Slow cold starts | Set `--min-instances=1` (costs more but eliminates cold starts) |
| 503 errors under load | Increase `--max-instances` and `--memory` |
