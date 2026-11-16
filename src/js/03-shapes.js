// ───────────────────────── M3 Expressive shapes, icons & wavy indicators ─────────────────────────
const SHAPES = {
  circle: { n: 0, a: 0 },
  cookie4: { n: 4, a: 0.1 },
  cookie6: { n: 6, a: 0.075 },
  cookie9: { n: 9, a: 0.06 },
  cookie12: { n: 12, a: 0.045 },
  clover: { n: 4, a: 0.24 },
  flower: { n: 8, a: 0.11 },
  sunny: { n: 8, a: 0.05 },
  burst: { n: 12, a: 0.09 },
  puffy: { n: 5, a: 0.13 },
};
const SHAPE_KEYS = Object.keys(SHAPES);

function shapePath(kind, size, rot = 0) {
  const s = SHAPES[kind] || SHAPES.circle;
  const pts = [], N = 144, c = size / 2;
  let maxR = 0;
  for (let i = 0; i < N; i++) {
    const t = (i / N) * TAU;
    const r = 1 + s.a * Math.cos(s.n * (t + rot));
    pts.push([Math.cos(t) * r, Math.sin(t) * r]); maxR = Math.max(maxR, r);
  }
  const k = (c * 0.98) / maxR;
  return 'M' + pts.map((p) => `${(c + p[0] * k).toFixed(2)} ${(c + p[1] * k).toFixed(2)}`).join('L') + 'Z';
}

function shapeSvg(kind, size, fill, extra = '') {
  return `<svg class="shape-svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" ${extra}><path d="${shapePath(kind, size)}" fill="${fill}"/></svg>`;
}

// stroke icons (24×24)
const ICONS = {
  left: 'M15 5l-7 7 7 7',
  right: 'M9 5l7 7-7 7',
  jump: 'M6 13l6-6 6 6M12 7v13',
  close: 'M6 6l12 12M18 6L6 18',
  back: 'M19 12H5M11 6l-6 6 6 6',
  book: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14zM6.5 17A2.5 2.5 0 0 0 4 19.5 2.5 2.5 0 0 0 6.5 22H20v-5',
  brush: 'M9.06 11.9l8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02z',
  tune: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
  pause: 'M8 5v14M16 5v14',
  check: 'M5 12l5 5 9-10',
  home: 'M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  volume: 'M11 5L6 9H2v6h4l5 4V5zM15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14',
  skip: 'M5 4l10 8-10 8V4zM19 5v14',
  cards: 'M8 3h10a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM3 7v12a3 3 0 0 0 3 3h9',
  sparkle: 'M12 3l1.9 5.6L19.5 10.5 13.9 12.4 12 18l-1.9-5.6L4.5 10.5l5.6-1.9zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  dice: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8 8h.01M16 8h.01M12 12h.01M8 16h.01M16 16h.01',
  play: 'M7 4.5v15l12.5-7.5z',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  restart: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5',
  crosshair: 'M12 2v4M12 18v4M2 12h4M18 12h4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
};
function icon(name, size = 24, fillIt = false) {
  const d = ICONS[name] || '';
  return `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fillIt ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
}

// wavy (squiggly) line path – M3 Expressive progress indicator
function wavyPath(width, height, progress, phase, amp = 3, wl = 14) {
  const mid = height / 2, end = Math.max(0, width * progress);
  let d = `M0 ${mid.toFixed(2)}`;
  for (let x = 2; x <= end; x += 2) d += `L${x} ${(mid + Math.sin((x / wl) * TAU + phase) * amp).toFixed(2)}`;
  return d;
}

class WavyBar {
  constructor(container, { height = 14, amp = 3, wl = 16, color = 'var(--md-primary)', track = 'var(--md-secondary-container)' } = {}) {
    this.c = container; this.h = height; this.amp = amp; this.wl = wl; this.p = 1; this.phase = 0; this.calm = false;
    this.c.innerHTML = `<svg class="wavy" height="${height}" preserveAspectRatio="none"><path class="wv-track" stroke="${track}" fill="none" stroke-width="5" stroke-linecap="round"/><path class="wv-fill" stroke="${color}" fill="none" stroke-width="5" stroke-linecap="round"/><circle class="wv-dot" r="2.5" fill="${color}"/></svg>`;
    this.svg = this.c.firstChild; this.track = this.svg.children[0]; this.fill = this.svg.children[1]; this.dot = this.svg.children[2];
  }
  set(p) { this.p = clamp(p, 0, 1); }
  update(dt) {
    const w = this.c.clientWidth || 100;
    this.svg.setAttribute('width', w); this.svg.setAttribute('viewBox', `0 0 ${w} ${this.h}`);
    this.phase -= dt * (this.calm ? 2 : 6);
    const gap = 8, endX = w * this.p;
    this.fill.setAttribute('d', wavyPath(w - 4, this.h, this.p, this.phase, this.calm ? 0.6 : this.amp, this.wl));
    this.track.setAttribute('d', endX + gap < w - 4 ? `M${endX + gap} ${this.h / 2}L${w - 6} ${this.h / 2}` : '');
    this.dot.setAttribute('cx', w - 3); this.dot.setAttribute('cy', this.h / 2);
  }
}
