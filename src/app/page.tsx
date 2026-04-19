/**
 * Main page — News Triangulator home.
 *
 * Full-width hero section with app branding, input form,
 * multi-stage loading indicator, and results panel.
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

  return (
    <main className="min-h-screen flex flex-col">
      {/* ───── Hero Section ───── */}
      <section className="relative px-4 pt-16 pb-12 md:pt-24 md:pb-16">
        {/* Subtle gradient background */}
        <div className="absolute inset-0 bg-gradient-to-b from-navy via-navy to-navy-light pointer-events-none" />

        {/* Decorative glow orbs */}
        <div className="absolute top-20 left-1/4 w-64 h-64 bg-perspective-progressive/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-32 right-1/4 w-48 h-48 bg-perspective-conservative/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-40 left-1/2 w-56 h-56 bg-perspective-international/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          {/* App title */}
          <div className="mb-3 flex items-center justify-center gap-2">
            <span className="text-2xl" aria-hidden="true">🔺</span>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-perspective-progressive via-white to-perspective-conservative">
                News Triangulator
              </span>
            </h1>
          </div>

          {/* Tagline */}
          <p className="text-offwhite/60 text-base md:text-lg max-w-xl mx-auto mb-10 leading-relaxed">
            Paste any news story. See how progressive, conservative, and
            international sources covered it. Read what every version actually
            agrees on.
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
          <div className="max-w-2xl mx-auto text-center animate-fade-in">
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6">
              <div className="flex items-center justify-center gap-2 mb-3">
                <svg
                  className="w-5 h-5 text-red-400"
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
                <h2 className="text-lg font-semibold text-red-400">
                  Analysis Failed
                </h2>
              </div>
              <p className="text-sm text-red-300/80 mb-4">{error}</p>
              <button
                onClick={reset}
                className="text-sm text-offwhite/60 hover:text-offwhite underline underline-offset-2 transition-colors"
              >
                Try again
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ───── Results ───── */}
      {state === 'complete' && result && (
        <section className="px-4 py-8">
          <ResultsPanel result={result} />

          {/* New analysis button */}
          <div className="text-center mt-8 pb-12">
            <button
              onClick={reset}
              className="text-sm text-offwhite/40 hover:text-offwhite/70 transition-colors underline underline-offset-4"
            >
              Analyze another story
            </button>
          </div>
        </section>
      )}

      {/* ───── Footer ───── */}
      <footer className="mt-auto px-4 py-6 text-center">
        <p className="text-xs text-offwhite/20">
          Powered by Gemini 2.5 Flash with Google Search Grounding
        </p>
      </footer>
    </main>
  );
}
