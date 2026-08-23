/* Generates the monochrome shopping-bag PWA icons. Run: node scripts/icons.mjs */
import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const INK = "#111114";
const WHITE = "#ffffff";

/** A simple shopping bag glyph centred in a 100×100 box. */
const bag = (stroke) => `
  <path d="M27 36h46l4 48H23l4-48z" fill="none" stroke="${stroke}" stroke-width="6" stroke-linejoin="round"/>
  <path d="M38 36v-6a12 12 0 0 1 24 0v6" fill="none" stroke="${stroke}" stroke-width="6" stroke-linecap="round"/>`;

function svg({ size, bg, fg, radius, pad }) {
  const inner = 100 - pad * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="${radius}" fill="${bg}"/>
  <g transform="translate(${pad} ${pad}) scale(${inner / 100})">${bag(fg)}</g>
</svg>`;
}

const out = (name, s) => sharp(Buffer.from(s)).png().toFile(name);
mkdirSync("public/icons", { recursive: true });

await Promise.all([
  // "any" icons: white tile, ink bag (monochrome)
  out("public/icons/icon-192.png", svg({ size: 192, bg: WHITE, fg: INK, radius: 22, pad: 8 })),
  out("public/icons/icon-512.png", svg({ size: 512, bg: WHITE, fg: INK, radius: 22, pad: 8 })),
  // maskable: ink tile, white bag, extra safe-zone padding
  out("public/icons/maskable-512.png", svg({ size: 512, bg: INK, fg: WHITE, radius: 0, pad: 20 })),
  // Next.js file conventions: favicon + apple touch icon
  out("app/icon.png", svg({ size: 64, bg: INK, fg: WHITE, radius: 18, pad: 10 })),
  out("app/apple-icon.png", svg({ size: 180, bg: INK, fg: WHITE, radius: 0, pad: 14 })),
]);
console.log("icons written");
