// ───────────────────────── Destructible candy terrain (mask texture + layered 2.5D slab) ─────────────────────────
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const TERRAIN_THEMES = [
  { name: 'Erdbeer-Sahne', top: '#fff4fb', body1: '#ffa8d2', body2: '#ffc6e2', deep: '#c98bd8', sprinkle: 1 },
  { name: 'Lavendel-Macaron', top: '#f6f0ff', body1: '#bfa6ff', body2: '#d9c9ff', deep: '#8f78d6', sprinkle: 1 },
  { name: 'Minz-Eiscreme', top: '#fffaf2', body1: '#9fe8cc', body2: '#c4f4e0', deep: '#6fb8b8', sprinkle: 1 },
  { name: 'Pfirsich-Torte', top: '#fff8f0', body1: '#ffc09a', body2: '#ffd9bd', deep: '#d898a8', sprinkle: 1 },
];

const TERRAIN_VERT = `varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`;
const TERRAIN_FRAG = `
uniform sampler2D uMask; uniform vec2 uTexel; uniform float uLayer; uniform float uTime;
uniform vec3 uTop; uniform vec3 uBody1; uniform vec3 uBody2; uniform vec3 uDeep;
varying vec2 vUv; varying vec3 vW;
float S(vec2 o){ return texture2D(uMask, vUv + o * uTexel).r; }
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main(){
  vec4 M = texture2D(uMask, vUv);
  float m = M.r;
  float a = smoothstep(0.38, 0.62, m);
  if (a < 0.03) discard;
  if (uLayer > 0.5) {
    vec3 lid = mix(uTop, uBody1, 0.16 + uLayer * 0.05) * (0.98 - uLayer * 0.03);
    lid = mix(lid, uDeep, smoothstep(10.0, 0.0, vW.y) * 0.5);
    gl_FragColor = vec4(lid, 1.0);
    return;
  }
  float dx = S(vec2(2.0, 0.0)) - S(vec2(-2.0, 0.0));
  float dy = S(vec2(0.0, 2.0)) - S(vec2(0.0, -2.0));
  vec3 n = normalize(vec3(-dx * 1.6, -dy * 1.6, 1.0));
  float depth = 99.0;
  for (int i = 1; i <= 9; i++) { if (depth > 98.0 && S(vec2(0.0, float(i) * 1.3)) < 0.5) depth = float(i); }
  float drip = 3.0 + 1.3 * sin(vW.x * 1.9) + 0.9 * sin(vW.x * 4.3 + 1.0) + 2.4 * smoothstep(0.7, 0.95, sin(vW.x * 0.9) * 0.5 + 0.5);
  float frost = 1.0 - smoothstep(drip - 0.6, drip + 0.4, depth);
  float stripe = sin(vW.y * 1.1 + sin(vW.x * 0.35) * 1.4) * 0.5 + 0.5;
  vec3 body = mix(uBody1, uBody2, smoothstep(0.35, 0.65, stripe));
  float deep = smoothstep(14.0, 0.0, vW.y) * 0.55;
  body = mix(body, uDeep, deep);
  vec2 cp = floor(vW.xy * 2.2);
  float chip = step(0.93, hash(cp)) * step(length(fract(vW.xy * 2.2) - 0.5), 0.22);
  body = mix(body, uDeep * 0.75, chip * 0.7);
  vec3 col = mix(body, uTop, frost);
  vec2 sp = floor(vW.xy * 3.0);
  float sh = hash(sp);
  vec2 sf = fract(vW.xy * 3.0) - 0.5;
  float ang = sh * 6.283;
  vec2 rd = vec2(cos(ang), sin(ang));
  float along = dot(sf, rd), across = dot(sf, vec2(-rd.y, rd.x));
  float spr = step(0.8, sh) * step(abs(along), 0.22) * step(abs(across), 0.06) * frost;
  vec3 sc = vec3(0.5 + 0.5 * cos(6.283 * (sh * 3.0 + vec3(0.0, 0.33, 0.67))));
  col = mix(col, sc * 0.6 + 0.45, spr);
  float scorch = M.g;
  float glit = step(0.9, hash(floor(vW.xy * 5.0) + floor(uTime * 4.0)));
  col = mix(col, vec3(0.86, 0.5, 0.62) * (0.85 + 0.3 * glit), scorch * 0.55);
  vec3 L = normalize(vec3(-0.45, 0.8, 0.55));
  float lit = clamp(dot(n, L) * 0.55 + 0.62, 0.0, 1.25);
  float edge = 1.0 - smoothstep(0.62, 0.95, m);
  col *= lit;
  col = mix(col, col * 0.62, edge * 0.8);
  col += vec3(1.0, 0.9, 1.0) * pow(max(n.y, 0.0), 6.0) * 0.25 * (1.0 - edge);
  col *= 1.0 - uLayer * 0.09;
  gl_FragColor = vec4(col, 1.0);
}`;

