/**
 * Main page — News Triangulator home.
 *
 * Editorial hero with a quiet triangulation wordmark, the input form,
 * multi-stage loading indicator, error state, and results panel.
 */

'use client';

import React from 'react';
import { TriangulatorForm } from '@/components/TriangulatorForm';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ResultsPanel } from '@/components/ResultsPanel';
import { useTriangulate } from '@/hooks/useTriangulate';

export default function HomePage() {
  const { state, result, error, triangulate, reset } = useTriangulate();
  const isLoading =
    state === 'validating' ||
    state === 'fetching-perspectives' ||
    state === 'synthesizing';
  // When there's nothing below the hero, let it fill and center the viewport
  // instead of clinging to the top with a large void beneath.
  const heroOnly = state === 'idle';

  return (
    <main className="min-h-screen flex flex-col">
      {/* ───── Hero Section ───── */}
      <section
        className={`relative px-4 ${
          heroOnly
            ? 'flex-1 flex flex-col justify-center py-12'
            : 'pt-16 pb-8 md:pt-24 md:pb-10'
        }`}
      >
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          {/* Wordmark */}
          <div className="mb-4 flex items-center justify-center gap-3">
            {/* Triangulation mark — three perspectives converging */}
            <svg
              width="28"
              height="28"
              viewBox="0 0 28 28"
              fill="none"
              aria-hidden="true"
              className="flex-shrink-0"
            >
              <path
                d="M14 4 L24 22 L4 22 Z"
                stroke="currentColor"
                strokeWidth="1.25"
                strokeLinejoin="round"
                className="text-ink-700"
              />
              <circle cx="14" cy="4" r="2.6" className="fill-perspective-progressive" />
              <circle cx="4" cy="22" r="2.6" className="fill-perspective-conservative" />
              <circle cx="24" cy="22" r="2.6" className="fill-perspective-international" />
              <circle cx="14" cy="16" r="2" className="fill-core" />
            </svg>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-ink-100">
              News Triangulator
            </h1>
          </div>

          {/* Tagline */}
          <p className="text-ink-300 text-base md:text-lg max-w-xl mx-auto mb-10 leading-relaxed">
            Paste any news story. See how progressive, conservative, and
            international sources covered it — and read the factual core they
            all agree on.
          </p>

          {/* Input form */}
          <TriangulatorForm onSubmit={triangulate} state={state} />
        </div>
      </section>

      {/* ───── Loading State ───── */}
      {isLoading && (
        <section className="px-4">
          <LoadingSpinner state={state} />
        </section>
      )}

      {/* ───── Error State ───── */}
      {state === 'error' && error && (
        <section className="px-4 py-8">
          <div
            className="max-w-2xl mx-auto text-center animate-fade-in"
            role="alert"
          >
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6">
              <div className="flex items-center justify-center gap-2 mb-3">
                <svg
                  className="w-5 h-5 text-red-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <h2 className="text-lg font-semibold text-red-300">
                  Analysis failed
                </h2>
              </div>
              <p className="text-sm text-red-200/90 mb-4">{error}</p>
              <button
                onClick={reset}
                className="text-sm text-ink-300 hover:text-ink-100 underline underline-offset-4 rounded transition-colors"
              >
                Try again
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ───── Results ───── */}
      {state === 'complete' && result && (
        <section className="px-4 py-6">
          <ResultsPanel result={result} />

          {/* New analysis button */}
          <div className="text-center mt-8 pb-6">
            <button
              onClick={reset}
              className="text-sm text-ink-500 hover:text-ink-100 transition-colors underline underline-offset-4 rounded"
            >
              Analyze another story
            </button>
          </div>
        </section>
      )}

      {/* ───── Footer ───── */}
      <footer className="mt-auto px-4 py-4 text-center">
        <p className="text-xs text-ink-500">
          Powered by Tavily (live search) + Groq (Llama 3.3)
        </p>
      </footer>
    </main>
  );
}
