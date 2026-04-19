/**
 * POST /api/triangulate
 *
 * Accepts a news story/headline/claim and returns a multi-perspective
 * triangulation analysis powered by Gemini with Search Grounding.
 *
 * - Validates input (non-empty, ≤2000 chars)
 * - Rate limits (10 requests per IP per minute, in-memory)
 * - Returns proper HTTP status codes (400, 429, 500, 200)
 */

import { NextRequest, NextResponse } from 'next/server';
import { GeminiService } from '@/lib/gemini';
import { GeminiServiceError } from '@/lib/types';
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

    const service = new GeminiService();
    const result = await service.triangulate(query);

    console.info(
      `[triangulate] Completed for ${clientIp} at ${result.processedAt}`
    );

    return NextResponse.json({
      success: true as const,
      data: result,
    });
  } catch (error) {
    if (error instanceof GeminiServiceError) {
      console.error(
        `[triangulate] GeminiServiceError (${error.phase}): ${error.message}`
      );

      // Validation failures are client errors (bad input)
      if (error.phase === 'validation') {
        return errorResponse(error.message, 'VALIDATION_FAILED', 400);
      }

      return errorResponse(
        'The AI service encountered an error. Please try again.',
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
