// ───────────────────────── Fluffsphere model: shell-textured fur + glossy eyes ─────────────────────────
const FUR_VERT = /* glsl */`
attribute float aShell;
attribute float aPart;
uniform float uFurLen;
uniform float uTime;
uniform vec3 uForce;
varying vec3 vObjN;
varying vec3 vObjP;
varying vec3 vN;
varying vec3 vWorldPos;
varying float vH;
varying float vPart;
void main(){
  vH = aShell; vPart = aPart; vObjN = normal; vObjP = position;
  float len = uFurLen * (aPart > 0.5 ? 0.6 : 1.0);
  vec3 p = position + normal * (len * aShell);
  float h2 = aShell * aShell;
  float sway = sin(uTime * 2.3 + position.x * 3.1 + position.y * 2.7) * 0.5 + sin(uTime * 3.9 + position.z * 3.5) * 0.3;
  vec3 f = uForce + vec3(sway * 0.22, sway * 0.08, sway * 0.18);
  p += f * h2 * len;
  p.y -= h2 * len * 0.28;
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vWorldPos = wp.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const FUR_FRAG = /* glsl */`
uniform vec3 uColor;
uniform vec3 uTip;
uniform vec3 uBelly;
uniform vec3 uRim;
uniform vec3 uLightDir;
uniform sampler2D uBadge;
uniform float uDensity;
uniform float uHit;
uniform float uA2C;
uniform float uWet;
varying vec3 vObjN;
varying vec3 vObjP;
varying vec3 vN;
varying vec3 vWorldPos;
varying float vH;
varying float vPart;
float hash2(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
void main(){
  vec3 n = normalize(vObjN);
  float alpha = 1.0;
  vec3 an = abs(n);
  vec2 pr; float ax;
  if (an.x > an.y && an.x > an.z) { pr = vObjP.yz; ax = n.x > 0.0 ? 1.0 : 2.0; }
  else if (an.y > an.z) { pr = vObjP.xz; ax = n.y > 0.0 ? 3.0 : 4.0; }
  else { pr = vObjP.xy; ax = n.z > 0.0 ? 5.0 : 6.0; }
  float clump = hash2(floor(pr * uDensity * 0.22 + ax * 5.0) + 3.3);
  vec2 curl = vec2(sin(vH * 5.0 + clump * 6.28), cos(vH * 4.0 + clump * 9.0)) * vH * vH * 0.9;
  vec2 q = pr * uDensity + ax * 17.0 + vPart * 31.0 + curl;
  vec2 cell = floor(q);
  vec2 f = fract(q) - 0.5;
  float r1 = hash2(cell);
  float r2 = hash2(cell + 7.7);
  vec2 jit = (vec2(r1, r2) - 0.5) * 0.3;
  float d = length(f - jit);
  if (vH > 0.001) {
    float strandH = (0.4 + 0.6 * r2) * (1.0 - uWet * 0.5);
    float thick = (0.5 + 0.12 * r1) * (1.0 - vH * 0.62);
    alpha = 1.0 - smoothstep(thick * 0.45, thick, d);
    alpha *= 1.0 - smoothstep(strandH - 0.12, strandH, vH);
    if (alpha < (uA2C > 0.5 ? 0.04 : 0.5)) discard;
  }
  vec3 base = mix(uColor * 0.74, uColor * 1.04, smoothstep(0.0, 0.8, vH));
  base = mix(base, uTip, vH * vH * 0.5);
  base *= 0.93 + 0.14 * clump;
  if (vPart < 0.5) {
    float bd = dot(n, normalize(vec3(0.0, -0.36, 1.0)));
    float belly = smoothstep(0.62, 0.7, bd);
    base = mix(base, uBelly * (0.85 + 0.2 * vH), belly);
    vec2 buv = vec2(n.x / 0.52 * 0.5 + 0.5, (n.y + 0.34) / 0.52 * 0.5 + 0.5);
    vec4 bg = texture2D(uBadge, buv);
    base = mix(base, bg.rgb * (0.9 + 0.15 * vH), bg.a * belly * step(0.0, n.z));
  }
  vec3 N = normalize(vN);
  vec3 L = normalize(uLightDir);
  vec3 V = normalize(cameraPosition - vWorldPos);
  float diff = clamp(dot(N, L) * 0.45 + 0.7, 0.0, 1.15);
  float ao = mix(0.6, 1.0, pow(vH, 0.6));
  float rim = pow(1.0 - max(dot(N, V), 0.0), 2.6);
  vec3 col = base * diff * ao;
  col += uRim * rim * 0.5 * (0.3 + vH);
  col += vec3(1.0, 0.95, 1.0) * pow(max(dot(reflect(-L, N), V), 0.0), 10.0) * 0.12 * vH;
  col = mix(col, vec3(1.0, 0.86, 0.95), uHit);
  gl_FragColor = vec4(col, alpha);
}`;

const EYE_VERT = /* glsl */`
varying vec3 vN;
varying vec3 vViewN;
void main(){
  vN = normal;
  vViewN = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const EYE_FRAG = /* glsl */`
uniform vec3 uLook;
uniform vec3 uIris;
uniform float uPupil;
uniform float uTime;
varying vec3 vN;
varying vec3 vViewN;
void main(){
  vec3 n = normalize(vN);
  vec3 lk = normalize(uLook);
  float a = acos(clamp(dot(n, lk), -1.0, 1.0));
  vec3 up = abs(lk.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3 tx = normalize(cross(up, lk));
  vec3 ty = cross(lk, tx);
  float ang = atan(dot(n, ty), dot(n, tx));
  float irisR = 0.66;
  float pupR = 0.3 * uPupil;
  float t = a / irisR;
  vec3 sclera = vec3(1.0, 0.985, 0.995) * (0.84 + 0.16 * n.z);
  float streak = 0.5 + 0.5 * sin(ang * 22.0 + sin(ang * 5.0) * 2.5);
  vec3 iris = mix(uIris * 1.45 + 0.08, uIris * 0.55, smoothstep(0.25, 1.0, t));
  iris *= 0.8 + 0.3 * streak * smoothstep(0.3, 0.85, t);
  iris += vec3(1.0, 0.9, 0.7) * 0.18 * smoothstep(0.55, 0.35, abs(t - 0.5)) * streak;
  iris = mix(iris, uIris * 0.18, smoothstep(0.8, 1.0, t));
  vec3 col = sclera;
  col = mix(col, iris, smoothstep(irisR + 0.025, irisR - 0.025, a));
  col = mix(col, vec3(0.03, 0.015, 0.05), smoothstep(pupR + 0.02, pupR - 0.02, a));
  float spark = step(0.985, fract(sin(dot(floor(vec2(ang * 9.0, t * 6.0)), vec2(12.9, 78.2))) * 43758.5));
  col += spark * smoothstep(1.0, 0.4, t) * step(pupR, a) * 0.35 * (0.5 + 0.5 * sin(uTime * 3.0 + ang * 4.0));
  col *= mix(0.62, 1.0, smoothstep(0.92, 0.45, n.y));
  vec3 vn = normalize(vViewN);
  float c1 = smoothstep(0.972, 0.985, dot(vn, normalize(vec3(-0.42, 0.5, 0.76))));
  float c2 = smoothstep(0.990, 0.995, dot(vn, normalize(vec3(0.34, -0.3, 0.89))));
  float glow = pow(max(dot(vn, normalize(vec3(-0.3, 0.4, 0.86))), 0.0), 18.0) * 0.18;
  col += vec3(c1 + c2 * 0.85 + glow);
  gl_FragColor = vec4(col, 1.0);
}`;

const _furGeoCache = {};
function buildFurGeometry(shells, seg) {
  const key = shells + '_' + seg;
  if (_furGeoCache[key]) return _furGeoCache[key];
  const parts = [
    { c: [0, 0, 0], r: 0.82, s: [1, 0.96, 1], seg, part: 0 },
    { c: [-0.56, 0.62, -0.08], r: 0.24, s: [1, 1, 0.75], seg: Math.max(10, seg >> 1), part: 1 },
    { c: [0.56, 0.62, -0.08], r: 0.24, s: [1, 1, 0.75], seg: Math.max(10, seg >> 1), part: 1 },
    { c: [-0.36, -0.74, 0.32], r: 0.2, s: [1.1, 0.7, 1.2], seg: Math.max(8, seg >> 2), part: 1 },
    { c: [0.36, -0.74, 0.32], r: 0.2, s: [1.1, 0.7, 1.2], seg: Math.max(8, seg >> 2), part: 1 },
  ];
  const pos = [], nor = [], sh = [], pa = [], idx = [];
  let vOff = 0;
  for (let s = 0; s < shells; s++) {
    const h = shells > 1 ? s / (shells - 1) : 0;
    for (const p of parts) {
      const g = new THREE.SphereGeometry(1, p.seg, Math.max(6, Math.round(p.seg * 0.75)));
      const P = g.attributes.position, Nn = g.attributes.normal;
      for (let i = 0; i < P.count; i++) {
        const nx = Nn.getX(i) / p.s[0], ny = Nn.getY(i) / p.s[1], nz = Nn.getZ(i) / p.s[2];
        const nl = Math.hypot(nx, ny, nz);
        pos.push(p.c[0] + P.getX(i) * p.r * p.s[0], p.c[1] + P.getY(i) * p.r * p.s[1], p.c[2] + P.getZ(i) * p.r * p.s[2]);
        nor.push(nx / nl, ny / nl, nz / nl); sh.push(h); pa.push(p.part);
      }
      const I = g.index.array;
      for (let i = 0; i < I.length; i++) idx.push(I[i] + vOff);
      vOff += P.count;
      g.dispose();
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('aShell', new THREE.Float32BufferAttribute(sh, 1));
  geo.setAttribute('aPart', new THREE.Float32BufferAttribute(pa, 1));
  geo.setIndex(vOff > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
  geo.computeBoundingSphere();
  geo.boundingSphere.radius = 1.6;
  return (_furGeoCache[key] = geo);
}

function canvasTex(w, h, draw) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); t.needsUpdate = true; return t;
}

const FACE_TEX = {};
function faceTextures() {
  if (FACE_TEX.happy) return FACE_TEX;
  const mouth = (kind) => canvasTex(128, 64, (c, w, h) => {
    c.strokeStyle = '#5a2a4a'; c.fillStyle = '#5a2a4a'; c.lineWidth = 7; c.lineCap = 'round';
    c.beginPath();
    if (kind === 'happy') { c.arc(w / 2 - 14, 18, 14, 0.1 * Math.PI, 0.9 * Math.PI); c.moveTo(w / 2 + 28, 22); c.arc(w / 2 + 14, 18, 14, 0.1 * Math.PI, 0.9 * Math.PI); c.stroke(); }
    else if (kind === 'wow') { c.ellipse(w / 2, 32, 12, 16, 0, 0, TAU); c.fill(); c.fillStyle = '#ff7aa8'; c.beginPath(); c.ellipse(w / 2, 40, 7, 6, 0, 0, TAU); c.fill(); }
    else if (kind === 'hurt') { c.moveTo(w / 2 - 26, 36); for (let i = 0; i <= 4; i++) c.lineTo(w / 2 - 26 + i * 13, i % 2 ? 22 : 36); c.stroke(); }
    else { c.arc(w / 2, 48, 18, 1.15 * Math.PI, 1.85 * Math.PI); c.stroke(); }
  });
  FACE_TEX.happy = mouth('happy'); FACE_TEX.wow = mouth('wow'); FACE_TEX.hurt = mouth('hurt'); FACE_TEX.sad = mouth('sad');
  FACE_TEX.blush = canvasTex(64, 64, (c, w) => {
    const g = c.createRadialGradient(w / 2, w / 2, 2, w / 2, w / 2, w / 2);
    g.addColorStop(0, 'rgba(255,110,160,.75)'); g.addColorStop(1, 'rgba(255,110,160,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, w);
  });
  return FACE_TEX;
}

class FluffModel {
  constructor(profile, opts = {}) {
    const q = Q();
    this.group = new THREE.Group();
    this.inner = new THREE.Group();
    this.group.add(this.inner);
    this.badgeCanvas = document.createElement('canvas'); this.badgeCanvas.width = this.badgeCanvas.height = 256;
    this.badgeTex = new THREE.CanvasTexture(this.badgeCanvas);
    this.furMat = new THREE.ShaderMaterial({
      vertexShader: FUR_VERT, fragmentShader: FUR_FRAG,
      uniforms: {
        uFurLen: { value: 0.3 }, uTime: { value: 0 }, uForce: { value: new THREE.Vector3() },
        uColor: { value: new THREE.Color() }, uTip: { value: new THREE.Color() }, uBelly: { value: new THREE.Color() },
        uRim: { value: new THREE.Color('#ffe3ff') }, uLightDir: { value: new THREE.Vector3(-0.4, 0.9, 0.6) },
        uBadge: { value: this.badgeTex }, uDensity: { value: Settings.quality === 'high' ? 24 : Settings.quality === 'medium' ? 19 : 15 },
        uHit: { value: 0 }, uA2C: { value: q.aa ? 1 : 0 }, uWet: { value: 0 },
      },
    });
    this.furMat.alphaToCoverage = !!q.aa;
    this.fur = new THREE.Mesh(buildFurGeometry(q.shells, q.seg), this.furMat);
    this.fur.frustumCulled = false;
    this.inner.add(this.fur);

    // eyes
    const eyeGeo = new THREE.SphereGeometry(1, 32, 24);
    this.eyes = [];
    for (const sx of [-1, 1]) {
      const mat = new THREE.ShaderMaterial({
        vertexShader: EYE_VERT, fragmentShader: EYE_FRAG,
        uniforms: { uLook: { value: new THREE.Vector3(0, 0, 1) }, uIris: { value: new THREE.Color() }, uPupil: { value: 1 }, uTime: { value: 0 } },
      });
      const pivot = new THREE.Group();
      const m = new THREE.Mesh(eyeGeo, mat);
      m.scale.set(0.27, 0.31, 0.2);
      pivot.add(m);
      this.inner.add(pivot);
      this.eyes.push({ pivot, mesh: m, mat, side: sx });
    }
    const ft = faceTextures();
    this.mouth = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.17), new THREE.MeshBasicMaterial({ map: ft.happy, transparent: true, depthWrite: false }));
    this.inner.add(this.mouth);
    this.blush = [];
    for (const sx of [-1, 1]) {
      const b = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.22), new THREE.MeshBasicMaterial({ map: ft.blush, transparent: true, depthWrite: false }));
      this.inner.add(b); this.blush.push({ mesh: b, side: sx });
    }
    // contact shadow
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 24), new THREE.MeshBasicMaterial({ color: 0x6a3a7a, transparent: true, opacity: 0.18, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2; this.shadow.scale.set(0.9, 0.5, 1); this.shadow.position.y = -0.98;
    this.group.add(this.shadow);

    this.look = new THREE.Vector3(0, 0, 10);
    this.lookTarget = null;
    this.blinkT = rand(1, 4); this.blinkPhase = 0;
    this.squash = 0; this.squashV = 0;
    this.furOff = new THREE.Vector3(); this.furVel = new THREE.Vector3();
    this.yaw = 0; this.exprTimer = 0; this.expr = 'happy'; this.hit = 0;
    this.setProfile(profile);
  }

  setProfile(p) {
    this.profile = p;
    const u = this.furMat.uniforms;
    u.uColor.value.set(p.fur);
    u.uTip.value.set(mixHex(p.fur, '#ffffff', 0.45));
    u.uBelly.value.set(mixHex(p.fur, '#fff6fb', 0.62));
    u.uFurLen.value = 0.09 + clamp(p.furLen, 0, 1) * 0.3;
    const ctx = this.badgeCanvas.getContext('2d');
    ctx.clearRect(0, 0, 256, 256);
    ctx.save(); ctx.translate(48, 48); drawBadge(ctx, p.badge, 160); ctx.restore();
    this.badgeTex.needsUpdate = true;
    for (const e of this.eyes) e.mat.uniforms.uIris.value.set(p.eye);
    this.layoutFace();
  }

  layoutFace() {
    const r = 0.82 + this.furMat.uniforms.uFurLen.value * 0.5;
    for (const e of this.eyes) {
      const d = new THREE.Vector3(e.side * 0.36, 0.16, 0.92).normalize();
      e.pivot.position.copy(d.multiplyScalar(r * 0.94));
    }
    this.mouth.position.set(0, -0.1, r * 0.99 + 0.02);
    for (const b of this.blush) b.mesh.position.set(b.side * 0.5, -0.05, r * 0.86);
  }

  setExpression(kind, dur = 1.2) { this.expr = kind; this.exprTimer = dur; this.mouth.material.map = faceTextures()[kind] || faceTextures().happy; }
  flash() { this.hit = 1; }
  blink() { this.blinkPhase = 0.0001; }

  update(dt, t, st = {}) {
    const u = this.furMat.uniforms;
    u.uTime.value = t;
    // spring-driven fur inertia
    const target = new THREE.Vector3(-(st.vx || 0) * 0.05 + (st.wind || 0) * 0.06, -(st.vy || 0) * 0.04, 0);
    if (target.length() > 1.4) target.setLength(1.4);
    const acc = target.clone().sub(this.furOff).multiplyScalar(70).addScaledVector(this.furVel, -7);
    this.furVel.addScaledVector(acc, dt); this.furOff.addScaledVector(this.furVel, dt);
    u.uForce.value.copy(this.furOff);
    u.uWet.value = damp(u.uWet.value, st.wet ? 1 : 0, 2, dt);
    // squash & stretch
    if (st.impact) { this.squashV -= st.impact; }
    const sAcc = -this.squash * 180 - this.squashV * 10;
    this.squashV += sAcc * dt; this.squash += this.squashV * dt;
    const breathe = Math.sin(t * 2.2 + this.group.id) * 0.015;
    const air = st.grounded === false ? clamp(Math.abs(st.vy || 0) * 0.006, 0, 0.12) : 0;
    const sq = clamp(this.squash, -0.35, 0.35) + breathe - air;
    this.inner.scale.set(1 - sq * 0.6, 1 + sq, 1 - sq * 0.6);
    this.inner.position.y = sq * 0.4;
    // turn slightly towards look target
    if (this.lookTarget) {
      const lp = this.group.worldToLocal(this.lookTarget.clone());
      this.yaw = damp(this.yaw, clamp(lp.x * 0.05, -0.45, 0.45), 6, dt);
      for (const e of this.eyes) {
        const ep = e.pivot.position.clone().add(this.inner.position);
        const dir = lp.clone().sub(ep);
        dir.x -= this.yaw * 2; dir.normalize();
        // clamp gaze to a natural cone
        const fwd = new THREE.Vector3(0, 0, 1);
        const ang = dir.angleTo(fwd), maxA = 0.62;
        if (ang > maxA) dir.lerp(fwd, 1 - maxA / ang).normalize();
        e.mat.uniforms.uLook.value.lerp(dir, 1 - Math.exp(-14 * dt)).normalize();
      }
    }
    this.inner.rotation.y = this.yaw;
    this.inner.rotation.z = damp(this.inner.rotation.z, clamp(-(st.vx || 0) * 0.025, -0.3, 0.3), 6, dt);
    // blinking
    this.blinkT -= dt;
    if (this.blinkT <= 0 && !this.blinkPhase) { this.blinkPhase = 0.0001; this.blinkT = rand(2, 5.5); if (Math.random() < 0.2) this.blinkT = 0.25; }
    let lid = 1;
    if (this.blinkPhase) { this.blinkPhase += dt; const p = this.blinkPhase / 0.16; lid = p < 0.5 ? 1 - p * 1.8 : Math.min(1, 0.1 + (p - 0.5) * 1.8); if (p >= 1) this.blinkPhase = 0; }
    const sad = this.expr === 'hurt' || this.expr === 'sad';
    for (const e of this.eyes) {
      e.mesh.scale.y = 0.31 * Math.max(0.06, lid) * (sad ? 0.82 : 1);
      e.mat.uniforms.uTime.value = t;
      e.mat.uniforms.uPupil.value = damp(e.mat.uniforms.uPupil.value, this.expr === 'wow' ? 0.7 : sad ? 0.85 : 1.08, 5, dt);
    }
    if (this.exprTimer > 0) { this.exprTimer -= dt; if (this.exprTimer <= 0 && this.expr !== 'happy') this.setExpression('happy', 0); }
    this.hit = Math.max(0, this.hit - dt * 3);
    u.uHit.value = this.hit * 0.8;
    this.shadow.visible = st.grounded !== false;
  }

  dispose() { this.furMat.dispose(); this.badgeTex.dispose(); this.eyes.forEach((e) => e.mat.dispose()); }
}
