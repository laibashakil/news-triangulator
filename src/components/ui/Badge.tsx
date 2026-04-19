/**
 * Badge — Small colored label for tone indicators and tags.
 *
 * Used primarily to show the AI-assigned tone for each perspective
 * (e.g., "critical", "alarmed", "measured").
 */

import React from 'react';
import type { PerspectiveLabel } from '@/lib/types';

interface BadgeProps {
  /** Text content of the badge */
  children: React.ReactNode;
  /** Color variant matching a perspective */
  variant?: PerspectiveLabel | 'neutral';
  /** Additional CSS classes */
  className?: string;
}

const VARIANT_STYLES = {
  progressive:
    'bg-perspective-progressive/15 text-perspective-progressive border-perspective-progressive/30',
  conservative:
    'bg-perspective-conservative/15 text-perspective-conservative border-perspective-conservative/30',
  international:
    'bg-perspective-international/15 text-perspective-international border-perspective-international/30',
  neutral: 'bg-white/10 text-offwhite/80 border-white/20',
} as const;

export function Badge({
  children,
  variant = 'neutral',
  className = '',
}: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center px-2.5 py-0.5
        text-xs font-medium rounded-full border
        ${VARIANT_STYLES[variant]}
        ${className}
      `}
    >
      {children}
    </span>
  );
}
