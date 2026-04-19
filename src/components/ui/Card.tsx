/**
 * Card — Glass-morphism container component.
 *
 * Provides a subtle semi-transparent background with border,
 * used throughout the app for content grouping.
 */

import React from 'react';

interface CardProps {
  /** Card content */
  children: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Optional accent color for the top border */
  accentColor?: 'progressive' | 'conservative' | 'international' | 'white';
  /** Unique identifier for testing */
  id?: string;
}

const ACCENT_COLORS = {
  progressive: 'border-t-perspective-progressive',
  conservative: 'border-t-perspective-conservative',
  international: 'border-t-perspective-international',
  white: 'border-t-white',
} as const;

export function Card({
  children,
  className = '',
  accentColor,
  id,
}: CardProps) {
  const accentClass = accentColor
    ? `border-t-2 ${ACCENT_COLORS[accentColor]}`
    : '';

  return (
    <div
      id={id}
      className={`
        bg-surface rounded-xl border border-surface-border
        backdrop-blur-sm
        ${accentClass}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
