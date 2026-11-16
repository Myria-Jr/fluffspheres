// ───────────────────────── Core helpers, data & persistence ─────────────────────────
THREE.ColorManagement.enabled = false;

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, l, dt) => lerp(a, b, 1 - Math.exp(-l * dt));
const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const smooth01 = (t) => t * t * (3 - 2 * t);

function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const k in attrs) {
    const v = attrs[k];
    if (k === 'class') e.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else if (k === 'html') e.innerHTML = v;
    else if (v !== false && v != null) e.setAttribute(k, v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
}

const IS_TOUCH = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
const IS_MOBILE = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
const IS_APP = /FluffspheresApp/.test(navigator.userAgent);

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
};

class Emitter {
  constructor() { this.h = {}; }
  on(n, f) { (this.h[n] = this.h[n] || []).push(f); return () => this.off(n, f); }
  off(n, f) { this.h[n] = (this.h[n] || []).filter((x) => x !== f); }
  emit(n, ...a) { (this.h[n] || []).slice().forEach((f) => f(...a)); }
}
const Bus = new Emitter();

// ── Palette data ──
const FUR_COLORS = [
  { name: 'Zuckerrosa', hex: '#ff9ccf' }, { name: 'Lavendel', hex: '#b9a2ff' }, { name: 'Himmelblau', hex: '#8fd3ff' },
  { name: 'Minze', hex: '#8ff0c9' }, { name: 'Pfirsich', hex: '#ffbf94' }, { name: 'Butter', hex: '#ffe27a' },
  { name: 'Flieder', hex: '#e7a6ff' }, { name: 'Wolke', hex: '#f5efff' }, { name: 'Kakao', hex: '#c69a86' },
  { name: 'Kirsche', hex: '#ff7a9a' }, { name: 'Pistazie', hex: '#c4e88a' }, { name: 'Nacht', hex: '#7e7bd9' },
];
const EYE_COLORS = [
  { name: 'Schokobraun', hex: '#7a4a2a' }, { name: 'Ozean', hex: '#2f8fe0' }, { name: 'Smaragd', hex: '#21a36b' },
  { name: 'Amethyst', hex: '#9b4fe0' }, { name: 'Bernstein', hex: '#e09a1f' }, { name: 'Rosé', hex: '#e04f9a' },
  { name: 'Eisblau', hex: '#58c8d8' }, { name: 'Mitternacht', hex: '#33307a' },
];
const BADGES = [
  { id: 'heart', name: 'Herz' }, { id: 'star', name: 'Stern' }, { id: 'rainbow', name: 'Regenbogen' },
  { id: 'moon', name: 'Mond' }, { id: 'sun', name: 'Sonne' }, { id: 'cloud', name: 'Wolke' },
  { id: 'flower', name: 'Blume' }, { id: 'clover', name: 'Kleeblatt' }, { id: 'bolt', name: 'Blitz' },
  { id: 'note', name: 'Note' }, { id: 'drop', name: 'Tropfen' }, { id: 'crown', name: 'Krone' },
];
const DEFAULT_PROFILES = [
  { name: 'Rosalie', fur: '#ff9ccf', furLen: 0.55, eye: '#7a4a2a', badge: 'heart' },
  { name: 'Lumi', fur: '#8fd3ff', furLen: 0.45, eye: '#2f8fe0', badge: 'star' },
  { name: 'Minzi', fur: '#8ff0c9', furLen: 0.65, eye: '#21a36b', badge: 'clover' },
  { name: 'Pfirsi', fur: '#ffbf94', furLen: 0.5, eye: '#9b4fe0', badge: 'sun' },
];
const TEAM_ACCENTS = ['#e0559e', '#3f8fe8', '#1fae78', '#e8892a'];

const Profiles = store.get('fs_profiles_v1', null) || DEFAULT_PROFILES.map((p) => ({ ...p }));
const saveProfiles = () => store.set('fs_profiles_v1', Profiles);

const Settings = Object.assign(
  { quality: IS_MOBILE ? 'medium' : 'high', music: true, sfx: true, volume: 0.75, shake: true, turnTime: 45, fluffsPerTeam: 2, aiLevel: 'normal' },
  store.get('fs_settings_v1', {})
);
const saveSettings = () => store.set('fs_settings_v1', Settings);

