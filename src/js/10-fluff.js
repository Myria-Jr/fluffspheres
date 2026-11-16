// ───────────────────────── Fluffsphere entity: movement physics, damage, life ─────────────────────────
const WALK_SPEED = 6.5;
const STAMINA_MAX = 26;

class Fluff {
  constructor(game, team, index, profile, x) {
    this.game = game; this.team = team; this.index = index; this.profile = profile;
    this.name = index === 0 ? profile.name : `${profile.name} ${['', 'Jr.', 'III', 'IV'][index] || index + 1}`;
    this.x = x; this.y = game.terrain.surfaceY(x) + 0.05; this.vx = 0; this.vy = 0;
    this.grounded = false; this.hp = 100; this.shownHp = 100; this.alive = true; this.facing = 1;
    this.shield = false; this.wet = false; this.acc = 0; this.impact = 0; this.walking = 0; this.stepT = 0;
    this.state = 'idle'; this.rope = null; this.lastHurtBy = null;
    this.model = new FluffModel(profile);
    this.model.group.scale.setScalar(1.15);
    game.scene.add(this.model.group);
    this.syncModel();
  }

  get cy() { return this.y + FLUFF_R; }
  get resting() { return !this.alive || (this.grounded && Math.abs(this.vx) < 0.6 && Math.abs(this.vy) < 0.6 && this.state !== 'rope'); }

  syncModel() { this.model.group.position.set(this.x, this.y + 1.08, -1.0); }

  walk(dir, dt) {
    if (!this.grounded || this.state === 'rope') return false;
    this.facing = dir;
    const T = this.game.terrain, dx = dir * WALK_SPEED * dt;
    let moved = false;
    for (let h = 0; h <= 1.3; h += 0.1) {
      const nx = this.x + dx;
      if (!T.solid(nx, this.y + h) && !T.solid(nx + dir * 0.9, this.y + h + 1.0) && !T.solid(nx, this.y + h + 2.2)) {
        this.x = nx; this.y += h; moved = true; break;
      }
    }
    if (!moved) return false;
    if (!T.solid(this.x, this.y - 0.1)) {
      let dropped = false;
      for (let d = 0; d <= 1.3; d += 0.1) if (T.solid(this.x, this.y - d - 0.1)) { this.y -= d; dropped = true; break; }
      if (!dropped) { this.grounded = false; this.vx = dir * WALK_SPEED * 0.8; }
    }
    this.x = clamp(this.x, 0.5, this.game.W - 0.5);
    this.walking = 0.15;
    this.stepT -= dt;
    if (this.stepT <= 0) { this.stepT = 0.22; Sfx.step(); }
    return true;
  }

  jump(back = false) {
    if (!this.grounded || this.state === 'rope') return false;
    this.vy = back ? 19 : 15; this.vx = this.facing * (back ? -4 : 8.5);
    this.grounded = false; this.y += 0.12;
    this.model.squashV += 3;
    Sfx.boing();
    return true;
  }

  impulse(ix, iy) { this.vx += ix; this.vy += iy; if (iy > 0 || Math.abs(ix) > 1) { this.grounded = false; this.y += 0.1; } }

  step(dt) {
    const g = this.game, T = g.terrain;
    if (this.state === 'rope' && this.rope) {
      const dx = this.rope.ax - this.x, dy = this.rope.ay - this.cy, d = Math.hypot(dx, dy);
      this.rope.t += dt;
      if (d < 2.2 || this.rope.t > 1.4) { this.state = 'idle'; this.rope = null; g.onRopeDone(this); }
      else { this.vx = (dx / d) * 34; this.vy = (dy / d) * 34; }
    } else if (!this.grounded) {
      this.vy -= GRAVITY * (g.antiGrav > 0 ? 0.32 : 1) * dt;
      const air = Math.exp(-0.35 * dt); this.vx *= air;
    }
    let nx = this.x + this.vx * dt, ny = this.y + this.vy * dt;
    // walls
    if (Math.abs(this.vx) > 0.01) {
      const s = Math.sign(this.vx);
      if (T.solid(nx + s * 1.05, ny + 1.3) || T.solid(nx + s * 0.9, ny + 2.0)) { this.vx = -this.vx * 0.3; nx = this.x; }
    }
    // ceiling
    if (this.vy > 0 && T.solid(nx, ny + 2.55)) { this.vy = -this.vy * 0.2; ny = this.y; if (this.state === 'rope') { this.state = 'idle'; this.rope = null; g.onRopeDone(this); } }
    if (T.solid(nx, ny)) {
      let k = 0;
      while (T.solid(nx, ny) && k < 50) { ny += 0.05; k++; }
      if (k >= 50) { nx = this.x; ny = this.y; }
      if (!this.grounded) {
        const v = -this.vy;
        if (v > 27 && g.antiGrav <= 0) this.damage(Math.round((v - 27) * 1.4), null, 'fall');
        if (v > 8) { this.impact = Math.min(5, v * 0.12); Sfx.land(); g.world.sparkleBurst(nx, ny, '#ffffff', 6, 4); }
      }
      if (this.vy < -12 && Math.abs(this.vx) > 8) { this.vy = -this.vy * 0.22; this.vx *= 0.6; }
      else { this.vy = 0; this.vx *= 0.55; this.grounded = true; }
    } else {
      const below = T.solid(nx, ny - 0.12);
      if (this.grounded && !below) this.grounded = false;
      if (below && this.vy <= 0) { this.grounded = true; this.vy = 0; }
    }
    if (this.grounded && !this.walking) this.vx *= Math.exp(-9 * dt);
    this.x = clamp(nx, 0.5, g.W - 0.5); this.y = Math.min(ny, g.H + 40);
    if (this.x <= 0.5 || this.x >= g.W - 0.5) this.vx = 0;
    // fell into the candy-floss sea
    if (this.cy < g.world.seaY - 0.2 && this.alive) { g.splash(this.x); this.wet = true; this.die('drown'); }
  }

