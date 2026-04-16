#!/usr/bin/env node
// scripts/preview-mark.mjs — Render brand SVGs to PNG at preview sizes
// Usage: node scripts/preview-mark.mjs
// Output: /tmp/mark-preview/{mark-name}-{size}.png

import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const ROOT  = join(__dir, '..')
const OUT   = '/tmp/mark-preview'

mkdirSync(OUT, { recursive: true })

let sharp
try {
  sharp = (await import('sharp')).default
} catch {
  console.error('ERROR: sharp not installed. Run: npm install -D sharp')
  process.exit(1)
}

const MARKS = [
  { name: 'sporeus-mark',        file: 'brand/sporeus-mark.svg' },
  { name: 'sporeus-mark-solid',  file: 'brand/sporeus-mark-solid.svg' },
  { name: 'sporeus-mark-simple', file: 'brand/sporeus-mark-simple.svg' },
  { name: 'sporeus-mark-mono',   file: 'brand/sporeus-mark-mono.svg' },
]

const SIZES = [512, 192, 48, 16]
const RENDER_DENSITY = 600   // high DPI so small sizes stay crisp after downsampling

console.log(`\nSporeus Mark Preview\nOutput dir: ${OUT}\n`)
console.log('Source SVG file sizes:')
for (const mark of MARKS) {
  const bytes = readFileSync(join(ROOT, mark.file)).length
  console.log(`  ${mark.file.padEnd(40)} ${bytes} bytes`)
}
console.log()

let anyError = false

for (const mark of MARKS) {
  const svgPath = join(ROOT, mark.file)
  const svgBuf  = readFileSync(svgPath)

  for (const size of SIZES) {
    const outFile = join(OUT, `${mark.name}-${size}.png`)
    try {
      const pngBuf = await sharp(svgBuf, { density: RENDER_DENSITY })
        .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer()

      const meta = await sharp(pngBuf).metadata()
      if (meta.width !== size || meta.height !== size) {
        console.error(`  ✗ ${mark.name}-${size}.png: wrong dimensions ${meta.width}x${meta.height}`)
        anyError = true
        continue
      }

      writeFileSync(outFile, pngBuf)
      console.log(`  ✓ ${mark.name}-${size}.png  ${meta.width}x${meta.height}  ${pngBuf.length} B`)
    } catch (err) {
      console.error(`  ✗ ${mark.name}-${size}.png: ${err.message}`)
      anyError = true
    }
  }
}

console.log(anyError ? '\n⚠ Some previews failed.' : '\n✓ All previews generated.')
process.exit(anyError ? 1 : 0)
