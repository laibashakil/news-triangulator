/**
 * ResultsPanel — Orchestrates the full results display.
 *
 * Renders the three perspective columns in a responsive grid
 * and the consensus layer below. Handles skeleton loading states
 * when data hasn't arrived yet.
 */

import React from 'react';
import type { TriangulationResult } from '@/lib/types';
import { PerspectiveColumn } from './PerspectiveColumn';
import { ConsensusLayer } from './ConsensusLayer';

interface ResultsPanelProps {
  /** The complete triangulation result */
  result: TriangulationResult;
}

export function ResultsPanel({ result }: ResultsPanelProps) {
  const { perspectives, consensusFacts, strippedTruth, storyQuery } = result;

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* Story query echo */}
      <div className="text-center">
        <p className="text-xs text-offwhite/40 uppercase tracking-wider mb-1">
          Analysis of
        </p>
        <p className="text-sm text-offwhite/60 max-w-2xl mx-auto italic">
          &ldquo;{storyQuery}&rdquo;
        </p>
      </div>

      {/* Three-column perspective grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="perspectives-grid">
        {perspectives.map((perspective) => (
          <PerspectiveColumn
            key={perspective.label}
            perspective={perspective}
          />
        ))}
      </div>

      {/* Consensus layer — the payoff */}
      <ConsensusLayer
        consensusFacts={consensusFacts}
        strippedTruth={strippedTruth}
      />

      {/* Timestamp */}
      <div className="text-center pb-8">
        <p className="text-xs text-offwhite/30">
          Analyzed at{' '}
          {new Date(result.processedAt).toLocaleString(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
        </p>
      </div>
    </div>
  );
}
