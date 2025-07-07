/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  eslint: {
    // Explicitly tell Next.js to ignore ESLint errors during build
    ignoreDuringBuilds: true,
  }
}

module.exports = nextConfig 