class Terrain {
  constructor(scene, W, H, res = 4) {
    this.scene = scene; this.W = W; this.H = H; this.res = res;
    this.cols = W * res; this.rows = H * res;
    this.mask = new Uint8Array(this.cols * this.rows);
    this.data = new Uint8Array(this.cols * this.rows * 4);
    this.tex = new THREE.DataTexture(this.data, this.cols, this.rows, THREE.RGBAFormat);
    this.tex.magFilter = THREE.LinearFilter; this.tex.minFilter = THREE.LinearFilter;
    this.tex.generateMipmaps = false; this.tex.flipY = false;
    this.layers = [];
    this.group = new THREE.Group();
    scene.add(this.group);
    this.mini = document.createElement('canvas'); this.mini.width = W; this.mini.height = H;
    this.dirty = false;
  }

  build(theme) {
    for (const l of this.layers) { this.group.remove(l); l.material.dispose(); }
    this.layers = [];
    this.theme = theme;
    const n = Q().terrainLayers, spacing = 3.6 / (n - 1);
    const geo = new THREE.PlaneGeometry(this.W, this.H);
    for (let i = n - 1; i >= 0; i--) {
      const mat = new THREE.ShaderMaterial({
        vertexShader: TERRAIN_VERT, fragmentShader: TERRAIN_FRAG,
        uniforms: {
          uMask: { value: this.tex }, uTexel: { value: new THREE.Vector2(1 / this.cols, 1 / this.rows) }, uLayer: { value: i }, uTime: { value: 0 },
          uTop: { value: new THREE.Color(theme.top) }, uBody1: { value: new THREE.Color(theme.body1) }, uBody2: { value: new THREE.Color(theme.body2) }, uDeep: { value: new THREE.Color(theme.deep) },
        },
      });
      const m = new THREE.Mesh(geo, mat);
      m.position.set(this.W / 2, this.H / 2, -i * spacing);
      mat.uniforms.uLayer.value = i === 0 ? 0 : 1 + (i / (n - 1)) * 5;
      m.renderOrder = 10 - i;
      this.group.add(m); this.layers.push(m);
    }
  }

  generate(seed) {
    const r = mulberry32(seed);
    const { cols, rows, res, W } = this;
    this.mask.fill(0);
    const comps = [];
    for (let i = 0; i < 5; i++) comps.push({ a: [7, 4.5, 2.5, 1.4, 0.7][i] * (0.6 + r() * 0.8), f: [0.025, 0.055, 0.11, 0.21, 0.4][i] * (0.8 + r() * 0.4), p: r() * TAU });
    const hills = [];
    for (let i = 0; i < 3; i++) hills.push({ x: 20 + r() * (W - 40), w: 6 + r() * 10, h: 5 + r() * 9 });
    const base = 15 + r() * 5;
    this.heights = new Float32Array(cols);
    for (let cx = 0; cx < cols; cx++) {
      const x = cx / res;
      let h = base;
      for (const c of comps) h += Math.sin(x * c.f + c.p) * c.a;
      for (const hl of hills) h += hl.h * Math.exp(-((x - hl.x) ** 2) / (2 * hl.w * hl.w));
      const edge = Math.min(x, W - x);
      h *= smooth01(clamp(edge / 14, 0, 1)) * 0.75 + 0.25;
      h = clamp(h, 3, this.H * 0.62);
      this.heights[cx] = h;
      const top = Math.floor(h * res);
      for (let cy = 0; cy < Math.min(top, rows); cy++) this.mask[cy * cols + cx] = 255;
    }
    // caves
    for (let i = 0; i < 4; i++) {
      const x = 20 + r() * (W - 40), hy = this.heights[Math.floor(x * res)];
      if (hy < 14) continue;
      this.ellipse(x, 4 + r() * (hy - 10), 3 + r() * 5, 1.8 + r() * 2.4, 0);
    }
    // floating islands
    const islands = 2 + Math.floor(r() * 3);
    for (let i = 0; i < islands; i++) {
      const x = 16 + r() * (W - 32), hy = this.heights[Math.floor(x * res)];
      const y = Math.min(this.H - 12, hy + 11 + r() * 10);
      const w = 5 + r() * 6;
      this.ellipse(x, y, w, 2.2 + r() * 1.2, 255);
      this.ellipse(x, y - 2, w * 0.6, 2.4, 255);
    }
    this.data.fill(0);
    for (let i = 0; i < this.mask.length; i++) { this.data[i * 4] = this.mask[i]; this.data[i * 4 + 3] = 255; }
    this.tex.needsUpdate = true;
    this.updateMini();
  }

