/**
 * Button — Primary UI action component.
 *
 * Supports primary/secondary variants, loading state with spinner,
 * and disabled state. Uses perspective accent colors when needed.
 */

'use client';

import React from 'react';

interface ButtonProps {
  /** Button content */
  children: React.ReactNode;
  /** Click handler */
  onClick?: () => void;
  /** Visual variant */
  variant?: 'primary' | 'secondary';
  /** Show loading spinner and disable interaction */
  loading?: boolean;
  /** Disable the button */
  disabled?: boolean;
  /** HTML button type */
  type?: 'button' | 'submit';
  /** Additional CSS classes */
  className?: string;
  /** Unique identifier for testing */
  id?: string;
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  loading = false,
  disabled = false,
  type = 'button',
  className = '',
  id,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const baseStyles = `
    relative inline-flex items-center justify-center
    px-6 py-3 rounded-lg font-medium text-sm
    transition-all duration-200 ease-out
    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-navy
    disabled:cursor-not-allowed disabled:shadow-none
  `;

  const variantStyles = {
    primary: `
      bg-core text-navy font-semibold
      hover:bg-white hover:shadow-lg hover:shadow-core/20
      focus-visible:ring-core
      hover:scale-[1.02] active:scale-[0.98]
      disabled:bg-white/[0.07] disabled:text-ink-500 disabled:border disabled:border-surface-border disabled:hover:scale-100
    `,
    secondary: `
      bg-surface border border-surface-border
      text-ink-100
      hover:bg-surface-hover hover:border-white/20
      focus-visible:ring-core/60
      disabled:opacity-50
    `,
  };

  return (
    <button
      id={id}
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
    >
      {loading && (
        <svg
          className="animate-spin -ml-1 mr-2 h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      )}
      {children}
    </button>
  );
}
