/** @type {import('next').NextConfig} */
const nextConfig = {
  // Deployed on Vercel, which manages its own build output, so no
  // `output: 'standalone'` is needed. (That setting was for the old Docker /
  // Cloud Run image and also fails local Windows builds due to symlinks.)
};

module.exports = nextConfig;