  ellipse(x, y, rx, ry, val) {
    const { res, cols, rows } = this;
    const x0 = Math.max(0, Math.floor((x - rx) * res)), x1 = Math.min(cols - 1, Math.ceil((x + rx) * res));
    const y0 = Math.max(0, Math.floor((y - ry) * res)), y1 = Math.min(rows - 1, Math.ceil((y + ry) * res));
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      const dx = (cx / res - x) / rx, dy = (cy / res - y) / ry;
      if (dx * dx + dy * dy <= 1) this.mask[cy * cols + cx] = val;
    }
  }

  solid(x, y) {
    const cx = Math.floor(x * this.res), cy = Math.floor(y * this.res);
    if (cx < 0 || cx >= this.cols || cy < 0 || cy >= this.rows) return false;
    return this.mask[cy * this.cols + cx] > 127;
  }

  // circle overlap test (samples ring + center)
  hitsCircle(x, y, r) {
    if (this.solid(x, y)) return true;
    for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; if (this.solid(x + Math.cos(a) * r, y + Math.sin(a) * r)) return true; }
    return false;
  }

  carve(x, y, r) {
    const { res, cols, rows } = this;
    const R2 = r + 1.1;
    const x0 = Math.max(0, Math.floor((x - R2) * res)), x1 = Math.min(cols - 1, Math.ceil((x + R2) * res));
    const y0 = Math.max(0, Math.floor((y - R2) * res)), y1 = Math.min(rows - 1, Math.ceil((y + R2) * res));
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      const d = Math.hypot(cx / res - x, cy / res - y);
      const i = cy * cols + cx;
      if (d < r) { this.mask[i] = 0; this.data[i * 4] = 0; }
      else if (d < R2 && this.mask[i]) this.data[i * 4 + 1] = Math.max(this.data[i * 4 + 1], Math.floor(255 * (1 - (d - r) / 1.1)));
    }
    this.dirty = true;
  }

  add(x, y, r) {
    const { res, cols, rows } = this;
    const x0 = Math.max(0, Math.floor((x - r) * res)), x1 = Math.min(cols - 1, Math.ceil((x + r) * res));
    const y0 = Math.max(0, Math.floor((y - r) * res)), y1 = Math.min(rows - 1, Math.ceil((y + r) * res));
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      const dx = cx / res - x, dy = (cy / res - y) * 1.6;
      if (dx * dx + dy * dy < r * r) { const i = cy * cols + cx; this.mask[i] = 255; this.data[i * 4] = 255; this.data[i * 4 + 1] = 0; }
    }
    this.dirty = true;
  }

  surfaceY(x, fromY = this.H - 1) {
    for (let y = fromY; y > 0; y -= 0.25) if (this.solid(x, y)) return y + 0.25;
    return -10;
  }

  normalAt(x, y) {
    let nx = 0, ny = 0;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU, c = Math.cos(a), s = Math.sin(a);
      if (this.solid(x + c * 1.2, y + s * 1.2)) { nx -= c; ny -= s; }
    }
    const l = Math.hypot(nx, ny);
    return l > 0 ? { x: nx / l, y: ny / l } : { x: 0, y: 1 };
  }

  updateMini() {
    const c = this.mini.getContext('2d'), { W, H, res, cols } = this;
    const img = c.createImageData(W, H);
    const col = new THREE.Color(this.theme ? this.theme.body1 : '#ffa8d2');
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const s = this.mask[Math.floor((y + 0.5) * res) * cols + Math.floor((x + 0.5) * res)] > 127;
      const i = ((H - 1 - y) * W + x) * 4;
      if (s) { img.data[i] = col.r * 255; img.data[i + 1] = col.g * 255; img.data[i + 2] = col.b * 255; img.data[i + 3] = 255; }
    }
    c.putImageData(img, 0, 0);
  }

  update(dt, t) {
    for (const l of this.layers) l.material.uniforms.uTime.value = t;
    if (this.dirty) { this.tex.needsUpdate = true; this.dirty = false; this.miniDirty = true; }
  }
}
