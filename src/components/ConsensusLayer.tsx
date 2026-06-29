/**
 * ConsensusLayer — The factual core: what every source agrees on, and the
 * story with all editorial framing removed.
 *
 * This is the destination of the whole analysis, so it is the one place on
 * the page with warm "paper" color and the editorial serif — everything else
 * converges toward it.
 */

import React from 'react';

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
    <section
      aria-labelledby="core-heading"
      id="consensus-layer"
      className="
        animate-slide-up relative overflow-hidden rounded-xl
        border border-core/20 bg-gradient-to-b from-core/[0.06] to-transparent
        p-6 md:p-10
        shadow-[0_0_80px_-24px_rgba(245,239,227,0.18)]
      "
    >
      {/* Eyebrow */}
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-core-dim mb-6">
        The factual core
      </p>

      <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-8 lg:gap-14">
        {/* Consensus facts */}
        <div>
          <h2
            id="core-heading"
            className="font-display text-2xl md:text-3xl font-semibold text-core mb-5 leading-tight"
          >
            What every source agrees on
          </h2>

          <ul className="space-y-3">
            {consensusFacts.map((fact, index) => (
              <li
                key={`consensus-${index}`}
                className="flex items-start gap-3 text-ink-100"
              >
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-core/15 flex items-center justify-center mt-0.5">
                  <span className="text-[11px] font-mono font-medium text-core">
                    {index + 1}
                  </span>
                </span>
                <span className="text-[15px] leading-relaxed">{fact}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Stripped truth — the story, set as editorial prose */}
        <div className="border-t border-core/15 pt-8 mt-2 lg:border-t-0 lg:pt-0 lg:mt-0 lg:border-l lg:border-core/15 lg:pl-14">
          <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-core-dim mb-4">
            The story without the framing
          </h3>

          <div className="font-display text-lg md:text-xl text-core/95 leading-relaxed">
            {strippedTruth.split('\n').map((paragraph, index) => (
              <p key={`truth-${index}`} className={index > 0 ? 'mt-4' : ''}>
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
