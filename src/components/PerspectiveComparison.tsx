/**
 * PerspectiveComparison — how each side framed the story, built for scanning.
 *
 * Desktop: an aligned comparison grid. A shared label rail (Sources / Summary /
 * Unique angle / Spin) runs down the left so the three perspectives read as
 * aligned rows — true triangulation, not three independent blurbs.
 *
 * Mobile: an accessible tab strip (one perspective at a time) with full
 * keyboard support, since side-by-side comparison can't fit a phone.
 *
 * Surfaces `spinIndicators` — how each perspective framed the same facts —
 * which the rest of the UI previously never rendered.
 */

'use client';

import React, { useId, useRef, useState } from 'react';
import type {
  Perspective,
  PerspectiveLabel,
  SpinIndicators,
} from '@/lib/types';
import { Badge } from './ui/Badge';
import { SourceChip } from './SourceChip';
import { VertexMark } from './ui/VertexMark';
import { TriangleDiagram } from './ui/TriangleDiagram';

interface PerspectiveComparisonProps {
  perspectives: Perspective[];
  spinIndicators: SpinIndicators;
}

const TITLES: Record<PerspectiveLabel, string> = {
  progressive: 'Progressive',
  conservative: 'Conservative',
  international: 'International',
};

const ACCENT_TEXT: Record<PerspectiveLabel, string> = {
  progressive: 'text-perspective-progressive',
  conservative: 'text-perspective-conservative',
  international: 'text-perspective-international',
};

const ACCENT_RULE: Record<PerspectiveLabel, string> = {
  progressive: 'bg-perspective-progressive',
  conservative: 'bg-perspective-conservative',
  international: 'bg-perspective-international',
};

const ACCENT_BORDER_L: Record<PerspectiveLabel, string> = {
  progressive: 'border-perspective-progressive/40',
  conservative: 'border-perspective-conservative/40',
  international: 'border-perspective-international/40',
};

const ROW_LABELS = ['Sources', 'Summary', 'Unique angle', 'Spin & framing'];

/* ── Presentational cells (shared by desktop grid and mobile panel) ── */

function PerspectiveHeading({ p }: { p: Perspective }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h3 className={`flex items-center gap-2 text-base font-semibold ${ACCENT_TEXT[p.label]}`}>
        <VertexMark label={p.label} />
        {TITLES[p.label]}
      </h3>
      {p.tone && <Badge variant={p.label}>{p.tone}</Badge>}
    </div>
  );
}

function SourcesCell({ p }: { p: Perspective }) {
  if (p.sources.length === 0) {
    return <p className="text-xs text-ink-500">No sources cited.</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {p.sources.slice(0, 6).map((source, i) => (
        <SourceChip key={`${p.label}-src-${i}`} source={source} variant={p.label} />
      ))}
    </div>
  );
}

function SummaryCell({ p }: { p: Perspective }) {
  return (
    <div className="text-sm text-ink-300 leading-relaxed">
      {p.summary.split('\n').map((para, i) => (
        <p key={`${p.label}-sum-${i}`} className={i > 0 ? 'mt-2' : ''}>
          {para}
        </p>
      ))}
    </div>
  );
}

