import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  turbopack: {
    root: '.',
  },
  async redirects() {
    return [
      { source: '/analytics', destination: '/', permanent: false },
    ];
  },
};

export default nextConfig;