const QUALITY = {
  low: { shells: 14, seg: 22, pixelRatio: 1, aa: false, clouds: 14, terrainLayers: 6, motes: 120 },
  medium: { shells: 22, seg: 28, pixelRatio: 1.35, aa: true, clouds: 22, terrainLayers: 10, motes: 220 },
  high: { shells: 34, seg: 36, pixelRatio: 2, aa: true, clouds: 34, terrainLayers: 16, motes: 400 },
};
const Q = () => QUALITY[Settings.quality] || QUALITY.medium;

function hexToRgb(hex) { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; }
function mixHex(a, b, t) { const c = new THREE.Color(a).lerp(new THREE.Color(b), t); return '#' + c.getHexString(); }

// ── Badge drawing (vector, used for fur tummy symbols and UI) ──
function drawBadge(ctx, id, s, opts = {}) {
  const c = s / 2;
  ctx.save();
  ctx.translate(c, c);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const fill = (col) => { ctx.fillStyle = col; ctx.fill(); };
  const heart = (sc, col) => {
    ctx.beginPath();
    ctx.moveTo(0, sc * 0.35);
    ctx.bezierCurveTo(-sc * 0.95, -sc * 0.25, -sc * 0.45, -sc * 0.95, 0, -sc * 0.45);
    ctx.bezierCurveTo(sc * 0.45, -sc * 0.95, sc * 0.95, -sc * 0.25, 0, sc * 0.35);
    ctx.closePath(); fill(col);
  };
  const star = (r1, r2, n, col, rot = -Math.PI / 2) => {
    ctx.beginPath();
    for (let i = 0; i < n * 2; i++) { const r = i % 2 ? r2 : r1, a = rot + (i * Math.PI) / n; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    ctx.closePath(); fill(col);
  };
  const R = s * 0.42;
  switch (id) {
    case 'heart': heart(R * 1.15, '#ff4f8b'); ctx.translate(-R * 0.25, -R * 0.25); heart(R * 0.3, 'rgba(255,255,255,.55)'); break;
    case 'star': star(R, R * 0.45, 5, '#ffcf3a'); star(R * 0.35, R * 0.16, 4, 'rgba(255,255,255,.7)'); break;
    case 'rainbow': {
      const cols = ['#ff5f7e', '#ffa64d', '#ffe14d', '#6fdc7a', '#5fb6ff', '#a07cff'];
      cols.forEach((col, i) => { ctx.beginPath(); ctx.arc(0, R * 0.45, R * (1 - i * 0.12), Math.PI, 0); ctx.lineWidth = R * 0.13; ctx.strokeStyle = col; ctx.stroke(); });
      ctx.beginPath(); ctx.arc(-R * 0.8, R * 0.45, R * 0.28, 0, TAU); ctx.arc(R * 0.8, R * 0.45, R * 0.28, 0, TAU); fill('#fff');
      break;
    }
    case 'moon':
      ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); fill('#ffe27a');
      ctx.globalCompositeOperation = 'destination-out'; ctx.beginPath(); ctx.arc(R * 0.45, -R * 0.25, R * 0.85, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over'; star(R * 0.28, R * 0.11, 4, '#fff6c4', 0); break;
    case 'sun':
      star(R, R * 0.7, 12, '#ffb43a'); ctx.beginPath(); ctx.arc(0, 0, R * 0.62, 0, TAU); fill('#ffe14d');
      ctx.beginPath(); ctx.arc(-R * 0.2, -R * 0.08, R * 0.07, 0, TAU); ctx.arc(R * 0.2, -R * 0.08, R * 0.07, 0, TAU); fill('#a5552a');
      ctx.beginPath(); ctx.arc(0, R * 0.1, R * 0.18, 0.15 * Math.PI, 0.85 * Math.PI); ctx.lineWidth = R * 0.07; ctx.strokeStyle = '#a5552a'; ctx.stroke(); break;
    case 'cloud':
      ctx.beginPath(); ctx.arc(-R * 0.45, R * 0.12, R * 0.42, 0, TAU); ctx.arc(R * 0.45, R * 0.12, R * 0.42, 0, TAU); ctx.arc(0, -R * 0.15, R * 0.55, 0, TAU); fill('#ffffff');
      ctx.beginPath(); ctx.arc(-R * 0.3, R * 0.85, R * 0.1, 0, TAU); ctx.arc(R * 0.1, R * 0.95, R * 0.1, 0, TAU); ctx.arc(R * 0.45, R * 0.82, R * 0.1, 0, TAU); fill('#7cc8ff'); break;
    case 'flower':
      for (let i = 0; i < 6; i++) { const a = (i * TAU) / 6; ctx.beginPath(); ctx.arc(Math.cos(a) * R * 0.52, Math.sin(a) * R * 0.52, R * 0.42, 0, TAU); fill(i % 2 ? '#ff8fd0' : '#ffa8dc'); }
      ctx.beginPath(); ctx.arc(0, 0, R * 0.36, 0, TAU); fill('#ffd84d'); break;
    case 'clover':
      for (let i = 0; i < 4; i++) { ctx.save(); ctx.rotate((i * TAU) / 4 + Math.PI / 4); ctx.translate(0, -R * 0.42); heart(R * 0.62, '#39c46e'); ctx.restore(); }
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(R * 0.2, R * 0.6, R * 0.5, R * 0.95); ctx.lineWidth = R * 0.1; ctx.strokeStyle = '#2a9d55'; ctx.stroke(); break;
    case 'bolt':
      ctx.beginPath(); ctx.moveTo(R * 0.15, -R); ctx.lineTo(-R * 0.55, R * 0.12); ctx.lineTo(-R * 0.02, R * 0.12); ctx.lineTo(-R * 0.2, R); ctx.lineTo(R * 0.6, -R * 0.2); ctx.lineTo(R * 0.06, -R * 0.2); ctx.closePath(); fill('#ffd23a'); break;
    case 'note':
      ctx.beginPath(); ctx.ellipse(-R * 0.45, R * 0.55, R * 0.3, R * 0.22, -0.4, 0, TAU); ctx.ellipse(R * 0.45, R * 0.35, R * 0.3, R * 0.22, -0.4, 0, TAU); fill('#8a5cff');
      ctx.beginPath(); ctx.moveTo(-R * 0.2, R * 0.5); ctx.lineTo(-R * 0.2, -R * 0.7); ctx.lineTo(R * 0.7, -R * 0.9); ctx.lineTo(R * 0.7, R * 0.3); ctx.lineWidth = R * 0.13; ctx.strokeStyle = '#8a5cff'; ctx.stroke(); break;
    case 'drop':
      ctx.beginPath(); ctx.moveTo(0, -R); ctx.bezierCurveTo(R * 0.2, -R * 0.5, R * 0.75, 0, R * 0.75, R * 0.3); ctx.arc(0, R * 0.3, R * 0.75, 0, Math.PI); ctx.bezierCurveTo(-R * 0.75, 0, -R * 0.2, -R * 0.5, 0, -R); fill('#4fb8ff');
      ctx.beginPath(); ctx.ellipse(-R * 0.28, R * 0.25, R * 0.12, R * 0.22, 0.3, 0, TAU); fill('rgba(255,255,255,.7)'); break;
    case 'crown':
      ctx.beginPath(); ctx.moveTo(-R, R * 0.55); ctx.lineTo(-R, -R * 0.45); ctx.lineTo(-R * 0.5, R * 0.05); ctx.lineTo(0, -R * 0.75); ctx.lineTo(R * 0.5, R * 0.05); ctx.lineTo(R, -R * 0.45); ctx.lineTo(R, R * 0.55); ctx.closePath(); fill('#ffc83a');
      ctx.beginPath(); ctx.arc(0, R * 0.15, R * 0.14, 0, TAU); fill('#ff5f9e'); ctx.beginPath(); ctx.arc(-R * 0.55, R * 0.25, R * 0.1, 0, TAU); ctx.arc(R * 0.55, R * 0.25, R * 0.1, 0, TAU); fill('#7fd6ff'); break;
  }
  ctx.restore();
}

function badgeDataURL(id, size = 96) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  drawBadge(cv.getContext('2d'), id, size);
  return cv.toDataURL();
}
