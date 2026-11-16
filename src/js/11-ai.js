// ───────────────────────── Clever AI bots ─────────────────────────
const AI_LEVELS = {
  easy: { angErr: 7, powErr: 0.08, cardChance: 0.5, think: 1.2 },
  normal: { angErr: 2.5, powErr: 0.03, cardChance: 0.8, think: 0.9 },
  hard: { angErr: 0.7, powErr: 0.01, cardChance: 1, think: 0.6 },
};

class AIBrain {
  constructor(game, player) { this.game = game; this.player = player; this.knownTop = null; }
  get lv() { return AI_LEVELS[Settings.aiLevel] || AI_LEVELS.normal; }

  card(id) { return this.player.hand.find((c) => c.id === id); }

  expectedScore(x, y, radius, dmg, me) {
    const g = this.game;
    let s = 0;
    const mult = g.turnFx.double ? 2 : 1;
    for (const f of g.fluffs) {
      if (!f.alive) continue;
      const d = Math.hypot(f.x - x, f.cy - y);
      const k = clamp(1 - d / (radius + FLUFF_R * 1.4), 0, 1);
      if (k <= 0) continue;
      let dm = dmg * k * mult * (f.shield ? 0.5 : 1);
      if (f.team === me.team) s -= dm * 1.4 + (dm >= f.hp ? 40 : 0);
      else s += dm + (dm >= f.hp ? 35 : 0) + (f.hp < 40 ? 6 : 0);
      // knockback towards the sea is a bonus
      if (f.team !== me.team) { const pushDir = Math.sign(f.x - x) || 1, nx = f.x + pushDir * k * 8; if (nx < 6 || nx > g.W - 6 || g.terrain.surfaceY(nx) < g.world.seaY + 1) s += 15 * k; }
    }
    return s;
  }

  findBestShot(me) {
    const g = this.game, best = { score: -1e9 };
    const ammo = this.player.ammo;
    const origin = { x: me.x, y: me.cy + 0.4 };
    const tryWeapon = (w, factor = 1) => {
      for (let a = -30; a <= 210; a += 5) {
        const rad = (a * Math.PI) / 180;
        for (let p = 0.32; p <= 1.001; p += 0.06) {
          const sp = w.speed * p;
          const r = simulateShot(g, me, origin.x + Math.cos(rad) * 1.6, origin.y + Math.sin(rad) * 1.6, Math.cos(rad) * sp, Math.sin(rad) * sp, w, 6);
          if (r.hit === 'out' || r.hit === 'timeout') continue;
          const s = this.expectedScore(r.x, r.y, w.radius, w.damage, me) * factor;
          if (s > best.score) Object.assign(best, { score: s, weapon: w.id, angle: rad, power: p });
        }
      }
    };
    tryWeapon(WEAPON_BY_ID.bazooka);
    const enemies = g.fluffs.filter((f) => f.alive && f.team !== me.team);
    const near = enemies.some((f) => Math.hypot(f.x - me.x, f.y - me.y) < 28);
    if (ammo.cluster > 0 && near && Math.random() < 0.5) tryWeapon(WEAPON_BY_ID.cluster, 0.85);
    if (ammo.orbital > 0) {
      for (const e of enemies) {
        const y = g.terrain.surfaceY(e.x, g.H - 1);
        const s = this.expectedScore(e.x, y, 4.4, 42, me);
        if (s > 38 && (e.hp <= 50 || Math.random() < 0.35) && s > best.score) Object.assign(best, { score: s + 5, weapon: 'orbital', target: { x: e.x, y } });
      }
    }
    for (const e of enemies) {
      const d = Math.hypot(e.x - me.x, e.cy - me.cy);
      if (d < 3.6) {
        const dir = Math.sign(e.x - me.x) || 1, nx = e.x + dir * 12;
        const s = 18 + (nx < 4 || nx > g.W - 4 || g.terrain.surfaceY(nx) < g.world.seaY + 1 ? 60 : 0);
        if (s > best.score) Object.assign(best, { score: s, weapon: 'shove', angle: dir > 0 ? 0.35 : Math.PI - 0.35, power: 1 });
      }
    }
    return best;
  }

