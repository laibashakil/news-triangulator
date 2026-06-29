/**
 * TriangulatorForm — Main input form for news stories.
 *
 * A large textarea with a visually-hidden label, quick-fill example chips,
 * a character counter that appears only near the limit, and a prominent
 * submit button. Passes the query to the parent via callback.
 */

'use client';

import React, { useState } from 'react';
import { Button } from './ui/Button';
import type { TriangulationState } from '@/lib/types';

interface TriangulatorFormProps {
  /** Callback when the form is submitted with a valid query */
  onSubmit: (query: string) => void;
  /** Current triangulation state (used to disable form during processing) */
  state: TriangulationState;
}

const MAX_QUERY_LENGTH = 2000;

/** Threshold past which the character counter becomes relevant. */
const COUNTER_VISIBLE_AT = Math.floor(MAX_QUERY_LENGTH * 0.8);

const PLACEHOLDER_TEXT = 'Paste a news headline, story, or claim…';

const EXAMPLES = [
  'US Federal Reserve holds interest rates steady',
  'New climate agreement reached at UN summit',
  'Tech company announces major layoffs',
];

export function TriangulatorForm({ onSubmit, state }: TriangulatorFormProps) {
  const [query, setQuery] = useState('');
  const isProcessing =
    state !== 'idle' && state !== 'complete' && state !== 'error';
  const charCount = query.length;
  const isOverLimit = charCount > MAX_QUERY_LENGTH;
  const showCounter = charCount >= COUNTER_VISIBLE_AT;
  const canSubmit = query.trim().length > 0 && !isOverLimit && !isProcessing;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (canSubmit) {
      onSubmit(query.trim());
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-3xl mx-auto">
      <label htmlFor="story-input" className="sr-only">
        News story, headline, or claim to triangulate
      </label>

      <div className="relative">
        <textarea
          id="story-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={PLACEHOLDER_TEXT}
          disabled={isProcessing}
          rows={6}
          aria-describedby={showCounter ? 'char-counter' : undefined}
          aria-invalid={isOverLimit}
          className={`
            w-full px-5 py-4 rounded-lg
            bg-navy-light border transition-colors duration-200
            text-ink-100 placeholder-ink-500
            text-base leading-relaxed resize-none
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-navy
            disabled:opacity-50 disabled:cursor-not-allowed
            ${
              isOverLimit
                ? 'border-red-500/60 focus-visible:ring-red-500'
                : 'border-surface-border focus-visible:border-core/40 focus-visible:ring-core/50'
            }
          `}
        />

        {/* Character counter — only relevant near the limit */}
        {showCounter && (
          <div
            id="char-counter"
            aria-live="polite"
            className="absolute bottom-3 right-3"
          >
            <span
              className={`text-xs font-mono ${
                isOverLimit ? 'text-red-300' : 'text-ink-500'
              }`}
            >
              {charCount}/{MAX_QUERY_LENGTH}
            </span>
          </div>
        )}
      </div>

      {/* Quick-fill examples */}
      {!isProcessing && query.trim().length === 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <span className="text-xs text-ink-500 mr-1">Try:</span>
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => setQuery(example)}
              className="
                px-3 py-1 rounded-full text-xs text-ink-300
                border border-surface-border bg-surface
                hover:bg-surface-hover hover:text-ink-100 hover:border-white/20
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-core/60
                transition-colors
              "
            >
              {example}
            </button>
          ))}
        </div>
      )}

      {/* Submit button */}
      <div className="mt-6 flex justify-center">
        <Button
          id="triangulate-button"
          type="submit"
          loading={isProcessing}
          disabled={!canSubmit}
          className="min-w-[200px]"
        >
          {isProcessing ? 'Triangulating…' : 'Triangulate this story'}
        </Button>
      </div>
    </form>
  );
}
