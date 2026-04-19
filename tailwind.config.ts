import type { Config } from 'tailwindcss';

/**
 * Tailwind configuration with News Triangulator design tokens.
 *
 * Color philosophy:
 * - Three perspective accents (amber, blue, teal) are categorical, not political
 * - Dark navy background creates a serious, editorial feel
 * - Off-white text provides comfortable contrast on dark backgrounds
 */
const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        /* ──── Base palette ──── */
        navy: {
          DEFAULT: '#0A0E1A',
          light: '#111827',
          lighter: '#1F2937',
        },
        offwhite: '#E8E6E3',

        /* ──── Perspective accent colors ──── */
        perspective: {
          progressive: '#F59E0B',
          conservative: '#3B82F6',
          international: '#14B8A6',
        },

        /* ──── Semantic colors ──── */
        surface: {
          DEFAULT: 'rgba(255, 255, 255, 0.04)',
          hover: 'rgba(255, 255, 255, 0.08)',
          border: 'rgba(255, 255, 255, 0.10)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'slide-up': 'slideUp 0.5s ease-out forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