  wantsNope(card, by) {
    if (!this.card('nope') || by === this.player) return false;
    const harm = { steal: 0.75, double: 0.5, skip: 0.3, future: 0.12, shuffle: 0.2, lure: 0.25, shield: 0.4, nope: 0.55 }[card.id] || 0;
    return Math.random() < harm * this.lv.cardChance;
  }

  defusePosition() { return Math.random() < 0.6 ? 'top' : 'random'; }

  async takeTurn() {
    const g = this.game, me = g.activeFluff, P = this.player, lv = this.lv;
    const alive = () => g.turnId === turn && g.active && me.alive && g.phase === 'aim';
    const turn = g.turnId;
    await g.sleep(lv.think);
    if (!alive()) return;
    // ── card play ──
    const tryPlay = async (id, cond, opts) => { const c = this.card(id); if (c && cond && Math.random() < lv.cardChance && alive()) { await g.playCard(P, c, opts); await g.sleep(0.5); } };
    await tryPlay('shield', me.hp < 55 && !me.shield);
    if (this.knownTop == null) await tryPlay('future', Math.random() < 0.4);
    const rich = g.players.filter((o) => o !== P && o.alive && o.hand.length > 1).sort((a, b) => b.hand.length - a.hand.length)[0];
    await tryPlay('steal', rich && Math.random() < 0.5, { target: rich });
    await tryPlay('lure', Math.random() < 0.2);
    if (this.knownTop === 'bomb' && !this.card('skip')) await tryPlay('shuffle', true);
    if (!alive()) return;
    // ── plan shot (walk closer if nothing good) ──
    let plan = this.findBestShot(me);
    for (let tries = 0; tries < 2 && plan.score < 12 && alive(); tries++) {
      const target = g.fluffs.filter((f) => f.alive && f.team !== me.team).sort((a, b) => Math.abs(a.x - me.x) - Math.abs(b.x - me.x))[0];
      if (!target) break;
      const dir = Math.sign(target.x - me.x) || 1;
      if (Math.random() < 0.3 && me.grounded) { me.facing = dir; me.jump(); }
      await g.aiWalk(dir, 1.3);
      await g.sleep(0.4);
      plan = this.findBestShot(me);
    }
    if (!alive()) return;
    if (plan.score > 30) await tryPlay('double', true);
    if (!alive() || plan.score < -1e8) { if (alive()) g.skipShot(); return; }
    g.selectWeapon(plan.weapon);
    await g.sleep(0.35);
    if (plan.weapon === 'orbital') {
      g.aimPoint = { x: plan.target.x + rand(-lv.angErr, lv.angErr) * 0.3, y: plan.target.y };
      g.ui.flashTarget(g.aimPoint);
      await g.sleep(0.6);
    } else {
      const ang = plan.angle + ((rand(-1, 1) * lv.angErr) * Math.PI) / 180;
      const pow = clamp(plan.power + rand(-1, 1) * lv.powErr, 0.2, 1);
      const a0 = g.aim.angle, p0 = g.aim.power;
      for (let i = 1; i <= 20 && alive(); i++) { const k = smooth01(i / 20); g.aim.angle = lerp(a0, ang, k); g.aim.power = lerp(p0, pow, k); await g.sleep(0.04); }
    }
    if (!alive()) return;
    g.fire();
  }

  async retreat() {
    const g = this.game, me = g.activeFluff;
    if (!me || !me.alive) return;
    await g.sleep(0.5);
    const enemies = g.fluffs.filter((f) => f.alive && f.team !== me.team);
    const near = enemies.sort((a, b) => Math.abs(a.x - me.x) - Math.abs(b.x - me.x))[0];
    if (near && Math.abs(near.x - me.x) < 10) await g.aiWalk(-Math.sign(near.x - me.x) || 1, 0.8);
  }

  async endTurnChoice() {
    const g = this.game;
    const skip = this.card('skip');
    if (this.knownTop === 'bomb' && skip) { await g.playCard(this.player, skip); return true; }
    return false;
  }
}
