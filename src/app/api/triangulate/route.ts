/**
 * POST /api/triangulate
 *
 * Accepts a news story/headline/claim and returns a multi-perspective
 * triangulation analysis powered by Tavily (live search) + Groq (synthesis).
 *
 * - Validates input (non-empty, ≤2000 chars)
 * - Rate limits (10 requests per IP per minute, in-memory)
 * - Returns proper HTTP status codes (400, 429, 500, 200)
 */

import { NextRequest, NextResponse } from 'next/server';
import { TriangulatorService } from '@/lib/triangulator';
import { TriangulationError } from '@/lib/types';
import type { TriangulateResponse, TriangulateErrorResponse } from '@/lib/types';

/* ──────────────────────────────────────────────────────────────────────
 * Constants
 * ────────────────────────────────────────────────────────────────────── */

const MAX_QUERY_LENGTH = 2000;
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10;

/* ──────────────────────────────────────────────────────────────────────
 * In-Memory Rate Limiter
 *
 * NOTE: This resets on server restart and doesn't work across multiple
 * instances. Fine for a hackathon demo, not for production.
 * See docs/KNOWN_LIMITATIONS.md for details.
 * ────────────────────────────────────────────────────────────────────── */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/** Returns true if the request should be rate-limited */
function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);

  if (!entry || now > entry.resetAt) {
    // First request or window expired — start fresh
    rateLimitStore.set(ip, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return false;
  }

  entry.count += 1;
  return entry.count > RATE_LIMIT_MAX_REQUESTS;
}

/** Extracts the client IP from the request headers */
function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  );
}

/* ──────────────────────────────────────────────────────────────────────
 * Error Response Builder
 * ────────────────────────────────────────────────────────────────────── */

function errorResponse(
  error: string,
  code: TriangulateErrorResponse['code'],
  status: number
): NextResponse<TriangulateErrorResponse> {
  return NextResponse.json(
    { success: false as const, error, code },
    { status }
  );
}

/**
 * Reads an HTTP-style status from an upstream error (SearchError / GroqError
 * carry a `.status`; the TriangulationError wraps them as `.cause`). Falls back
 * to sniffing the message text.
 */
function upstreamHttpStatus(cause: unknown): number | undefined {
  let cur: unknown = cause;
  const seen = new Set<unknown>();
  for (let i = 0; i < 6 && cur != null && !seen.has(cur); i++) {
    seen.add(cur);
    if (typeof cur === 'object') {
      const o = cur as Record<string, unknown>;
      const status = o.status;
      if (typeof status === 'number' && status >= 400) return status;
      const code = o.code;
      if (typeof code === 'number' && code >= 400) return code;
    }
    cur =
      typeof cur === 'object' && cur !== null && 'cause' in cur
        ? (cur as { cause: unknown }).cause
        : undefined;
  }
  const msg = cause instanceof Error ? cause.message : String(cause ?? '');
  const m = msg.match(/\b(429|500|502|503)\b/);
  return m ? Number(m[1]) : undefined;
}

/* ──────────────────────────────────────────────────────────────────────
 * Route Handler
 * ────────────────────────────────────────────────────────────────────── */

export async function POST(
  request: NextRequest
): Promise<NextResponse<TriangulateResponse | TriangulateErrorResponse>> {
  const clientIp = getClientIp(request);

  // Rate limiting check
  if (isRateLimited(clientIp)) {
    console.warn(`[triangulate] Rate limited: ${clientIp}`);
    return errorResponse(
      'Too many requests. Please wait a minute before trying again.',
      'RATE_LIMITED',
      429
    );
  }

  // Parse and validate request body
  let query: string;
  try {
    const body: unknown = await request.json();
    if (
      typeof body !== 'object' ||
      body === null ||
      !('query' in body) ||
      typeof (body as Record<string, unknown>).query !== 'string'
    ) {
      return errorResponse(
        'Request body must contain a "query" string.',
        'INVALID_INPUT',
        400
      );
    }
    query = ((body as Record<string, unknown>).query as string).trim();
  } catch {
    return errorResponse(
      'Invalid JSON in request body.',
      'INVALID_INPUT',
      400
    );
  }

  // Validate query content
  if (query.length === 0) {
    return errorResponse(
      'Query cannot be empty.',
      'INVALID_INPUT',
      400
    );
  }

  if (query.length > MAX_QUERY_LENGTH) {
    return errorResponse(
      `Query exceeds maximum length of ${MAX_QUERY_LENGTH} characters.`,
      'INVALID_INPUT',
      400
    );
  }

  // Execute triangulation
  try {
    console.info(
      `[triangulate] Processing request from ${clientIp} (${query.length} chars)`
    );

    const service = new TriangulatorService();
    const result = await service.triangulate(query);

    console.info(
      `[triangulate] Completed for ${clientIp} at ${result.processedAt}`
    );

    return NextResponse.json({
      success: true as const,
      data: result,
    });
  } catch (error) {
    if (error instanceof TriangulationError) {
      console.error(
        `[triangulate] TriangulationError (${error.phase}): ${error.message}`,
        error.cause instanceof Error ? error.cause.message : error.cause ?? ''
      );

      // A missing API key is a server configuration problem.
      if (error.phase === 'config') {
        return errorResponse(
          'The service is not configured correctly. Please contact the site owner.',
          'SERVICE_ERROR',
          500
        );
      }

      const upstreamStatus = upstreamHttpStatus(error.cause);
      if (upstreamStatus === 429) {
        return errorResponse(
          'The free-tier rate limit was exceeded (Tavily or Groq). Wait a minute and try again.',
          'QUOTA_EXCEEDED',
          429
        );
      }

      // Upstream services intermittently return 5xx under load. Retries already
      // happened; tell the user it's a temporary upstream spike.
      if (upstreamStatus && upstreamStatus >= 500) {
        return errorResponse(
          'A provider (search or AI) is temporarily unavailable. Please try again in a moment.',
          'SERVICE_ERROR',
          503
        );
      }

      // Search phase with no upstream status means we couldn't analyze the
      // query — no coverage found, or the results didn't match the input.
      if (error.phase === 'search') {
        return errorResponse(
          error.message,
          'INVALID_INPUT',
          422
        );
      }

      return errorResponse(
        'The service encountered an error. Please try again.',
        'SERVICE_ERROR',
        500
      );
    }

    console.error('[triangulate] Unexpected error:', error);
    return errorResponse(
      'An unexpected error occurred. Please try again.',
      'SERVICE_ERROR',
      500
    );
  }
}
