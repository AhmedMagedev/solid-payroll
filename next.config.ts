import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
    // `dirs` option can be used if you want to restrict linting to specific directories during build,
    // but .eslintignore should handle generated files.
    // dirs: ['app', 'lib', 'prisma'], 
  },
  /* other config options can go here */
};

export default nextConfig;
