// ───────────────────────── Magic butterflies & butterfly-effect events ─────────────────────────
const BUTTERFLY_EVENTS = [
  { id: 'gravity', name: 'Gravitations-Umkehr', emoji: '🙃', w: 1, desc: 'Für eine ganze Runde fallen Geschosse nach oben und alle Fluffspheres schweben wie auf dem Mond.', run: (g) => g.setAntiGravity() },
  { id: 'meteors', name: 'Sternschnuppen-Schauer', emoji: '🌠', w: 1.2, desc: 'Ein Schauer explodierender Sterne regnet auf die Arena herab.', run: (g, x) => g.meteorShower(x) },
  { id: 'swap', name: 'Plötzlicher Platztausch', emoji: '🔄', w: 1, desc: 'Zwei zufällige Fluffspheres tauschen per Glitzer-Teleport die Plätze.', run: (g) => g.swapRandom() },
  { id: 'shockwave', name: 'Plüsch-Druckwelle', emoji: '💫', w: 1.2, desc: 'Eine riesige Druckwelle aus Plüsch schleudert alle in der Nähe davon.', run: (g, x, y) => g.shockwave(x, y, 20, 10) },
  { id: 'heal', name: 'Regenbogen-Heilung', emoji: '💖', w: 0.9, desc: 'Ein Regenbogenregen heilt alle Fluffspheres im Umkreis um 20 LP.', run: (g, x, y) => g.healArea(x, y, 18, 20) },
  { id: 'storm', name: 'Zuckerwatte-Sturm', emoji: '🌪️', w: 0.9, desc: 'Der Wind dreht durch: maximale Windstärke für die nächsten Züge.', run: (g) => g.setStorm() },
  { id: 'cards', name: 'Kartenregen', emoji: '🃏', w: 0.8, desc: 'Jeder Spieler erhält eine zufällige Aktionskarte geschenkt.', run: (g) => g.cardRain() },
  { id: 'swarm', name: 'Schmetterlingsschwarm', emoji: '🦋', w: 0.8, desc: 'Drei neue Schmetterlinge schlüpfen – mehr Chaos, mehr Kettenreaktionen!', run: (g, x, y) => g.butterflies.spawnNear(x, y, 3) },
  { id: 'island', name: 'Zuckerguss-Insel', emoji: '🏝️', w: 0.8, desc: 'Aus dem Nichts wächst eine neue Insel aus Zuckerguss in die Arena.', run: (g, x, y) => g.sugarIsland(x, y) },
];

const WING_FRAG = `uniform float uHue; uniform float uTime; varying vec2 vUv;
vec3 hue(float h){ return clamp(abs(mod(h*6.0+vec3(0.,4.,2.),6.)-3.)-1.,0.,1.); }
float ell(vec2 p, vec2 c, vec2 r){ vec2 d = (p - c) / r; return dot(d, d); }
void main(){
  vec2 p = vUv;
  float up = ell(p, vec2(0.52, 0.66), vec2(0.5, 0.36));
  float lo = ell(p, vec2(0.36, 0.26), vec2(0.34, 0.27));
  float m = min(up, lo);
  if (m > 1.0) discard;
  float edge = smoothstep(0.62, 1.0, m);
  vec3 c = mix(hue(uHue + p.x * 0.18 + sin(uTime * 2.0) * 0.04), hue(uHue + 0.12), p.y);
  c = mix(c * 1.25 + 0.15, vec3(0.35, 0.15, 0.45), edge * 0.85);
  float spot = smoothstep(0.012, 0.004, ell(p, vec2(0.78, 0.78), vec2(0.08, 0.08)) * 0.01) + smoothstep(0.012, 0.004, ell(p, vec2(0.55, 0.22), vec2(0.07, 0.07)) * 0.01);
  c = mix(c, vec3(1.0), spot * 0.9);
  float vein = smoothstep(0.03, 0.0, abs(fract(atan(p.y - 0.45, p.x) * 3.0) - 0.5) * (1.0 - p.x)) * 0.25;
  c -= vein;
  gl_FragColor = vec4(c, 1.0);
}`;

