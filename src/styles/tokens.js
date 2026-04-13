// ─── Design tokens — single source of truth for all visual constants ──────────
// Import here, in styles.js, or wherever raw token values are needed for overrides.
// Never import in component files that can just use S.* from styles.js.

export const COLOR = Object.freeze({
  // Brand
  orange:    '#ff6600',
  blue:      '#0064ff',
  // Semantic
  green:     '#5bc25b',
  red:       '#e03030',
  yellow:    '#f5c542',
  amber:     '#e0a030',
  strava:    '#fc4c02',
  blueLight: '#4a90d9',
  // Neutral scale (darkest → lightest)
  black:     '#0a0a0a',
  nearBlack: '#111',
  dark1:     '#1a1a1a',
  dark22:    '#222',
  dark2:     '#2a2a2a',
  dark3:     '#333',
  dark4:     '#444',
  dim:       '#555',
  mid6:      '#666',
  grey:      '#888',
  silver:    '#aaa',
  light:     '#ccc',
  smoke:     '#e0e0e0',
  offWhite:  '#e5e5e5',
  white:     '#fff',
})

export const SPACE = Object.freeze({
  xs:   4,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  xxl:  24,
  xxxl: 32,
})

export const FONT = Object.freeze({
  mono: "'IBM Plex Mono',monospace",
  sans: "'IBM Plex Sans',system-ui,sans-serif",
  size: Object.freeze({
    xxs:  '8px',
    xs:   '9px',
    sm:   '10px',
    md:   '11px',
    base: '12px',
    lg:   '13px',
    xl:   '14px',
    xxl:  '16px',
    stat: '22px',
  }),
  track: Object.freeze({
    tight:  '0.06em',
    normal: '0.08em',
    wide:   '0.1em',
    wider:  '0.12em',
  }),
})

export const RADIUS = Object.freeze({
  sm:    2,
  md:    3,
  lg:    4,
  xl:    6,
  round: '50%',
})

export const TRANSITION = Object.freeze({
  fast: 'all 0.15s',
  fade: 'opacity 0.2s',
})
