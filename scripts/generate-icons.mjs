// Generate PWA / web app icons from assets/floatie-icon.svg (single source).
// For native iOS/Android icons, use @capacitor/assets with assets/icon.png.
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const svg = readFileSync(join(root, "assets/floatie-icon.svg"));

const targets = [
  [1024, "public/app-icon.png"],
  [512, "public/icon-512.png"],
  [192, "public/icon-192.png"],
  [180, "public/apple-touch-icon.png"],
  // 1024 PNG source for @capacitor/assets (native icon generation)
  [1024, "assets/icon.png"],
];

for (const [size, out] of targets) {
  await sharp(svg, { density: 512 })
    .resize(size, size, { fit: "cover" })
    .png()
    .toFile(join(root, out));
  console.log(`✔ ${out} (${size}×${size})`);
}
