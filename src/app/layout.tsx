/**
 * Root layout for News Triangulator.
 *
 * Sets up the Inter font, dark navy background, and global metadata.
 * All pages inherit this layout.
 */

import type { Metadata } from 'next';
import { Inter, Newsreader, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

/** UI / body face — chrome, forms, summaries. */
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

/** Editorial display face — results headings and the factual core only. */
const newsreader = Newsreader({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-newsreader',
  // Newsreader isn't in Next's font-metrics database, so the automatic
  // metric-matched fallback fails with "Failed to find font override values".
  // Disable it (negligible CLS impact for a display/heading face) and pin an
  // explicit serif fallback instead.
  adjustFontFallback: false,
  fallback: ['Georgia', 'Cambria', 'Times New Roman', 'serif'],
});

/** Data face — counters, timestamps, source counts. */
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--font-plex-mono',
});

export const metadata: Metadata = {
  title: 'News Triangulator — See the truth beneath the headlines',
  description:
    'Paste any news story and see how progressive, conservative, and international sources covered it differently. Extract the factual core that survives triangulation.',
  keywords: [
    'news analysis',
    'media bias',
    'fact checking',
    'news triangulation',
    'AI news analysis',
  ],
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
  },
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${newsreader.variable} ${plexMono.variable}`}
    >
      <body className="bg-navy text-ink-100 font-sans antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
