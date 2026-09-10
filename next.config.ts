import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: { serverActions: { bodySizeLimit: "2mb" } },
  // The Open Graph image reads its fonts from disk at request time.
  outputFileTracingIncludes: { "/p/[slug]/opengraph-image": ["./src/assets/fonts/*"] },
};

export default nextConfig;
