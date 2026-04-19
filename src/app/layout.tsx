/**
 * Root layout for News Triangulator.
 *
 * Sets up the Inter font, dark navy background, and global metadata.
 * All pages inherit this layout.
 */

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
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
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" className={`${inter.variable}`}>
      <body className="bg-navy text-offwhite font-sans antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