function ClaimList({
  label,
  items,
  emptyText,
}: {
  label: PerspectiveLabel;
  items: string[];
  emptyText: string;
}) {
  if (!items || items.length === 0) {
    return <p className="text-xs text-ink-500">{emptyText}</p>;
  }
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li
          key={`${label}-claim-${i}`}
          className={`text-xs text-ink-300 leading-relaxed pl-3 border-l-2 ${ACCENT_BORDER_L[label]}`}
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

/* ──────────────────────── Component ──────────────────────── */

export function PerspectiveComparison({
  perspectives,
  spinIndicators,
}: PerspectiveComparisonProps) {
  const [active, setActive] = useState(0);
  const tabBaseId = useId();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function focusTab(index: number) {
    const next = (index + perspectives.length) % perspectives.length;
    setActive(next);
    tabRefs.current[next]?.focus();
  }

  function onTabKeyDown(e: React.KeyboardEvent, index: number) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      focusTab(index + 1);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      focusTab(index - 1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      focusTab(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      focusTab(perspectives.length - 1);
    }
  }

  return (
    <section aria-labelledby="framing-heading">
      <div className="flex items-center gap-3 mb-5">
        <TriangleDiagram />
        <h2
          id="framing-heading"
          className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-500"
        >
          How each side framed it
        </h2>
      </div>

      {/* ─── Desktop: aligned comparison grid ─── */}
      <div className="hidden lg:grid grid-cols-[8rem_repeat(3,minmax(0,1fr))] gap-x-6">
        {/* Header row: empty corner + three perspective headers */}
        <div aria-hidden="true" />
        {perspectives.map((p) => (
          <div key={`head-${p.label}`} className="pb-4">
            <div className={`h-0.5 w-full rounded-full mb-3 ${ACCENT_RULE[p.label]}`} />
            <PerspectiveHeading p={p} />
          </div>
        ))}

        {/* Sources row */}
        <RailLabel>{ROW_LABELS[0]}</RailLabel>
        {perspectives.map((p) => (
          <Cell key={`src-${p.label}`}>
            <SourcesCell p={p} />
          </Cell>
        ))}

        {/* Summary row */}
        <RailLabel>{ROW_LABELS[1]}</RailLabel>
        {perspectives.map((p) => (
          <Cell key={`sum-${p.label}`}>
            <SummaryCell p={p} />
          </Cell>
        ))}

        {/* Unique angle row */}
        <RailLabel>{ROW_LABELS[2]}</RailLabel>
        {perspectives.map((p) => (
          <Cell key={`uniq-${p.label}`}>
            <ClaimList
              label={p.label}
              items={p.uniqueClaims}
              emptyText="Nothing unique to this version."
            />
          </Cell>
        ))}

        {/* Spin & framing row */}
        <RailLabel>{ROW_LABELS[3]}</RailLabel>
        {perspectives.map((p) => (
          <Cell key={`spin-${p.label}`}>
            <ClaimList
              label={p.label}
              items={spinIndicators[p.label]}
              emptyText="No distinct spin detected."
            />
          </Cell>
        ))}
      </div>

      {/* ─── Mobile: tabbed single perspective ─── */}
      <div className="lg:hidden">
        <div
          role="tablist"
          aria-label="Perspectives"
          className="flex gap-1 p-1 rounded-lg bg-surface border border-surface-border mb-5"
        >
          {perspectives.map((p, i) => {
            const selected = i === active;
            return (
              <button
                key={`tab-${p.label}`}
                ref={(el) => {
                  tabRefs.current[i] = el;
                }}
                role="tab"
                id={`${tabBaseId}-tab-${i}`}
                aria-selected={selected}
                aria-controls={`${tabBaseId}-panel-${i}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActive(i)}
                onKeyDown={(e) => onTabKeyDown(e, i)}
                className={`
                  flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-md
                  text-xs font-medium transition-colors
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-core/60
                  ${
                    selected
                      ? `bg-surface-hover ${ACCENT_TEXT[p.label]}`
                      : 'text-ink-500 hover:text-ink-300'
                  }
                `}
              >
                <VertexMark label={p.label} size={14} />
                {TITLES[p.label]}
              </button>
            );
          })}
        </div>

        {perspectives.map((p, i) => (
          <div
            key={`panel-${p.label}`}
            role="tabpanel"
            id={`${tabBaseId}-panel-${i}`}
            aria-labelledby={`${tabBaseId}-tab-${i}`}
            hidden={i !== active}
            className="space-y-5"
          >
            <div className={`h-0.5 w-full rounded-full ${ACCENT_RULE[p.label]}`} />
            <PerspectiveHeading p={p} />

            <MobileRow label={ROW_LABELS[0]}>
              <SourcesCell p={p} />
            </MobileRow>
            <MobileRow label={ROW_LABELS[1]}>
              <SummaryCell p={p} />
            </MobileRow>
            <MobileRow label={ROW_LABELS[2]}>
              <ClaimList
                label={p.label}
                items={p.uniqueClaims}
                emptyText="Nothing unique to this version."
              />
            </MobileRow>
            <MobileRow label={ROW_LABELS[3]}>
              <ClaimList
                label={p.label}
                items={spinIndicators[p.label]}
                emptyText="No distinct spin detected."
              />
            </MobileRow>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── Layout primitives ── */

function RailLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-t border-surface-border pt-4 mt-4 text-xs font-semibold uppercase tracking-wider text-ink-500">
      {children}
    </div>
  );
}

function Cell({ children }: { children: React.ReactNode }) {
  return <div className="border-t border-surface-border pt-4 mt-4">{children}</div>;
}

function MobileRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-ink-500 mb-2">
        {label}
      </p>
      {children}
    </div>
  );
}
