/**
 * SourceChip — Clickable pill displaying a news outlet name.
 *
 * Shows the actual outlet names returned by the live news search.
 * Each chip links to the source URL, providing credibility through
 * transparency — users can verify these are real sources.
 */

import React from 'react';
import type { Source, PerspectiveLabel } from '@/lib/types';

interface SourceChipProps {
  /** The source to display */
  source: Source;
  /** Color variant — a perspective accent, or neutral for combined sources */
  variant: PerspectiveLabel | 'neutral';
}

const VARIANT_STYLES = {
  progressive:
    'hover:bg-perspective-progressive/15 hover:border-perspective-progressive/40 focus-visible:ring-perspective-progressive/70',
  conservative:
    'hover:bg-perspective-conservative/15 hover:border-perspective-conservative/40 focus-visible:ring-perspective-conservative/70',
  international:
    'hover:bg-perspective-international/15 hover:border-perspective-international/40 focus-visible:ring-perspective-international/70',
  neutral:
    'hover:bg-surface-hover hover:border-white/25 focus-visible:ring-core/60',
} as const;

export function SourceChip({ source, variant }: SourceChipProps) {
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      title={`Read on ${source.name}`}
      className={`
        inline-flex items-center gap-1.5 px-3 py-1
        text-xs font-medium text-ink-300
        bg-white/5 border border-white/10 rounded-full
        transition-colors duration-200
        hover:text-ink-100
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-navy
        ${VARIANT_STYLES[variant]}
      `}
    >
      <span className="truncate max-w-[150px]">{source.name}</span>
      {/* External link icon */}
      <svg
        className="w-3 h-3 flex-shrink-0 opacity-60"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
        />
      </svg>
    </a>
  );
}
