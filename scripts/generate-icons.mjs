#!/usr/bin/env node
// scripts/generate-icons.mjs — Generate all PWA icon assets from Sporeus SVG mark
// Usage: node scripts/generate-icons.mjs  (or: npm run icons)
//
// Sources:
//   brand/sporeus-mark.svg        → standard any-purpose icons (solid bg applied)
//   brand/sporeus-mark-solid.svg  → maskable icons (80% safe zone baked in)
//   brand/sporeus-mark-simple.svg → favicon 16/32/48 and favicon.ico
//
// Outputs:
//   public/icons/icon-{48,72,96,128,144,152,192,256,384,512}.png  (purpose: any)
//   public/icons/icon-maskable-192.png                             (purpose: maskable)
//   public/icons/icon-maskable-512.png                             (purpose: maskable)
//   public/apple-touch-icon.png   (180×180)
//   public/favicon-16.png, public/favicon-32.png
//   public/favicon.ico            (multi-resolution 16/32/48)

import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const ROOT  = join(__dir, '..')

const BRAND = {
  mark:    readFileSync(join(ROOT, 'brand/sporeus-mark.svg')),
  solid:   readFileSync(join(ROOT, 'brand/sporeus-mark-solid.svg')),
  simple:  readFileSync(join(ROOT, 'brand/sporeus-mark-simple.svg')),
}

// Brand background color for composite operations
const BG = { r: 10, g: 10, b: 10, alpha: 1 }   // #0a0a0a

// Render SVGs at high density so downscaling stays crisp
const DENSITY = 600

let sharp, pngToIco
try {
  sharp    = (await import('sharp')).default
  pngToIco = (await import('png-to-ico')).default
} catch (e) {
  console.error('Missing dependency:', e.message)
  console.error('Run: npm install -D sharp png-to-ico')
  process.exit(1)
}

mkdirSync(join(ROOT, 'public/icons'), { recursive: true })

let errors = 0

// ── Helper: render SVG → PNG at size, with optional solid background flatten ──
async function render(svgBuf, size, withBg = false) {
  let pipe = sharp(svgBuf, { density: DENSITY }).resize(size, size)
  if (withBg) pipe = pipe.flatten({ background: BG })
  return pipe.png().toBuffer()
}

// ── Helper: write PNG, assert dimensions and min size ────────────────────────
async function writePng(buf, outPath, expectedSize) {
  const meta = await sharp(buf).metadata()
  if (meta.width !== expectedSize || meta.height !== expectedSize) {
    console.error(`  ✗ ${outPath}: wrong size ${meta.width}x${meta.height} (expected ${expectedSize})`)
    errors++
    return
  }
  // Min byte threshold: original placeholders were 70B (1×1 PNG).
  // Tiny sizes (≤32px) compress heavily — use 150B minimum. Larger: 1KB.
  const minBytes = expectedSize <= 32 ? 150 : 1024
  if (buf.length < minBytes) {
    console.error(`  ✗ ${outPath}: file too small (${buf.length} B < ${minBytes} B) — possible placeholder regression`)
    errors++
    return
  }
  writeFileSync(join(ROOT, outPath), buf)
  console.log(`  ✓ ${outPath.padEnd(48)} ${expectedSize}×${expectedSize}  ${buf.length} B`)
}

console.log('\nSporeus Icon Pipeline\n')

// ── 1. Standard icons — purpose: any ─────────────────────────────────────────
console.log('Standard icons (purpose: any) — mark on #0a0a0a background:')
const STANDARD_SIZES = [48, 72, 96, 128, 144, 152, 192, 256, 384, 512]
for (const size of STANDARD_SIZES) {
  const buf = await render(BRAND.mark, size, true)
  await writePng(buf, `public/icons/icon-${size}x${size}.png`, size)
}

// ── 2. Maskable icons — purpose: maskable ─────────────────────────────────────
console.log('\nMaskable icons (purpose: maskable) — solid SVG with 80% safe zone:')
for (const size of [192, 512]) {
  const buf = await render(BRAND.solid, size, false)
  await writePng(buf, `public/icons/icon-maskable-${size}.png`, size)
}

// ── 3. Apple touch icon ───────────────────────────────────────────────────────
console.log('\nApple touch icon:')
{
  const buf = await render(BRAND.mark, 180, true)
  await writePng(buf, 'public/apple-touch-icon.png', 180)
}

// ── 4. Favicon PNGs ──────────────────────────────────────────────────────────
console.log('\nFavicon PNGs (from simple 2-curve variant):')
for (const size of [16, 32]) {
  const buf = await render(BRAND.simple, size, true)
  await writePng(buf, `public/favicon-${size}.png`, size)
}

// ── 5. Multi-resolution favicon.ico (16 + 32 + 48 layers) ───────────────────
console.log('\nfavicon.ico (16 + 32 + 48 layers):')
try {
  const buf16 = await render(BRAND.simple, 16, true)
  const buf32 = await render(BRAND.simple, 32, true)
  const buf48 = await render(BRAND.simple, 48, true)
  const ico   = await pngToIco([buf16, buf32, buf48])
  writeFileSync(join(ROOT, 'public/favicon.ico'), ico)
  console.log(`  ✓ public/favicon.ico  ${ico.length} B  (16+32+48 layers)`)
} catch (e) {
  console.error(`  ✗ public/favicon.ico: ${e.message}`)
  errors++
}

// ── Done ──────────────────────────────────────────────────────────────────────
console.log(errors
  ? `\n✗ ${errors} error(s) — check output above`
  : '\n✓ All icons generated successfully'
)
process.exit(errors ? 1 : 0)
