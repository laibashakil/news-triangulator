/** @type {import('next').NextConfig} */
const nextConfig = {
  /**
   * 'standalone' output is required for Docker deployment with Next.js.
   * It produces a minimal self-contained build that doesn't require
   * the full node_modules directory in the production image.
   */
  output: 'standalone',
};

module.exports = nextConfig;
