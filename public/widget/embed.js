/* Sporeus Athlete Widget — embed.js v1.0 */
/* Drop this script anywhere: <script src="...widget/embed.js" defer></script> */
/* A floating "Track your training →" button opens an iframe overlay. */
(function () {
  'use strict';

  var APP_URL = 'https://lhr-present.github.io/sporeus-athlete/?embed=true&source=sporeus-com';
  var ORANGE  = '#ff6600';
  var MONO    = "'IBM Plex Mono','Courier New',monospace";

  if (window.__sporeus_widget) return;
  window.__sporeus_widget = true;

  var overlay = null;
  var iframe  = null;
  var trigger = null;

  /* ── Floating trigger button ─────────────────────────────────────────────── */
  function createTrigger() {
    var btn = document.createElement('button');
    btn.textContent = '\u25C8 Track your training \u2192';
    btn.setAttribute('aria-label', 'Open Sporeus training tracker');
    applyStyles(btn.style, {
      position:      'fixed',
      bottom:        '24px',
      right:         '24px',
      zIndex:        '99998',
      background:    ORANGE,
      color:         '#fff',
      fontFamily:    MONO,
      fontSize:      '11px',
      fontWeight:    '700',
      letterSpacing: '0.08em',
      padding:       '10px 18px',
      border:        'none',
      borderRadius:  '4px',
      cursor:        'pointer',
      boxShadow:     '0 4px 20px rgba(255,102,0,0.35)',
      transition:    'opacity 0.2s',
    });
    btn.addEventListener('mouseover', function () { btn.style.opacity = '0.85'; });
    btn.addEventListener('mouseout',  function () { btn.style.opacity = '1'; });
    btn.addEventListener('click', openOverlay);
    document.body.appendChild(btn);
    trigger = btn;
  }

  /* ── Iframe overlay ──────────────────────────────────────────────────────── */
  function createOverlay() {
    var ov = document.createElement('div');
    applyStyles(ov.style, {
      position:        'fixed',
      inset:           '0',
      zIndex:          '99999',
      background:      'rgba(0,0,0,0.72)',
      display:         'flex',
      alignItems:      'center',
      justifyContent:  'center',
    });

    var panel = document.createElement('div');
    applyStyles(panel.style, {
      position:     'relative',
      width:        'min(440px, 96vw)',
      height:       'min(700px, 92vh)',
      background:   '#0a0a0a',
      borderRadius: '8px',
      overflow:     'hidden',
      boxShadow:    '0 24px 80px rgba(0,0,0,0.85)',
      border:       '1px solid #2a2a2a',
    });

    var closeBtn = document.createElement('button');
    closeBtn.textContent = '\u2715';
    closeBtn.setAttribute('aria-label', 'Close training tracker');
    applyStyles(closeBtn.style, {
      position:     'absolute',
      top:          '10px',
      right:        '12px',
      zIndex:       '1',
      background:   'none',
      border:       '1px solid #444',
      color:        '#888',
      fontFamily:   MONO,
      fontSize:     '11px',
      padding:      '3px 8px',
      borderRadius: '3px',
      cursor:       'pointer',
      lineHeight:   '1',
    });
    closeBtn.addEventListener('click', closeOverlay);

    iframe = document.createElement('iframe');
    iframe.src   = APP_URL;
    iframe.title = 'Sporeus Training Tracker';
    iframe.setAttribute('allow', 'clipboard-write');
    applyStyles(iframe.style, {
      width:   '100%',
      height:  '100%',
      border:  'none',
      display: 'block',
    });

    panel.appendChild(closeBtn);
    panel.appendChild(iframe);
    ov.appendChild(panel);

    ov.addEventListener('click', function (e) {
      if (e.target === ov) closeOverlay();
    });

    document.body.appendChild(ov);
    overlay = ov;
  }

  function openOverlay() {
    if (!overlay) createOverlay();
    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  function closeOverlay() {
    if (overlay) overlay.style.display = 'none';
    document.body.style.overflow = '';
  }

  /* ── Listen for check-in completion from the iframe ─────────────────────── */
  window.addEventListener('message', function (e) {
    if (!e.data || e.data.type !== 'sporeus-checkin-complete') return;
    closeOverlay();
    var score = e.data.score;
    if (trigger && typeof score === 'number') {
      trigger.textContent = '\u25C8 ' + score + '/100 logged \u2713';
      setTimeout(function () {
        if (trigger) trigger.textContent = '\u25C8 Track your training \u2192';
      }, 4000);
    }
  });

  /* ── Init ────────────────────────────────────────────────────────────────── */
  function applyStyles(style, props) {
    for (var k in props) { if (Object.prototype.hasOwnProperty.call(props, k)) style[k] = props[k]; }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createTrigger);
  } else {
    createTrigger();
  }
})();
