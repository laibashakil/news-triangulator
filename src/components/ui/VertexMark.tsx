/**
 * VertexMark — geometric marker for a perspective.
 *
 * Each perspective is one vertex of the triangulation triangle: progressive
 * at the top, conservative bottom-left, international bottom-right. The shared
 * triangle outline reads the same everywhere; only the highlighted vertex (and
 * its accent color) changes — so perspectives are distinguished by position as
 * well as color, never by color alone.
 */

import React from 'react';
import type { PerspectiveLabel } from '@/lib/types';

interface VertexMarkProps {
  label: PerspectiveLabel;
  /** Pixel size of the square mark. */
  size?: number;
  className?: string;
}

/** Triangle vertices in a 16×16 viewBox. */
const VERTICES: Record<PerspectiveLabel, { cx: number; cy: number }> = {
  progressive: { cx: 8, cy: 2.5 },
  conservative: { cx: 2.5, cy: 13.5 },
  international: { cx: 13.5, cy: 13.5 },
};

const ACCENT: Record<PerspectiveLabel, string> = {
  progressive: 'text-perspective-progressive',
  conservative: 'text-perspective-conservative',
  international: 'text-perspective-international',
};

export function VertexMark({ label, size = 16, className = '' }: VertexMarkProps) {
  const { cx, cy } = VERTICES[label];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className={`${ACCENT[label]} ${className}`}
    >
      {/* Shared triangle outline */}
      <path
        d="M8 2.5 L13.5 13.5 L2.5 13.5 Z"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinejoin="round"
        className="opacity-30"
      />
      {/* Highlighted vertex for this perspective */}
      <circle cx={cx} cy={cy} r="2.4" fill="currentColor" />
    </svg>
  );
}
