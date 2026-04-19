/**
 * Custom hook for managing the triangulation request lifecycle.
 *
 * Tracks six distinct UI states: idle, validating, fetching-perspectives,
 * synthesizing, complete, error. Each state renders differently in the UI.
 */

'use client';

import { useState, useCallback } from 'react';
import type {
  TriangulationState,
  TriangulationResult,
  TriangulateResponse,
  TriangulateErrorResponse,
} from '@/lib/types';

interface UseTriangulateReturn {
  /** Current state of the triangulation pipeline */
  state: TriangulationState;
  /** The result, only available when state is 'complete' */
  result: TriangulationResult | null;
  /** The error message, only available when state is 'error' */
  error: string | null;
  /** Trigger function to start a new triangulation */
  triangulate: (query: string) => Promise<void>;
  /** Reset to idle state */
  reset: () => void;
}

/**
 * Manages the entire client-side state machine for a triangulation request.
 *
 * The state transitions reflect the actual backend pipeline:
 * idle → validating → fetching-perspectives → synthesizing → complete
 *                                                           → error (from any stage)
 */
export function useTriangulate(): UseTriangulateReturn {
  const [state, setState] = useState<TriangulationState>('idle');
  const [result, setResult] = useState<TriangulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setState('idle');
    setResult(null);
    setError(null);
  }, []);

  const triangulate = useCallback(async (query: string) => {
    // Reset previous state
    setResult(null);
    setError(null);

    try {
      // Stage 1: Validating input
      setState('validating');

      // Brief delay so the user sees the validating state
      await new Promise((resolve) => setTimeout(resolve, 400));

      // Stage 2: Fetching perspectives
      setState('fetching-perspectives');

      const response = await fetch('/api/triangulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      // Stage 3: Synthesizing (show while parsing response)
      setState('synthesizing');

      const data: TriangulateResponse | TriangulateErrorResponse =
        await response.json();

      if (!data.success) {
        const errorData = data as TriangulateErrorResponse;
        throw new Error(errorData.error);
      }

      // Brief delay so the user sees the synthesizing state
      await new Promise((resolve) => setTimeout(resolve, 600));

      // Stage 4: Complete
      const successData = data as TriangulateResponse;
      setResult(successData.data);
      setState('complete');
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'An unexpected error occurred. Please try again.';
      setError(message);
      setState('error');
    }
  }, []);

  return { state, result, error, triangulate, reset };
}
