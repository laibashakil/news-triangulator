# ──────────────────────────────────────────────────────────────────────
# News Triangulator — Multi-Stage Docker Build
#
# Stage 1 (builder): Install deps, build Next.js in standalone mode
# Stage 2 (runner): Clean alpine image with only the built output
#
# The standalone output mode (set in next.config.js) produces a
# minimal self-contained build that doesn't need full node_modules.
# ──────────────────────────────────────────────────────────────────────

# ── Stage 1: Build ──
FROM node:20-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy package files first for better Docker layer caching
COPY package.json pnpm-lock.yaml ./

# Install all dependencies (including devDependencies for build)
RUN pnpm install --frozen-lockfile

# Copy source code
COPY src/ ./src/
COPY public/ ./public/
COPY next.config.js tailwind.config.ts tsconfig.json postcss.config.mjs ./

# Build the Next.js application
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# ── Stage 2: Run ──
FROM node:20-alpine AS runner

WORKDIR /app

# Don't run as root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy only the standalone build output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy public assets if they exist
COPY --from=builder /app/public ./public

# Set correct permissions
RUN chown -R nextjs:nodejs /app

USER nextjs

# Cloud Run expects port 8080 by default
ENV PORT=8080
EXPOSE 8080

# Start the server — the standalone build includes its own server
CMD ["node", "server.js"]
