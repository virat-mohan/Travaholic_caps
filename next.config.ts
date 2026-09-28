import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Old storefront URLs still get visits (bookmarks, old posts, search) and
  // were 404ing — send them to the matching cap or the shop grid.
  async redirects() {
    return [
      { source: "/travaholiccaps/products/:slug", destination: "/chapter/:slug", permanent: true },
      { source: "/products/:slug", destination: "/chapter/:slug", permanent: true },
      { source: "/collection/:path*", destination: "/shop", permanent: true },
      { source: "/:prefix/collection/:path*", destination: "/shop", permanent: true },
    ];
  },
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