  update(dt, t) {
    if (!this.alive) return;
    this.acc += dt;
    while (this.acc >= SIM_DT) { this.step(SIM_DT); this.acc -= SIM_DT; }
    this.walking = Math.max(0, this.walking - dt);
    this.shownHp = damp(this.shownHp, this.hp, 6, dt);
    this.syncModel();
    const g = this.game;
    this.model.update(dt, t, { vx: this.walking ? this.facing * WALK_SPEED : this.vx, vy: this.vy, grounded: this.grounded, wind: g.env.wind * 6, impact: this.impact, wet: this.wet });
    this.impact = 0;
    if (this.shield && Math.random() < 0.15) g.world.fxAdd.spawn({ x: this.x + rand(-1.5, 1.5), y: this.cy + rand(-1.5, 1.5), z: 0, vy: 0.5, life: 0.6, size: 0.5, color: '#9fe8ff', shape: 3 });
  }

  damage(amount, by, cause) {
    if (!this.alive || amount <= 0) return 0;
    if (this.shield) amount = Math.ceil(amount * 0.5);
    amount = Math.round(amount);
    this.hp = Math.max(0, this.hp - amount);
    this.lastHurtBy = by;
    this.model.flash(); this.model.setExpression('hurt', 1.5);
    this.game.ui.floatText(this.x, this.cy + 2.2, `-${amount}`, cause === 'heal' ? 'heal' : 'dmg');
    this.game.stats.damage[by ? by.team.id : -1] = (this.game.stats.damage[by ? by.team.id : -1] || 0) + amount;
    Sfx.hurt();
    if (this.hp <= 0) this.game.later(0.6, () => this.die('hp'));
    return amount;
  }

  heal(n) {
    if (!this.alive) return;
    const before = this.hp;
    this.hp = Math.min(100, this.hp + n);
    if (this.hp > before) { this.game.ui.floatText(this.x, this.cy + 2.2, `+${this.hp - before}`, 'heal'); this.model.setExpression('wow', 1); }
  }

  die(cause) {
    if (!this.alive) return;
    this.alive = false; this.hp = 0;
    const g = this.game;
    g.world.explosionFx(this.x, this.cy, 1.6, [this.profile.fur, '#ffffff', '#ffd6ec']);
    for (let i = 0; i < 26; i++) g.world.fxNorm.spawn({ x: this.x + rand(-1, 1), y: this.cy + rand(-1, 1), z: -1, vx: rand(-6, 6), vy: rand(2, 10), life: rand(1.2, 2.2), size: rand(0.6, 1.2), size1: 0.2, color: this.profile.fur, shape: 0, g: 6, drag: 1.5 });
    g.scene.remove(this.model.group);
    this.model.dispose();
    // little ghost cloud floating up
    const ghost = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(128, 128, (c) => { c.font = '96px serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('👻', 64, 70); }), transparent: true, depthWrite: false }));
    ghost.position.set(this.x, this.cy, 0); ghost.scale.setScalar(2.4);
    g.scene.add(ghost);
    g.tweens.push({ t: 0, dur: 2.5, fn: (k) => { ghost.position.y = this.cy + k * 8; ghost.material.opacity = 1 - k; }, done: () => g.scene.remove(ghost) });
    g.ui.toast(`${this.name} ${cause === 'drown' ? 'ist ins Zuckerwatte-Meer geplumpst!' : 'ist k.o. gekuschelt!'} ${cause === 'drown' ? '🌊' : '💤'}`, 'error');
    Sfx.squeak(0.6);
    g.label && g.label(this);
    g.onFluffDied(this);
  }
}
