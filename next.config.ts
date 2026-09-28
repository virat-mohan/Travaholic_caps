import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Vercel's free image-optimisation quota ran out (402s broke every image),
    // so optimisation happens at build time instead: scripts/optimize-images.mjs
    // writes WebP copies to public/_opt and this loader serves them.
    loader: "custom",
    loaderFile: "./lib/images/loader.js",
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
