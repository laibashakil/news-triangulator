/**
 * PerspectiveColumn — Displays a single perspective's coverage analysis.
 *
 * Shows the perspective label, source chips (real outlets from Search
 * Grounding), coverage summary, tone badge, and unique claims callouts.
 */

import React from 'react';
import type { Perspective, PerspectiveLabel } from '@/lib/types';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { SourceChip } from './SourceChip';

interface PerspectiveColumnProps {
  /** The perspective data to display */
  perspective: Perspective;
}

/** Human-readable labels for each perspective */
const PERSPECTIVE_TITLES: Record<PerspectiveLabel, string> = {
  progressive: 'Progressive',
  conservative: 'Conservative',
  international: 'International',
};

/** Icons for each perspective (simple emoji for clarity) */
const PERSPECTIVE_ICONS: Record<PerspectiveLabel, string> = {
  progressive: '🔶',
  conservative: '🔷',
  international: '🌍',
};

/** Accent text colors for each perspective */
const ACCENT_TEXT: Record<PerspectiveLabel, string> = {
  progressive: 'text-perspective-progressive',
  conservative: 'text-perspective-conservative',
  international: 'text-perspective-international',
};

export function PerspectiveColumn({ perspective }: PerspectiveColumnProps) {
  const { label, sources, summary, uniqueClaims, tone } = perspective;

  return (
    <Card
      accentColor={label}
      className="p-5 flex flex-col gap-4 animate-slide-up"
      id={`perspective-${label}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className={`text-lg font-semibold ${ACCENT_TEXT[label]}`}>
          <span className="mr-2">{PERSPECTIVE_ICONS[label]}</span>
          {PERSPECTIVE_TITLES[label]}
        </h3>
        <Badge variant={label}>{tone}</Badge>
      </div>

      {/* Source chips */}
      {sources.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {sources.slice(0, 6).map((source, index) => (
            <SourceChip
              key={`${label}-source-${index}`}
              source={source}
              variant={label}
            />
          ))}
        </div>
      )}

      {/* Coverage summary */}
      <div className="text-sm text-offwhite/75 leading-relaxed">
        {summary.split('\n').map((paragraph, index) => (
          <p key={`${label}-p-${index}`} className={index > 0 ? 'mt-2' : ''}>
            {paragraph}
          </p>
        ))}
      </div>

      {/* Unique claims callout */}
      <div className="mt-auto pt-3 border-t border-surface-border">
        <h4 className="text-xs font-semibold text-offwhite/50 uppercase tracking-wider mb-2">
          What only this version said
        </h4>
        <ul className="space-y-2">
          {uniqueClaims.map((claim, index) => (
            <li
              key={`${label}-claim-${index}`}
              className={`
                text-xs text-offwhite/65 leading-relaxed
                pl-3 border-l-2
                ${
                  label === 'progressive'
                    ? 'border-l-perspective-progressive/40'
                    : label === 'conservative'
                    ? 'border-l-perspective-conservative/40'
                    : 'border-l-perspective-international/40'
                }
              `}
            >
              {claim}
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
