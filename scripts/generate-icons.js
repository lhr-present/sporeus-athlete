#!/usr/bin/env node
// scripts/generate-icons.js — Generate placeholder PWA icon PNGs (v5.11.0)
// Usage: node scripts/generate-icons.js
// Writes 1x1 transparent PNG placeholders for each required size to public/icons/
// Replace these files with real artwork before production release.

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ICONS_DIR = path.join(__dirname, '..', 'public', 'icons')
const SIZES = [72, 96, 128, 144, 152, 192, 384, 512]

// Minimal valid 1x1 transparent PNG (68 bytes, base64-encoded)
const TRANSPARENT_1x1_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
)

fs.mkdirSync(ICONS_DIR, { recursive: true })

for (const size of SIZES) {
  const file = path.join(ICONS_DIR, `icon-${size}x${size}.png`)
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, TRANSPARENT_1x1_PNG)
    console.log(`Created ${file}`)
  } else {
    console.log(`Skipped (exists): ${file}`)
  }
}

console.log(`\nDone. ${SIZES.length} icon files in ${ICONS_DIR}`)
console.log('Replace with real artwork before production release.')
