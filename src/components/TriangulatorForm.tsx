/**
 * TriangulatorForm — Main input form for news stories.
 *
 * Features a large textarea with focus glow, character counter,
 * and a prominent submit button. Handles form submission and
 * passes the query to the parent via callback.
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

const PLACEHOLDER_TEXT = `Paste a news headline, story, or claim...

Examples:
• "US Federal Reserve holds interest rates steady"
• "New climate agreement reached at UN summit"
• "Tech company announces major layoffs"`;

export function TriangulatorForm({ onSubmit, state }: TriangulatorFormProps) {
  const [query, setQuery] = useState('');
  const isProcessing = state !== 'idle' && state !== 'complete' && state !== 'error';
  const charCount = query.length;
  const isOverLimit = charCount > MAX_QUERY_LENGTH;
  const canSubmit = query.trim().length > 0 && !isOverLimit && !isProcessing;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (canSubmit) {
      onSubmit(query.trim());
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-3xl mx-auto">
      <div className="relative group">
        {/* Glow effect on focus */}
        <div className="absolute -inset-0.5 bg-gradient-to-r from-perspective-progressive/20 via-perspective-conservative/20 to-perspective-international/20 rounded-xl blur opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />

        <div className="relative">
          <textarea
            id="story-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={PLACEHOLDER_TEXT}
            disabled={isProcessing}
            rows={8}
            className={`
              w-full px-5 py-4 rounded-xl
              bg-navy-light border-2 transition-all duration-300
              text-offwhite placeholder-white/30
              text-base leading-relaxed resize-none
              focus:outline-none
              disabled:opacity-50 disabled:cursor-not-allowed
              ${
                isOverLimit
                  ? 'border-red-500/60 focus:border-red-500'
                  : 'border-surface-border focus:border-perspective-progressive/50'
              }
            `}
          />

          {/* Character counter */}
          <div className="absolute bottom-3 right-3 flex items-center gap-2">
            <span
              className={`text-xs font-mono ${
                isOverLimit ? 'text-red-400' : 'text-white/30'
              }`}
            >
              {charCount}/{MAX_QUERY_LENGTH}
            </span>
          </div>
        </div>
      </div>

      {/* Submit button */}
      <div className="mt-4 flex justify-center">
        <Button
          id="triangulate-button"
          type="submit"
          loading={isProcessing}
          disabled={!canSubmit}
          className="min-w-[200px]"
        >
          {isProcessing ? 'Triangulating...' : 'Triangulate This Story'}
        </Button>
      </div>
    </form>
  );
}
