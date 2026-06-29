/**
 * TriangleDiagram — the triangulation thesis as a small diagram.
 *
 * Three perspective vertices (progressive top, conservative bottom-left,
 * international bottom-right) with faint lines converging on the paper `core`
 * centroid: the three framings resolve to one factual core. Used as a quiet
 * anchor for the "how each side framed it" section.
 */

import React from 'react';

interface TriangleDiagramProps {
  size?: number;
  className?: string;
}

// Vertices and centroid in an 88×76 viewBox.
const TOP = { x: 44, y: 9 };
const BL = { x: 9, y: 67 };
const BR = { x: 79, y: 67 };
const CORE = { x: 44, y: 47.7 }; // centroid

export function TriangleDiagram({ size = 44, className = '' }: TriangleDiagramProps) {
  return (
    <svg
      width={size}
      height={(size * 76) / 88}
      viewBox="0 0 88 76"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      {/* Triangle edges */}
      <path
        d={`M${TOP.x} ${TOP.y} L${BR.x} ${BR.y} L${BL.x} ${BL.y} Z`}
        stroke="currentColor"
        strokeWidth="1"
        strokeLinejoin="round"
        className="text-ink-700"
      />
      {/* Convergence lines to the core */}
      {[TOP, BL, BR].map((v, i) => (
        <line
          key={i}
          x1={v.x}
          y1={v.y}
          x2={CORE.x}
          y2={CORE.y}
          stroke="#F5EFE3"
          strokeWidth="0.75"
          className="opacity-25"
        />
      ))}
      {/* Core centroid */}
      <circle cx={CORE.x} cy={CORE.y} r="3.4" fill="#F5EFE3" />
      {/* Perspective vertices */}
      <circle cx={TOP.x} cy={TOP.y} r="4" className="fill-perspective-progressive" />
      <circle cx={BL.x} cy={BL.y} r="4" className="fill-perspective-conservative" />
      <circle cx={BR.x} cy={BR.y} r="4" className="fill-perspective-international" />
    </svg>
  );
}