class Butterflies {
  constructor(game, count) {
    this.game = game; this.list = [];
    this.wingGeo = new THREE.PlaneGeometry(1.25, 1.25); this.wingGeo.translate(0.62, 0, 0);
    this.glowTex = canvasTex(64, 64, (c) => { const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); });
    for (let i = 0; i < count; i++) this.spawn();
  }

  makeMesh(h) {
    const g = new THREE.Group();
    const mat = new THREE.ShaderMaterial({ uniforms: { uHue: { value: h }, uTime: { value: 0 } }, vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`, fragmentShader: WING_FRAG, side: THREE.DoubleSide });
    const wl = new THREE.Mesh(this.wingGeo, mat), wr = new THREE.Mesh(this.wingGeo, mat);
    wr.scale.x = -1;
    const pl = new THREE.Group(), pr = new THREE.Group(); pl.add(wl); pr.add(wr);
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.7, 4, 8), new THREE.MeshBasicMaterial({ color: '#4a2a5a' }));
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: new THREE.Color().setHSL(h, 1, 0.75), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.setScalar(4.2);
    g.add(glow, pl, pr, body);
    g.rotation.x = -0.35;
    g.userData = { pl, pr, mat, glow };
    g.scale.setScalar(1.1);
    return g;
  }

  randomSpot() {
    const g = this.game;
    const x = rand(10, g.W - 10);
    const s = g.terrain.surfaceY(x);
    return { x, y: clamp(Math.max(s, g.world.seaY) + rand(5, 16), 8, g.H - 6) };
  }

  spawn(at = null) {
    const p = at || this.randomSpot();
    const hue = Math.random();
    const b = { x: p.x, y: p.y, z: rand(0.5, 2.5), tx: p.x, ty: p.y, hue, cooldown: 0, alive: true, ph: rand(0, TAU), mesh: this.makeMesh(hue), born: 0 };
    b.mesh.position.set(b.x, b.y, b.z);
    this.game.scene.add(b.mesh);
    this.list.push(b);
    return b;
  }

  spawnNear(x, y, n) {
    for (let i = 0; i < n; i++) this.spawn({ x: clamp(x + rand(-14, 14), 6, this.game.W - 6), y: clamp(y + rand(4, 12), 6, this.game.H - 6) }).immune = 2.5;
    this.game.world.sparkleBurst(x, y, '#e8c8ff', 30);
  }

  active() { return this.list.filter((b) => b.alive && b.cooldown <= 0); }

  hitTest(x, y, r, hitSet) {
    for (const b of this.list) {
      if (!b.alive || b.cooldown > 0 || b.immune > 0 || (hitSet && hitSet.has(b))) continue;
      if (Math.hypot(b.x - x, b.y - y) < r) { if (hitSet) hitSet.add(b); this.trigger(b, 0); }
    }
  }

  explosionTest(x, y, r) {
    for (const b of this.list) if (b.alive && b.cooldown <= 0 && !(b.immune > 0) && Math.hypot(b.x - x, b.y - y) < r + 1.5) this.trigger(b, 1);
  }

  trigger(b, depth) {
    if (b.cooldown > 0 || !b.alive) return;
    b.cooldown = 2;
    b.mesh.visible = false;
    const g = this.game;
    g.world.sparkleBurst(b.x, b.y, new THREE.Color().setHSL(b.hue, 1, 0.75).getStyle(), 46, 12);
    g.world.ring(b.x, b.y, b.z, 6, '#f2d4ff', 0.7);
    Sfx.chime();
    const ev = this.pickEvent();
    g.chainCount = depth > 0 ? (g.chainCount || 1) + 1 : 1;
    g.onButterflyEvent(ev, b.x, b.y, g.chainCount);
    // chain reaction to nearby butterflies (capped so chaos stays fun)
    const maxDepth = g.mode === 'chaos' ? 4 : 2;
    if (depth >= maxDepth) return;
    for (const o of this.list) {
      if (o !== b && o.alive && o.cooldown <= 0 && !(o.immune > 0) && Math.hypot(o.x - b.x, o.y - b.y) < 9) {
        g.later(0.55, () => this.trigger(o, depth + 1));
      }
    }
  }

  pickEvent() {
    const total = BUTTERFLY_EVENTS.reduce((s, e) => s + e.w, 0);
    let r = Math.random() * total;
    for (const e of BUTTERFLY_EVENTS) { r -= e.w; if (r <= 0) return e; }
    return BUTTERFLY_EVENTS[0];
  }

  lureTo(f) {
    let b = this.active().sort((a, c) => Math.hypot(a.x - f.x, a.y - f.y) - Math.hypot(c.x - f.x, c.y - f.y))[0];
    if (!b) b = this.spawn({ x: f.x + 6, y: f.cy + 6 });
    b.lure = f; b.lureT = 6;
  }

  onTurn() {
    for (const b of this.list) {
      if (b.cooldown > 0) {
        b.cooldown--;
        if (b.cooldown <= 0) { const p = this.randomSpot(); Object.assign(b, { x: p.x, y: p.y, tx: p.x, ty: p.y }); b.mesh.visible = true; this.game.world.sparkleBurst(b.x, b.y, '#ffe8ff', 16); }
      }
    }
    // cap swarm size
    while (this.list.length > 18) { const b = this.list.shift(); this.game.scene.remove(b.mesh); }
  }

  update(dt, t) {
    const g = this.game;
    for (const b of this.list) {
      if (!b.alive || b.cooldown > 0) continue;
      if (b.immune > 0) b.immune -= dt;
      if (b.lure && b.lureT > 0) {
        b.lureT -= dt; b.tx = b.lure.x; b.ty = b.lure.cy + 0.5;
      } else if (Math.hypot(b.tx - b.x, b.ty - b.y) < 1.5 || Math.random() < dt * 0.15) {
        b.tx = clamp(b.x + rand(-14, 14), 6, g.W - 6);
        const s = g.terrain.surfaceY(b.tx);
        b.ty = clamp(Math.max(s, g.world.seaY) + rand(4, 14), 6, g.H - 4);
      }
      const dx = b.tx - b.x, dy = b.ty - b.y, d = Math.hypot(dx, dy) || 1;
      const sp = b.lure && b.lureT > 0 ? 9 : 3.6;
      b.x += (dx / d) * sp * dt + Math.sin(t * 1.7 + b.ph) * dt * 1.5;
      b.y += (dy / d) * sp * dt + Math.sin(t * 3.1 + b.ph) * dt * 2.2;
      if (g.terrain.solid(b.x, b.y - 1.5)) b.y += 6 * dt;
      b.mesh.position.set(b.x, b.y, b.z + Math.sin(t + b.ph) * 0.5);
      const flap = Math.sin(t * 16 + b.ph) * 0.9 + 0.2;
      b.mesh.userData.pl.rotation.y = flap; b.mesh.userData.pr.rotation.y = -flap;
      b.mesh.rotation.z = clamp(-dx * 0.03, -0.4, 0.4);
      b.mesh.userData.mat.uniforms.uTime.value = t;
      b.mesh.userData.glow.material.opacity = 0.55 + 0.25 * Math.sin(t * 3 + b.ph);
      if (Math.random() < 0.5) g.world.fxAdd.spawn({ x: b.x + rand(-0.3, 0.3), y: b.y + rand(-0.3, 0.3), z: b.z, vx: rand(-0.5, 0.5), vy: rand(-1.5, -0.3), life: rand(0.6, 1.2), size: rand(0.3, 0.7), color: new THREE.Color().setHSL(b.hue + rand(-0.05, 0.05), 1, 0.78).getStyle(), shape: pick([0, 3]), drag: 1 });
    }
  }

  clear() { for (const b of this.list) this.game.scene.remove(b.mesh); this.list = []; }
}
