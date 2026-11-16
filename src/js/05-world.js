// ───────────────────────── Dream world: sky, clouds, rainbow, islands, sea, particles ─────────────────────────
function makeAtlas() {
  return canvasTex(256, 256, (c) => {
    // 0: soft glow
    let g = c.createRadialGradient(64, 64, 0, 64, 64, 62);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,.65)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, 128, 128);
    // 1: star
    c.save(); c.translate(192, 64); c.fillStyle = '#fff'; c.beginPath();
    for (let i = 0; i < 10; i++) { const r = i % 2 ? 22 : 56, a = -Math.PI / 2 + (i * Math.PI) / 5; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    c.closePath(); c.shadowColor = '#fff'; c.shadowBlur = 8; c.fill(); c.restore();
    // 2: heart
    c.save(); c.translate(64, 196); c.fillStyle = '#fff'; c.beginPath();
    c.moveTo(0, 40); c.bezierCurveTo(-70, -10, -35, -62, 0, -24); c.bezierCurveTo(35, -62, 70, -10, 0, 40); c.fill(); c.restore();
    // 3: sparkle
    c.save(); c.translate(192, 192);
    g = c.createRadialGradient(0, 0, 0, 0, 0, 60); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.beginPath(); c.moveTo(0, -60); c.quadraticCurveTo(6, -6, 60, 0); c.quadraticCurveTo(6, 6, 0, 60); c.quadraticCurveTo(-6, 6, -60, 0); c.quadraticCurveTo(-6, -6, 0, -60); c.fill();
    c.restore();
  });
}

