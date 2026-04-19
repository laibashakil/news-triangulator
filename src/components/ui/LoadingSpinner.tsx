/**
 * LoadingSpinner — Animated multi-stage progress indicator.
 *
 * Shows an animated spinner with a human-readable label that
 * changes based on the current triangulation state.
 */

'use client';

import React from 'react';
import type { TriangulationState } from '@/lib/types';

interface LoadingSpinnerProps {
  /** Current state of the triangulation pipeline */
  state: TriangulationState;
  /** Additional CSS classes */
  className?: string;
}

/** Detailed sub-stage labels shown during the fetching phase */
const LOADING_STAGES = [
  'Searching progressive sources...',
  'Searching conservative sources...',
  'Searching international sources...',
];

/** Maps pipeline states to user-facing labels */
const STATE_MESSAGES: Partial<Record<TriangulationState, string>> = {
  validating: 'Checking if this is a news story...',
  'fetching-perspectives': 'Searching multiple perspectives...',
  synthesizing: 'Synthesizing the truth layer...',
};

export function LoadingSpinner({ state, className = '' }: LoadingSpinnerProps) {
  const [stageIndex, setStageIndex] = React.useState(0);

  // Cycle through sub-stages during perspective fetching
  React.useEffect(() => {
    if (state !== 'fetching-perspectives') {
      setStageIndex(0);
      return;
    }

    const interval = setInterval(() => {
      setStageIndex((prev) => (prev + 1) % LOADING_STAGES.length);
    }, 2500);

    return () => clearInterval(interval);
  }, [state]);

  const message =
    state === 'fetching-perspectives'
      ? LOADING_STAGES[stageIndex]
      : STATE_MESSAGES[state] ?? '';

  if (!message) return null;

  return (
    <div
      className={`flex flex-col items-center gap-6 py-12 animate-fade-in ${className}`}
      role="status"
      aria-live="polite"
    >
      {/* Animated triangulation symbol */}
      <div className="relative w-20 h-20">
        {/* Outer rotating ring */}
        <div className="absolute inset-0 rounded-full border-2 border-surface-border animate-spin" 
             style={{ animationDuration: '3s' }} />
        
        {/* Three perspective dots */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1">
          <div className="w-3 h-3 rounded-full bg-perspective-progressive animate-pulse" />
        </div>
        <div className="absolute bottom-1 left-1 ">
          <div className="w-3 h-3 rounded-full bg-perspective-conservative animate-pulse"
               style={{ animationDelay: '0.5s' }} />
        </div>
        <div className="absolute bottom-1 right-1">
          <div className="w-3 h-3 rounded-full bg-perspective-international animate-pulse"
               style={{ animationDelay: '1s' }} />
        </div>

        {/* Center glow */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-4 h-4 rounded-full bg-white/20 animate-pulse-slow" />
        </div>
      </div>

      {/* Stage label */}
      <div className="text-center">
        <p className="text-offwhite/80 text-sm font-medium tracking-wide">
          {message}
        </p>
        <div className="mt-3 flex gap-1.5 justify-center">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all duration-500 ${
                state === 'fetching-perspectives' && i === stageIndex
                  ? 'w-8 bg-perspective-progressive'
                  : state === 'synthesizing'
                  ? 'w-8 bg-white/40'
                  : 'w-2 bg-white/20'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
