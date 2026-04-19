/**
 * ConsensusLayer — The payoff section showing what all sources agree on.
 *
 * This is the most visually prominent element on the results page.
 * It shows the consensus facts as a clean list and the stripped truth
 * paragraph underneath.
 */

import React from 'react';
import { Card } from './ui/Card';

interface ConsensusLayerProps {
  /** Facts that all three perspectives agree on */
  consensusFacts: string[];
  /** Factual skeleton of the story with all editorial framing removed */
  strippedTruth: string;
}

export function ConsensusLayer({
  consensusFacts,
  strippedTruth,
}: ConsensusLayerProps) {
  return (
    <div className="animate-slide-up" style={{ animationDelay: '0.3s' }}>
      <Card accentColor="white" className="p-6 md:p-8" id="consensus-layer">
        {/* Consensus facts section */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
              <svg
                className="w-4 h-4 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white">
              What every source agrees on
            </h2>
          </div>

          <ul className="space-y-3">
            {consensusFacts.map((fact, index) => (
              <li
                key={`consensus-${index}`}
                className="flex items-start gap-3 text-offwhite/85"
              >
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-white/10 flex items-center justify-center mt-0.5">
                  <span className="text-xs font-bold text-white/60">
                    {index + 1}
                  </span>
                </span>
                <span className="text-sm leading-relaxed">{fact}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Divider */}
        <div className="border-t border-white/10 my-6" />

        {/* Stripped truth section */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
              <svg
                className="w-4 h-4 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
                />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-white/80">
              The story without the framing
            </h2>
          </div>

          <div className="text-sm text-offwhite/65 leading-relaxed pl-11">
            {strippedTruth.split('\n').map((paragraph, index) => (
              <p
                key={`truth-${index}`}
                className={index > 0 ? 'mt-3' : ''}
              >
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
