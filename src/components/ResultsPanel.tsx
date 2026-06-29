/**
 * ResultsPanel — Orchestrates the full results display.
 *
 * Leads with the factual core (the destination of the analysis), then shows
 * how each perspective framed the story as supporting evidence, and closes
 * with provenance: the sources consulted and the analysis timestamp.
 */

import React from 'react';
import type { TriangulationResult } from '@/lib/types';
import { PerspectiveComparison } from './PerspectiveComparison';
import { ConsensusLayer } from './ConsensusLayer';
import { SourceChip } from './SourceChip';

interface ResultsPanelProps {
  /** The complete triangulation result */
  result: TriangulationResult;
}

export function ResultsPanel({ result }: ResultsPanelProps) {
  const {
    perspectives,
    consensusFacts,
    spinIndicators,
    strippedTruth,
    storyQuery,
    consultedSources,
  } = result;

  return (
    <div className="w-full max-w-7xl mx-auto space-y-12 animate-fade-in">
      {/* Story query echo */}
      <div className="text-center">
        <p className="text-xs text-ink-500 uppercase tracking-[0.2em] mb-2">
          Analysis of
        </p>
        <p className="font-display text-lg md:text-xl text-ink-100 max-w-2xl mx-auto italic leading-snug">
          &ldquo;{storyQuery}&rdquo;
        </p>
      </div>

      {/* The factual core — the payoff, shown first */}
      <ConsensusLayer
        consensusFacts={consensusFacts}
        strippedTruth={strippedTruth}
      />

      {/* How each side framed it — supporting evidence */}
      <PerspectiveComparison
        perspectives={perspectives}
        spinIndicators={spinIndicators}
      />

      {/* Provenance: consulted sources + timestamp */}
      <div className="border-t border-surface-border pt-6 space-y-4">
        {consultedSources && consultedSources.length > 0 && (
          <div className="text-center">
            <p className="text-xs text-ink-500 uppercase tracking-wider mb-3">
              Sources consulted
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {consultedSources.slice(0, 12).map((source, index) => (
                <SourceChip
                  key={`consulted-${index}`}
                  source={source}
                  variant="neutral"
                />
              ))}
            </div>
          </div>
        )}

        <p className="text-center text-xs text-ink-500 font-mono">
          Analyzed{' '}
          {new Date(result.processedAt).toLocaleString(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
        </p>
      </div>
    </div>
  );
}
