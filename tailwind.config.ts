import type { Config } from 'tailwindcss';

/**
 * Tailwind configuration with News Triangulator design tokens.
 *
 * Design philosophy — "color belongs to the perspectives, the product's
 * voice is paper":
 * - Three perspective accents (amber, blue, teal) are categorical, not
 *   political, and tuned to equal luminance + AA contrast on dark navy.
 * - The factual `core` is the only warm light on the page — everything
 *   converges toward it, enacting triangulation.
 * - A defined `ink` text scale replaces ad-hoc opacity values; every step
 *   used for essential text meets WCAG AA (≥4.5:1) on the navy background.
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
          DEFAULT: '#0C1118',
          light: '#111826',
          lighter: '#1A2233',
        },
        /* Kept for backwards compatibility; prefer the `ink` scale below. */
        offwhite: '#E8E6E3',

        /* ──── Neutral text scale (all AA on navy) ──── */
        ink: {
          100: '#ECEAE6', // primary — headings / body          ~14:1
          300: '#B6BCC7', // secondary — summaries / paragraphs  ~7:1
          500: '#8B93A3', // muted — eyebrows / labels           ~4.6:1
          700: '#5B6373', // faint — decorative ONLY, never essential text
        },

        /* ──── Perspective accent colors (equal-luminance, AA as text) ──── */
        perspective: {
          progressive: '#F2A93B',
          conservative: '#6AA6FF',
          international: '#2DD4BF',
        },

        /* ──── The factual core — warm "printed truth" ──── */
        core: {
          DEFAULT: '#F5EFE3',
          dim: '#CFC8B8',
        },

        /* ──── Semantic surfaces ──── */
        surface: {
          DEFAULT: 'rgba(255, 255, 255, 0.03)',
          raised: '#141C2B',
          hover: 'rgba(255, 255, 255, 0.06)',
          border: 'rgba(255, 255, 255, 0.08)',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
        display: ['var(--font-newsreader)', 'Georgia', 'Cambria', 'serif'],
        mono: ['var(--font-plex-mono)', 'ui-monospace', 'monospace'],
      },
      maxWidth: {
        measure: '38rem', // ~66ch reading measure for the factual core
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
