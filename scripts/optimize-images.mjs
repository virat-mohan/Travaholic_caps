// Pre-builds small WebP copies of every image in public/images (640px and
// 1280px wide) into public/_opt/, served by lib/images/loader.js. Outputs
// are committed; the prebuild step only fills in images added since. Vercel's
// on-demand optimiser is off (free quota exhausted), and serving the raw
// 0.5–1MB product PNGs made pages crawl on mobile — this restores fast,
// optimised images at build time for free. Skips files already up to date.
import fs from "fs/promises";
import path from "path";

let sharp;
try {
  sharp = (await import("sharp")).default;
} catch {
  // Never fail a deploy over this: committed outputs already cover every image.
  console.warn("optimize-images: sharp unavailable, skipping");
  process.exit(0);
}

const SRC = "public/images";
const OUT = "public/_opt/images";
const WIDTHS = [640, 1280];

async function* walk(dir) {
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name.startsWith("_pre_normalize_backup")) continue;
      yield* walk(p);
    } else if (/\.(png|jpe?g)$/i.test(e.name)) yield p;
  }
}

let made = 0;
let skipped = 0;
const started = Date.now();
for await (const file of walk(SRC)) {
  const rel = path.relative(SRC, file).replace(/\.(png|jpe?g)$/i, "");
  for (const w of WIDTHS) {
    const out = path.join(OUT, `${rel}-${w}.webp`);
    // Existence, not mtime: outputs are committed, and a git checkout gives
    // every file the same fresh mtime — comparing would rebuild all 400+.
    try {
      await fs.access(out);
      skipped++;
      continue;
    } catch {}
    await fs.mkdir(path.dirname(out), { recursive: true });
    try {
      await sharp(file).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: 80 }).toFile(out);
      made++;
    } catch (err) {
      console.warn("optimize-images: skipped", file, err.message);
    }
  }
}
console.log(`optimize-images: ${made} written, ${skipped} up to date, ${((Date.now() - started) / 1000).toFixed(1)}s`);
