"use client";

// Serves the build-time WebP copies from scripts/optimize-images.mjs for any
// local /images/*.png|jpg; everything else (Supabase uploads, SVGs) as-is.
export default function travaholicImageLoader({ src, width }) {
  const clean = src.split("?")[0];
  if (clean.startsWith("/images/") && /\.(png|jpe?g)$/i.test(clean) && !clean.includes("_pre_normalize_backup")) {
    const w = width <= 640 ? 640 : 1280;
    const decoded = decodeURI(clean).replace(/\.(png|jpe?g)$/i, "");
    return encodeURI(`/_opt${decoded}-${w}.webp`);
  }
  return src;
}