class Particles {
  constructor(scene, max, additive, atlas) {
    this.max = max; this.list = [];
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 4); this.siz = new Float32Array(max); this.shp = new Float32Array(max);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.siz, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aShape', new THREE.BufferAttribute(this.shp, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo = g;
    const mat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: atlas }, uScale: { value: innerHeight * 0.6 } },
      vertexShader: `attribute vec4 aColor; attribute float aSize; attribute float aShape; varying vec4 vC; varying float vS;
        uniform float uScale;
        void main(){ vC=aColor; vS=aShape; vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize=aSize*uScale/max(1.,-mv.z); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `uniform sampler2D uMap; varying vec4 vC; varying float vS;
        void main(){ vec2 o=vec2(mod(vS,2.), 1.-floor(vS/2.)); vec2 uv=(gl_PointCoord*vec2(1.,-1.)+vec2(0.,1.))*.5+o*.5; uv.y = 1.0 - ((1.0-uv.y)); vec4 t=texture2D(uMap, vec2((gl_PointCoord.x+mod(vS,2.))*.5, 1.-(gl_PointCoord.y+floor(vS/2.))*.5)); if(t.a*vC.a<0.01) discard; gl_FragColor=vec4(vC.rgb*t.rgb, t.a*vC.a); }`,
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.mat = mat;
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 20 : 19;
    scene.add(this.points);
  }
  spawn(o) {
    if (this.list.length >= this.max) this.list.shift();
    const c = new THREE.Color(o.color || '#ffffff');
    this.list.push({
      x: o.x, y: o.y, z: o.z || 0, vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0,
      life: o.life || 1, max: o.life || 1, size: o.size || 1, size1: o.size1 != null ? o.size1 : (o.size || 1) * 0.2,
      r: c.r, g: c.g, b: c.b, a: o.alpha != null ? o.alpha : 1, shape: o.shape || 0, grav: o.g != null ? o.g : 0, drag: o.drag != null ? o.drag : 1.5,
    });
  }
  update(dt) {
    const L = this.list;
    let n = 0;
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i];
      p.life -= dt;
      if (p.life <= 0) { L.splice(i, 1); continue; }
      const d = Math.exp(-p.drag * dt);
      p.vx *= d; p.vy = p.vy * d - p.grav * dt; p.vz *= d;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    }
    for (const p of L) {
      const k = p.life / p.max;
      this.pos[n * 3] = p.x; this.pos[n * 3 + 1] = p.y; this.pos[n * 3 + 2] = p.z;
      this.col[n * 4] = p.r; this.col[n * 4 + 1] = p.g; this.col[n * 4 + 2] = p.b; this.col[n * 4 + 3] = p.a * Math.min(1, k * 3);
      this.siz[n] = lerp(p.size1, p.size, k); this.shp[n] = p.shape;
      n++;
    }
    this.geo.setDrawRange(0, n);
    for (const k of ['position', 'aColor', 'aSize', 'aShape']) this.geo.attributes[k].needsUpdate = true;
  }
  resize() { this.mat.uniforms.uScale.value = innerHeight * 0.6; }
}

function cloudTexture(seed) {
  return canvasTex(256, 160, (c, w, h) => {
    const n = 9 + (seed % 4);
    const blobs = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      blobs.push({ x: 40 + t * 176 + rand(-10, 10), y: 100 - Math.sin(t * Math.PI) * rand(25, 45) + rand(-6, 6), r: 26 + Math.sin(t * Math.PI) * rand(16, 30) });
    }
    for (const pass of [0, 1]) {
      for (const b of blobs) {
        const g = c.createRadialGradient(b.x - b.r * 0.3, b.y - b.r * 0.4, b.r * 0.1, b.x, b.y, b.r);
        if (pass === 0) { g.addColorStop(0, 'rgba(240,200,240,.9)'); g.addColorStop(1, 'rgba(220,180,240,0)'); }
        else { g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.6, 'rgba(255,245,252,.85)'); g.addColorStop(1, 'rgba(255,230,250,0)'); }
        c.fillStyle = g; c.beginPath(); c.arc(b.x, b.y - (pass ? 4 : -6), b.r * (pass ? 0.92 : 1.05), 0, TAU); c.fill();
      }
    }
  });
}

class World {
  constructor(scene, W, H) {
    this.scene = scene; this.W = W; this.H = H; this.mood = 0; this.moodT = 0;
    const q = Q();
    scene.fog = new THREE.Fog(0xf3d6f4, 90, 330);
    scene.add(new THREE.HemisphereLight(0xfff2ff, 0xb39be0, 1.15));
    const sun = new THREE.DirectionalLight(0xfff4ea, 0.75); sun.position.set(-40, 80, 60); scene.add(sun);

    // sky dome
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { uTime: { value: 0 }, uMood: { value: 0 } },
      vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
      fragmentShader: `uniform float uTime; uniform float uMood; varying vec3 vD;
        float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719)))*43758.5453); }
        void main(){
          float y = vD.y;
          vec3 top = mix(vec3(0.70,0.62,1.0), vec3(0.45,0.35,0.85), uMood);
          vec3 mid = mix(vec3(1.0,0.78,0.9), vec3(0.85,0.55,0.95), uMood);
          vec3 hor = mix(vec3(1.0,0.89,0.82), vec3(1.0,0.7,0.8), uMood);
          vec3 c = mix(hor, mid, smoothstep(-0.05, 0.25, y));
          c = mix(c, top, smoothstep(0.25, 0.8, y));
          vec3 sd = normalize(vec3(-0.35, 0.45, -1.0));
          float s = max(dot(vD, sd), 0.0);
          c += vec3(1.0,0.92,0.8) * (pow(s, 40.0) * 0.6 + pow(s, 6.0) * 0.18);
          vec3 g = floor(vD * 180.0);
          float st = step(0.9965, h(g)) * smoothstep(0.15, 0.6, y);
          c += st * (0.5 + 0.5 * sin(uTime * 2.0 + h(g + 1.0) * 30.0)) * 0.7;
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(420, 32, 20), this.skyMat);
    this.sky.position.set(W / 2, 0, 0);
    scene.add(this.sky);

    // rainbow
    const rg = new THREE.RingGeometry(92, 112, 96, 1, 0, Math.PI);
    this.rainbowMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      uniforms: { uTime: { value: 0 }, uAlpha: { value: 0.42 } },
      vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
      fragmentShader: `uniform float uTime; uniform float uAlpha; varying vec2 vP;
        vec3 hue(float h){ return clamp(abs(mod(h*6.0+vec3(0.,4.,2.),6.)-3.)-1.,0.,1.); }
        void main(){ float r = length(vP); float t = (r-92.0)/20.0; vec3 c = hue(0.83 - t*0.83);
          float a = smoothstep(0.0,0.12,t)*smoothstep(1.0,0.88,t) * smoothstep(0.0, 30.0, vP.y) * (0.8+0.2*sin(uTime+vP.x*0.05));
          gl_FragColor = vec4(c*uAlpha*a, 1.0); }`,
    });
    this.rainbow = new THREE.Mesh(rg, this.rainbowMat);
    this.rainbow.position.set(W * 0.55, -18, -150);
    scene.add(this.rainbow);

    // clouds
    const texs = [0, 1, 2, 3].map(cloudTexture);
    this.clouds = [];
    for (let i = 0; i < q.clouds; i++) {
      const far = Math.random();
      const mat = new THREE.SpriteMaterial({ map: pick(texs), transparent: true, depthWrite: false, opacity: lerp(0.95, 0.75, far), fog: true });
      const s = new THREE.Sprite(mat);
      const sc = lerp(18, 60, far);
      s.scale.set(sc, sc * 0.62, 1);
      s.position.set(rand(-120, W + 120), lerp(H * 0.2, H * 1.3, Math.random()), lerp(-30, -200, far));
      s.userData.v = rand(0.4, 1.4) * (1 - far * 0.6);
      scene.add(s); this.clouds.push(s);
    }
    // low foreground mist clouds
    for (let i = 0; i < 6; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: pick(texs), transparent: true, depthWrite: false, opacity: 0.55 }));
      s.scale.set(34, 16, 1); s.position.set(rand(-20, W + 20), rand(-2, 5), rand(6, 14)); s.userData.v = rand(0.6, 1.2);
      s.renderOrder = 30; scene.add(s); this.clouds.push(s);
    }

    // floating islands
    this.islands = [];
    const isl = [[-25, 48, -70], [W * 0.25, 70, -110], [W * 0.55, 58, -80], [W * 0.82, 76, -125], [W + 25, 44, -75], [W * 0.4, 92, -160], [W * 1.1, 95, -170]];
    for (const [x, y, z] of isl) this.islands.push(this.makeIsland(x, y, z, rand(0.7, 1.4)));

    // candy-floss sea
    this.seaY = 1.2;
    this.seaMat = new THREE.ShaderMaterial({
      transparent: true, fog: false,
      uniforms: { uTime: { value: 0 } },
      vertexShader: `uniform float uTime; varying vec3 vW; void main(){ vec3 p = position; vec4 w = modelMatrix*vec4(p,1.); w.y += sin(w.x*0.15+uTime*1.3)*0.25 + sin(w.z*0.2+uTime)*0.2; vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `uniform float uTime; varying vec3 vW;
        float h(vec2 p){ return fract(sin(dot(p, vec2(41.3,289.1)))*45758.5); }
        void main(){ float w = sin(vW.x*0.3 + uTime*1.5)*0.5+0.5; float w2 = sin(vW.z*0.5 - uTime*1.2 + vW.x*0.1)*0.5+0.5;
          vec3 c = mix(vec3(1.0,0.62,0.85), vec3(0.78,0.62,1.0), w*0.6+w2*0.4);
          float gl = step(0.985, h(floor(vW.xz*1.5 + floor(uTime*3.0)))); c += gl*0.6;
          float fade = smoothstep(-260.0, -40.0, vW.z);
          c = mix(vec3(1.0,0.86,0.86), c, fade);
          gl_FragColor = vec4(c, 0.93); }`,
    });
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(900, 420, 90, 40), this.seaMat);
    sea.rotation.x = -Math.PI / 2; sea.position.set(W / 2, this.seaY, -150);
    sea.renderOrder = 5;
    scene.add(sea);

    // floating motes (GPU animated)
    const mc = q.motes, mp = new Float32Array(mc * 3), mr = new Float32Array(mc);
    for (let i = 0; i < mc; i++) { mp[i * 3] = rand(-60, W + 60); mp[i * 3 + 1] = rand(0, H * 1.4); mp[i * 3 + 2] = rand(-60, 12); mr[i] = Math.random(); }
    const mg = new THREE.BufferGeometry();
    mg.setAttribute('position', new THREE.BufferAttribute(mp, 3)); mg.setAttribute('aR', new THREE.BufferAttribute(mr, 1));
    this.moteMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uScale: { value: innerHeight * 0.5 }, uMood: { value: 0 } },
      vertexShader: `attribute float aR; uniform float uTime; uniform float uScale; uniform float uMood; varying float vA; varying float vR;
        void main(){ vec3 p = position; p.y += mod(uTime*(0.4+aR)*(1.0+uMood*3.0) + aR*40.0, 40.0) - 20.0; p.x += sin(uTime*0.5+aR*20.0)*2.0;
          vec4 mv = modelViewMatrix*vec4(p,1.); vA = 0.5+0.5*sin(uTime*3.0+aR*50.0); vR = aR; gl_PointSize = (2.0+aR*4.0)*uScale/max(1.0,-mv.z); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `varying float vA; varying float vR; void main(){ float d = length(gl_PointCoord-0.5); float a = smoothstep(0.5,0.0,d)*vA; gl_FragColor = vec4(mix(vec3(1.,.85,.95), vec3(1.,.95,.7), vR)*a, a); }`,
    });
    const motes = new THREE.Points(mg, this.moteMat); motes.frustumCulled = false; scene.add(motes);

    // particle systems
    this.atlas = makeAtlas();
    this.fxAdd = new Particles(scene, 2500, true, this.atlas);
    this.fxNorm = new Particles(scene, 1500, false, this.atlas);
    this.rings = [];
    this.flashes = [];
  }

  makeIsland(x, y, z, s) {
    const g = new THREE.Group();
    const top = new THREE.Mesh(new THREE.CylinderGeometry(9, 8, 2.4, 20), new THREE.MeshLambertMaterial({ color: pick(['#ffb3dd', '#c9b5ff', '#b5f0d8']) }));
    const rock = new THREE.Mesh(new THREE.ConeGeometry(8, 14, 20), new THREE.MeshLambertMaterial({ color: '#d6b6ec' }));
    rock.rotation.x = Math.PI; rock.position.y = -8;
    g.add(top, rock);
    for (let i = 0; i < 4; i++) {
      const a = rand(0, TAU), r = rand(1, 6);
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 3.2, 6), new THREE.MeshLambertMaterial({ color: '#fff7fb' }));
      const pop = new THREE.Mesh(new THREE.SphereGeometry(1.3, 14, 10), new THREE.MeshLambertMaterial({ color: pick(['#ff7fbf', '#ffd36b', '#8fd3ff', '#b28bff', '#7fe8b8']) }));
      stick.position.set(Math.cos(a) * r, 2.6, Math.sin(a) * r); pop.position.set(stick.position.x, 4.4, stick.position.z);
      g.add(stick, pop);
    }
    g.position.set(x, y, z); g.scale.setScalar(s);
    g.userData = { y0: y, ph: rand(0, TAU) };
    this.scene.add(g);
    return g;
  }

  setMood(m) { this.mood = m; }

  ring(x, y, z, r, color = '#ffffff', dur = 0.6) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.position.set(x, y, z + 0.5); m.renderOrder = 25;
    this.scene.add(m); this.rings.push({ m, r, t: 0, dur });
  }

  flash(x, y, z, size, color = '#fff2c4') {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.atlas, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    s.material.map = null;
    const tex = canvasTex(64, 64, (c) => { const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 64, 64); });
    s.material.map = tex; s.material.needsUpdate = true;
    s.position.set(x, y, z + 1); s.renderOrder = 26; s.scale.setScalar(size);
    this.scene.add(s); this.flashes.push({ s, t: 0, size });
  }

  explosionFx(x, y, r, palette = ['#ff7fbf', '#ffd36b', '#b28bff', '#7fd8ff', '#ffffff']) {
    this.flash(x, y, 0, r * 5);
    this.ring(x, y, 0, r * 2.4, '#fff0fa', 0.55);
    this.ring(x, y, 0, r * 3.4, '#ffc2e6', 0.8);
    for (let i = 0; i < 40 + r * 10; i++) {
      const a = rand(0, TAU), sp = rand(4, 16) * (0.6 + r * 0.15);
      this.fxAdd.spawn({ x, y, z: rand(-1, 2), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: rand(-3, 6), life: rand(0.4, 1.0), size: rand(0.6, 1.6), color: pick(palette), shape: pick([0, 1, 3]), drag: 2.5 });
    }
    for (let i = 0; i < 14 + r * 4; i++) {
      const a = rand(0, TAU), sp = rand(5, 14);
      this.fxNorm.spawn({ x, y, z: rand(0, 2), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + 6, vz: rand(-2, 4), life: rand(1.0, 1.8), size: rand(0.7, 1.3), size1: 0.3, color: pick(palette), shape: 2, g: 18, drag: 1.2 });
    }
    for (let i = 0; i < 12; i++) {
      this.fxNorm.spawn({ x: x + rand(-r, r), y: y + rand(-r, r) * 0.6, z: rand(-1, 2), vx: rand(-3, 3), vy: rand(1, 4), life: rand(1, 1.8), size: rand(2.4, 4.2), size1: 4.8, color: '#fff3fb', alpha: 0.75, shape: 0, drag: 2 });
    }
  }

  sparkleBurst(x, y, color = '#fff6c0', n = 20, spd = 8) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), sp = rand(1, spd);
      this.fxAdd.spawn({ x, y, z: rand(-0.5, 1.5), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(0.5, 1.2), size: rand(0.4, 1.1), color, shape: pick([1, 3]), drag: 2.2 });
    }
  }

  update(dt, t) {
    this.moodT = damp(this.moodT, this.mood, 2, dt);
    this.skyMat.uniforms.uTime.value = t; this.skyMat.uniforms.uMood.value = this.moodT;
    this.rainbowMat.uniforms.uTime.value = t;
    this.seaMat.uniforms.uTime.value = t;
    this.moteMat.uniforms.uTime.value = t; this.moteMat.uniforms.uMood.value = this.moodT;
    for (const c of this.clouds) {
      c.position.x += c.userData.v * dt;
      if (c.position.x > this.W + 160) c.position.x = -160;
    }
    for (const g of this.islands) { g.position.y = g.userData.y0 + Math.sin(t * 0.5 + g.userData.ph) * 1.5; g.rotation.y += dt * 0.05; }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const R = this.rings[i]; R.t += dt; const k = R.t / R.dur;
      if (k >= 1) { this.scene.remove(R.m); R.m.geometry.dispose(); R.m.material.dispose(); this.rings.splice(i, 1); continue; }
      const e = 1 - Math.pow(1 - k, 3);
      R.m.scale.setScalar(0.2 + R.r * e); R.m.material.opacity = (1 - k) * 0.9;
    }
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const F = this.flashes[i]; F.t += dt;
      if (F.t > 0.35) { this.scene.remove(F.s); F.s.material.map.dispose(); F.s.material.dispose(); this.flashes.splice(i, 1); continue; }
      F.s.material.opacity = 1 - F.t / 0.35; F.s.scale.setScalar(F.size * (1 + F.t * 2));
    }
    this.fxAdd.update(dt); this.fxNorm.update(dt);
  }
  resize() { this.fxAdd.resize(); this.fxNorm.resize(); this.moteMat.uniforms.uScale.value = innerHeight * 0.5; }
}
