// ───────────────────────── Game match: turns, weapons, explosions, cards, butterfly events ─────────────────────────
Object.assign(Game.prototype, {
  startMatch(cfg) {
    this.lastConfig = cfg;
    this.cleanupMatch();
    this.showcase.forEach((m) => (m.group.visible = false));
    const theme = pick(TERRAIN_THEMES);
    this.terrain.build(theme);
    this.terrain.generate(randi(1, 1e9));
    this.mode = cfg.mode;
    this.players = cfg.slots.map((s) => ({ id: s.idx, profile: s.profile, ai: s.type === 'ai', hand: [], ammo: Object.fromEntries(WEAPONS.map((w) => [w.id, w.ammo])), fluffs: [], alive: true, fluffTurn: -1 }));
    for (const p of this.players) if (p.ai) p.brain = new AIBrain(this, p);
    const k = Settings.fluffsPerTeam, xs = [];
    for (let i = 0; i < k; i++) for (const p of this.players) {
      let x = null;
      for (let tries = 0; tries < 400 && x == null; tries++) {
        const c = rand(8, this.W - 8), s = this.terrain.surfaceY(c);
        const minD = tries < 250 ? 10 : 5;
        if (s > this.world.seaY + 2.5 && s < this.H - 8 && xs.every((o) => Math.abs(o - c) > minD)) x = c;
      }
      if (x == null) x = rand(20, this.W - 20);
      xs.push(x);
      const f = new Fluff(this, p, i, p.profile, x);
      p.fluffs.push(f); this.fluffs.push(f);
    }
    this.deck = new Deck(); this.deck.setup(this.players);
    for (let i = 0; i < (cfg.mode === 'chaos' ? 12 : 6); i++) this.butterflies.spawn();
    this.env.wind = rand(-0.5, 0.5); this.env.grav = 1; this.antiGrav = 0; this.storm = 0;
    this.stats = { damage: {} }; this.lastHuman = null; this.round = 0;
    this.state = 'playing'; this.phase = 'intro';
    this.turnIndex = (randi(0, this.players.length - 1) - 1 + this.players.length) % this.players.length;
    this.ui.buildHud();
    Object.assign(this.cam, { x: this.W / 2, y: this.H * 0.45, tx: this.W / 2, ty: this.H * 0.45, tdist: 95, dist: 120, manualT: 2 });
    this.ui.banner('Lasst die Fluffs fliegen!', `${theme.name} · ${this.players.length} Teams`, 'tertiary');
    Sfx.sparkle(10);
    this.later(2.0, () => this.nextTurn(), false);
  },

  cleanupMatch() {
    for (const f of this.fluffs) if (f.alive) { this.scene.remove(f.model.group); f.model.dispose(); }
    for (const p of this.projectiles) p.kill();
    for (const m of this.mines) m.remove();
    for (const b of this.beams) this.scene.remove(b.mesh);
    for (const T of this.tweens) T.done && T.done();
    this.fluffs = []; this.players = []; this.projectiles = []; this.mines = []; this.beams = []; this.timers = []; this.tweens = [];
    this.butterflies.clear();
    this.env.grav = 1; this.antiGrav = 0; this.storm = 0; this.world.setMood(0);
    this.followObj = null; this.aiMove = null; this.ropeMesh.visible = false; this.turnFx = {};
    this.ui.labels.innerHTML = ''; $('#banner').innerHTML = '';
    $$('#scrim, #curtain').forEach((e) => e.remove());
  },

  backToMenu() {
    this.cleanupMatch();
    this.state = 'menu'; this.phase = null;
    this.menuArena();
    this.ui.showMenu('home');
  },

  aliveTeams() { return this.players.filter((p) => p.fluffs.some((f) => f.alive)); },

  checkWin() {
    if (this.state !== 'playing') return true;
    for (const p of this.players) p.alive = p.fluffs.some((f) => f.alive);
    const alive = this.aliveTeams();
    if (alive.length <= 1) { this.gameOver(alive[0] || null); return true; }
    return false;
  },

  async nextTurn() {
    if (this.state !== 'playing' || this.checkWin()) return;
    const n = this.players.length;
    let i = this.turnIndex;
    do { i = (i + 1) % n; } while (!this.players[i].alive);
    this.turnIndex = i;
    const P = this.players[i];
    let k = P.fluffTurn;
    for (let j = 0; j < P.fluffs.length; j++) { k = (k + 1) % P.fluffs.length; if (P.fluffs[k].alive) break; }
    P.fluffTurn = k;
    const f = P.fluffs[k];
    this.turnId++; this.turnFx = {}; this.cardBusy = false;
    P.fluffs.forEach((x) => (x.shield = false));
    if (this.antiGrav > 0 && --this.antiGrav === 0) { this.env.grav = 1; this.world.setMood(0); this.ui.toast('Die Schwerkraft ist zurück.', '', '🍎'); }
    if (this.storm > 0) { this.storm--; this.env.wind = Math.sign(this.env.wind || 1) * rand(0.9, 1); }
    else this.env.wind = clamp(this.env.wind * 0.4 + rand(-0.65, 0.65), -1, 1);
    for (const m of this.mines) m.armed = true;
    this.butterflies.onTurn();
    if (!P.ammo[P.lastWeapon || 'bazooka']) P.lastWeapon = 'bazooka';
    this.weapon = P.lastWeapon || 'bazooka';
    this.aimPoint = null; this.stamina = STAMINA_MAX; this.turnTime = Settings.turnTime; this.phase = 'turnStart';
    this.followObj = null; this.cam.manualT = 0; this.aim.angle = f.facing > 0 ? 0.75 : Math.PI - 0.75;
    this.ui.refreshTeams(); this.ui.refreshWeapons();
    if (!P.ai) {
      const humans = this.players.filter((p) => !p.ai && p.alive).length;
      if (humans > 1 && this.lastHuman && this.lastHuman !== P) { this.ui.handEl.innerHTML = ''; await this.ui.curtain(P); }
      this.lastHuman = P;
    }
    if (this.state !== 'playing') return;
    this.ui.renderHand();
    const acc = TEAM_ACCENTS[P.id % 4];
    this.ui.whoEl.style.background = acc;
    this.ui.whoEl.innerHTML = `<div class="av">${avatar(P.profile, 30, 'cookie9')}</div><span>${f.name}</span>`;
    this.ui.banner(`${P.profile.name} ist dran!`, P.ai ? `${f.name} · KI denkt nach …` : `${f.name} · Zielen, Karten spielen, feuern!`);
    Sfx.turnStart();
    await this.sleep(1.1);
    if (this.state !== 'playing' || this.currentPlayer !== P) return;
    this.phase = 'aim';
    this.ui.renderHand();
    if (P.ai) P.brain.takeTurn().catch((e) => { console.error(e); if (this.currentPlayer === P && this.phase === 'aim') this.skipShot(); });
  },

  allSettled() {
    return !this.projectiles.length && !this.beams.length && this.fluffs.every((f) => f.resting) && !this.timers.some((t) => t.blocking) && !this.mines.some((m) => m.trigger >= 0);
  },

  updateMatch(dt, t) {
    for (const f of this.fluffs) f.update(dt, t);
    for (const p of this.projectiles) p.update(dt);
    this.projectiles = this.projectiles.filter((p) => p.alive);
    for (const m of this.mines) m.update(dt);
    this.mines = this.mines.filter((m) => m.alive);
    for (const b of this.beams) b.update(dt);
    this.beams = this.beams.filter((b) => b.alive);
    if (this.state !== 'playing') return;
    if (['aim', 'flying', 'retreat', 'rope'].includes(this.phase)) for (const f of this.fluffs) if (f.alive) this.butterflies.hitTest(f.x, f.cy, 2.3, null);
    // rope
    const af = this.activeFluff;
    const head = this.projectiles.find((p) => p.kind === 'rope') || (af && af.rope ? { x: af.rope.ax, y: af.rope.ay } : null);
    this.ropeMesh.visible = !!(head && af && af.alive);
    if (this.ropeMesh.visible) {
      const dx = head.x - af.x, dy = head.y - af.cy, len = Math.hypot(dx, dy);
      this.ropeMesh.position.set((head.x + af.x) / 2, (head.y + af.cy) / 2, -0.8);
      this.ropeMesh.scale.set(1, len, 1); this.ropeMesh.rotation.z = Math.atan2(dy, dx) - Math.PI / 2;
    }
    // movement (human input or AI walk)
    const canMove = (this.phase === 'aim' || this.phase === 'retreat') && af && af.alive;
    let dir = 0;
    if (canMove && this.isHumanTurn()) dir = (this.input.right ? 1 : 0) - (this.input.left ? 1 : 0);
    if (this.aiMove) { dir = this.aiMove.dir; this.aiMove.t -= dt; if (this.aiMove.t <= 0 || this.stamina <= 0 || !canMove) { const r = this.aiMove.resolve; this.aiMove = null; r(); } }
    if (dir && canMove && this.stamina > 0) { if (af.walk(dir, dt)) this.stamina -= WALK_SPEED * dt; }
    else if (dir && canMove && af.grounded) af.facing = dir;
    switch (this.phase) {
      case 'aim':
        if (!this.blocking) this.turnTime -= dt;
        if (this.turnTime <= 5 && Math.ceil(this.turnTime) !== Math.ceil(this.turnTime + dt) && this.turnTime > 0) Sfx.tick(true);
        if (this.turnTime <= 0) { this.ui.toast('Zeit abgelaufen!', '', '⏰'); this.endTurn(); }
        break;
      case 'flying':
        this.followObj = this.projectiles.find((p) => p.kind !== 'rope') || this.followObj;
        if (this.allSettled()) {
          this.followObj = null;
          this.phase = 'retreat'; this.retreatTime = 3;
          const P = this.currentPlayer;
          if (P && P.ai) P.brain.retreat().catch((e) => console.error(e));
        }
        break;
      case 'retreat':
        this.retreatTime -= dt;
        if (this.retreatTime <= 0) this.endTurn();
        break;
      case 'rope':
        if (!this.projectiles.some((p) => p.kind === 'rope') && !(af && af.state === 'rope')) this.phase = 'aim';
        break;
      case 'settle':
        if (this.allSettled() && this.settleCb) { const cb = this.settleCb; this.settleCb = null; cb(); }
        break;
    }
  },

  waitSettle() { return new Promise((r) => { this.phase = 'settle'; this.settleCb = r; }); },

  async endTurn() {
    if (!['aim', 'retreat', 'flying', 'rope'].includes(this.phase) || this.state !== 'playing') return;
    const turn = this.turnId;
    this.input.left = this.input.right = false;
    if (this.aiMove) { this.aiMove.resolve(); this.aiMove = null; }
    await this.waitSettle();
    if (this.state !== 'playing' || turn !== this.turnId) return;
    if (this.checkWin()) return;
    const P = this.currentPlayer;
    if (P.alive && !this.turnFx.skipDraw && P.ai) await P.brain.endTurnChoice().catch((e) => console.error(e));
    if (!P.alive || this.turnFx.skipDraw) { await this.sleep(0.4); return this.nextTurn(); }
    this.phase = 'draw';
    await this.sleep(0.45);
    const card = this.deck.draw(this.aliveTeams().length);
    for (const p of this.players) if (p.brain) p.brain.knownTop = null;
    if (card.id === 'bomb') await this.bombSequence(P, card);
    else {
      P.hand.push(card);
      Sfx.cardFlip();
      if (this.handOwner() === P) { this.ui.toast(`Gezogen: ${CARD_DEFS[card.id].name}`, '', CARD_DEFS[card.id].emoji); this.ui.renderHand(card.uid); }
      else this.ui.toast(`${P.profile.name} zieht eine Karte`, '', '🃏');
    }
    this.ui.refreshTeams();
    await this.sleep(0.8);
    if (this.state !== 'playing' || turn !== this.turnId) return;
    if (this.checkWin()) return;
    this.nextTurn();
  },

  async bombSequence(P, card) {
    const f = P.fluffs[P.fluffTurn].alive ? P.fluffs[P.fluffTurn] : P.fluffs.find((x) => x.alive);
    this.ui.banner('💥 EXPLODING FLUFF!', `${P.profile.name} hat die Bombe gezogen!`, 'error');
    Sfx.alarm();
    if (f) { this.followObj = { x: f.x, y: f.cy }; f.model.setExpression('wow', 3); }
    await this.sleep(1.5);
    const def = P.hand.find((c) => c.id === 'defuse');
    if (def) {
      P.hand.splice(P.hand.indexOf(def), 1); this.deck.discard.push(def);
      Sfx.defuse();
      if (f) for (let i = 0; i < 24; i++) this.world.fxNorm.spawn({ x: f.x + rand(-1.5, 1.5), y: f.cy + rand(-1, 1.5), z: 0, vx: rand(-3, 3), vy: rand(2, 7), life: rand(1, 1.8), size: rand(0.6, 1.1), color: pick(['#ff7fbf', '#ffb3dd', '#ffffff']), shape: 2, g: 4 });
      this.ui.toast('Entschärft durch sanftes Kraulen!', 'event', '🤲');
      let pos = 'random';
      if (!P.ai) {
        pos = await this.ui.dialog({ emoji: '💣', shape: 'burst', tone: 'error', title: 'Bombe zurücklegen', text: 'Du hast die Exploding-Fluff-Karte entschärft. Wohin soll sie heimlich zurück in den Stapel?', center: true, actions: [{ label: 'Ganz oben', value: 'top', kind: 'tonal' }, { label: 'Zufällig', value: 'random', kind: 'filled' }, { label: 'Ganz unten', value: 'bottom', kind: 'tonal' }] }) || 'random';
      } else pos = P.brain.defusePosition();
      this.deck.insert(card, pos);
      this.ui.renderHand();
    } else {
      this.deck.discard.push(card);
      if (f) {
        await this.sleep(0.4);
        this.explode(f.x, f.cy, 5.5, 60, { owner: null, look: 'bomb' });
        this.cam.shake = 1.6;
        await this.waitSettle();
      }
    }
    this.followObj = null;
  },

  selectWeapon(id) {
    const P = this.currentPlayer;
    if (!P || P.ammo[id] <= 0 || this.phase !== 'aim') return;
    this.weapon = id; P.lastWeapon = id;
    if (WEAPON_BY_ID[id].kind !== 'target') this.aimPoint = null;
    else if (!P.ai) this.ui.toast('Tippe auf einen Ort in der Arena, dann FEUER!', '', '🌈');
    this.ui.refreshWeapons();
    Sfx.pop();
  },

  humanJump() { if (this.isHumanTurn() && (this.phase === 'aim' || this.phase === 'retreat')) this.activeFluff.jump(); },
  humanFire() {
    if (!this.isHumanTurn() || this.phase !== 'aim') return;
    if (WEAPON_BY_ID[this.weapon].kind === 'target' && !this.aimPoint) { this.ui.toast('Tippe zuerst auf einen Zielort!', '', '🌈'); return; }
    this.fire();
  },
  humanEndTurn() { if (this.isHumanTurn() && (this.phase === 'aim' || this.phase === 'retreat')) this.endTurn(); },
  skipShot() { this.endTurn(); },
  aiWalk(dir, t) { return new Promise((resolve) => { if (this.aiMove) this.aiMove.resolve(); this.aiMove = { dir, t, resolve }; }); },

  fire() {
    const f = this.activeFluff, P = this.currentPlayer, w = WEAPON_BY_ID[this.weapon];
    if (!f || !f.alive || this.phase !== 'aim' || P.ammo[w.id] <= 0) return;
    const d = this.aimDir();
    P.ammo[w.id]--;
    f.model.setExpression('wow', 0.8); f.model.squashV -= 2.5;
    f.facing = d.x >= 0 ? 1 : -1;
    $('#cardPop') && $('#cardPop').remove();
    switch (w.kind) {
      case 'bullet': case 'grenade': {
        const sp = w.speed * this.aim.power;
        const pr = new Projectile(this, { x: f.x + d.x * 1.6, y: f.cy + 0.4 + d.y * 1.6, vx: d.x * sp, vy: d.y * sp, kind: w.kind, look: w.kind === 'bullet' ? 'heart' : 'plush', radius: w.radius, damage: w.damage, windK: w.windK, owner: f, fuse: w.fuse, bounce: w.bounce, clusters: w.id === 'cluster' ? 5 : 0, trail: w.kind === 'bullet' ? '#ff9ccf' : '#ffd6a8' });
        this.projectiles.push(pr); this.followObj = pr; Sfx.whoosh(); this.phase = 'flying'; break;
      }
      case 'target':
        this.beams.push(new Beam(this, this.aimPoint.x, this.aimPoint.y, f, w.radius, w.damage));
        this.followObj = { x: this.aimPoint.x, y: this.aimPoint.y }; this.phase = 'flying'; break;
      case 'rope': {
        const pr = new Projectile(this, { x: f.x + d.x * 1.6, y: f.cy + d.y * 1.6, vx: d.x * w.speed, vy: d.y * w.speed, kind: 'rope', look: 'hook', owner: f, range: w.range, trail: '#ffd1ee' });
        this.projectiles.push(pr); this.phase = 'rope'; Sfx.rope(); break;
      }
      case 'melee': this.doShove(f, d, w); this.phase = 'flying'; break;
      case 'mine': this.mines.push(new Mine(this, f.x + f.facing * 1.8, f.cy, f)); Sfx.pop(); this.phase = 'flying'; break;
    }
    this.cam.punch = 3;
    this.ui.refreshWeapons();
  },

  doShove(f, d, w) {
    Sfx.squeak(1.2);
    const mult = this.turnFx.double ? 2 : 1;
    this.world.sparkleBurst(f.x + d.x * 2, f.cy + d.y * 2, '#ffb3dd', 26, 8);
    let hit = false;
    for (const o of this.fluffs) {
      if (o === f || !o.alive) continue;
      const dx = o.x - f.x, dy = o.cy - f.cy, dist = Math.hypot(dx, dy);
      if (dist < w.range && dx * d.x + dy * d.y > -0.4) {
        hit = true;
        o.damage(w.damage * mult, f, 'shove');
        const s = Math.sign(dx) || f.facing;
        o.impulse(s * w.push * (0.8 + mult * 0.2), 13);
        for (let i = 0; i < 10; i++) this.world.fxNorm.spawn({ x: o.x, y: o.cy, vx: rand(-5, 5), vy: rand(2, 8), life: 1.2, size: 0.9, color: '#ff7fbf', shape: 2, g: 10 });
      }
    }
    if (!hit) this.ui.toast('Ins Leere gekuschelt …', '', '🤗');
  },

  explode(x, y, r, dmg, o = {}) {
    const ownerTeam = o.owner ? o.owner.team : null;
    const dbl = ownerTeam && ownerTeam === this.currentPlayer && this.turnFx.double;
    const R = r * (dbl ? 1.25 : 1), D = dmg * (dbl ? 2 : 1);
    this.terrain.carve(x, y, R);
    const palettes = { rainbow: ['#ff5f7e', '#ffa64d', '#ffe14d', '#6fdc7a', '#5fb6ff', '#a07cff'], star: ['#ffe27a', '#fff6c0', '#ffffff', '#ffc94d'], bomb: ['#ff5f7e', '#ffb3dd', '#ffffff', '#ffd36b'], candy: ['#ff6fb0', '#ffffff', '#ffe0f0'], miniplush: ['#ffd6a8', '#ff9ccf', '#fff'] };
    this.world.explosionFx(x, y, R, palettes[o.look]);
    if (!o.silent) Sfx.explosion(clamp(R / 3, 0.6, 1.7));
    this.cam.shake = Math.max(this.cam.shake, Math.min(1.3, R * 0.28));
    this.cam.punch = Math.min(8, R * 1.3);
    for (const f of this.fluffs) {
      if (!f.alive) continue;
      const d = Math.hypot(f.x - x, f.cy - y), k = 1 - d / (R + FLUFF_R * 1.4);
      if (k <= 0) continue;
      if (D > 0) f.damage(D * k, o.owner, 'explosion');
      const nx = (f.x - x) / (d || 1), ny = (f.cy - y) / (d || 1);
      f.impulse(nx * 24 * k + rand(-0.5, 0.5), Math.max(ny, 0.35) * 20 * k + 6 * k);
    }
    for (const m of this.mines) if (m.alive && Math.hypot(m.x - x, m.y - y) < R + 1.5) this.later(0.12, () => m.detonate());
    this.butterflies.explosionTest(x, y, R);
  },

  splash(x) {
    Sfx.noise({ dur: 0.5, vol: 0.25, type: 'lowpass', f0: 1800, f1: 300 });
    for (let i = 0; i < 24; i++) this.world.fxNorm.spawn({ x: x + rand(-1, 1), y: this.world.seaY, z: rand(-1, 1), vx: rand(-4, 4), vy: rand(6, 14), life: rand(0.8, 1.3), size: rand(0.5, 1.0), color: pick(['#ffb3dd', '#e6ccff', '#ffffff']), shape: 0, g: 26, drag: 0.5 });
  },

  onRopeAnchor(p, x, y) { const f = p.owner; if (!f.alive) return; f.state = 'rope'; f.rope = { ax: x, ay: y, t: 0 }; f.grounded = false; f.y += 0.1; Sfx.pop(); this.world.sparkleBurst(x, y, '#ffd1ee', 14, 5); },
  onRopeMiss() { if (this.phase === 'rope') this.phase = 'aim'; this.ui.toast('Daneben! Der Haken findet keinen Halt.', '', '🍭'); },
  onRopeDone(f) { if (this.phase === 'rope' && f === this.activeFluff) this.phase = 'aim'; },

  onFluffDied(f) {
    this.ui.refreshTeams();
    if (!f.team.fluffs.some((x) => x.alive)) { f.team.alive = false; this.ui.toast(`Team ${f.team.profile.name} ist raus!`, 'error', '💔'); }
    if (f === this.activeFluff && (this.phase === 'aim' || this.phase === 'rope')) this.later(0.5, () => this.endTurn());
  },

  gameOver(winner) {
    if (this.state === 'over') return;
    this.state = 'over'; this.phase = 'over';
    Sfx.win();
    const W = this.world;
    for (let i = 0; i < 6; i++) this.later(i * 0.25, () => W.explosionFx(this.cam.x + rand(-15, 15), this.cam.y + rand(0, 10), 2, ['#ff7fbf', '#ffd36b', '#b28bff', '#7fd8ff']), false);
    this.later(1.4, async () => {
      const stats = el('div', { class: 'lex-list', style: { marginTop: '0', marginBottom: '18px' } });
      for (const p of this.players) stats.append(el('div', { class: 'lex-item', html: `<div class="art">${avatar(p.profile, 56, 'cookie9')}</div><div><div class="t">${p.profile.name} ${p === winner ? '👑' : ''}</div><div class="d">${Math.round(this.stats.damage[p.id] || 0)} Schaden verursacht · ${p.fluffs.filter((f) => f.alive).length} überlebt</div></div>` }));
      const v = await this.ui.dialog({ emoji: winner ? '👑' : '🤝', shape: 'sunny', tone: 'tertiary', title: winner ? `${winner.profile.name} gewinnt!` : 'Unentschieden!', text: winner ? 'Der flauschigste Sieg aller Zeiten.' : 'Alle sind gleichzeitig k.o. gekuschelt.', content: stats, center: true, actions: [{ label: 'Hauptmenü', value: 'menu', kind: 'tonal', icon: 'home' }, { label: 'Revanche', value: 'again', kind: 'filled', icon: 'restart' }] });
      if (v === 'again') this.startMatch(this.lastConfig); else this.backToMenu();
    }, false);
  },

  async pause(page) {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    let choice = page || null;
    for (;;) {
      if (!choice) choice = await this.ui.dialog({ emoji: '⏸️', shape: 'cookie12', title: 'Pause', text: 'Kurz durchkuscheln …', center: true, dismiss: true, actions: [{ label: 'Menü', value: 'menu', kind: 'text', icon: 'home' }, { label: 'Lexikon', value: 'lexikon', kind: 'tonal', icon: 'book' }, { label: 'Optionen', value: 'options', kind: 'tonal', icon: 'tune' }, { label: 'Weiter', value: 'resume', kind: 'filled', icon: 'play' }] });
      if (choice === 'lexikon') {
        const box = el('div');
        const render = (t) => { box.innerHTML = ''; box.append(this.ui.lexikonContent(t, render)); };
        render('cards');
        await this.ui.dialog({ title: 'Lexikon', content: box, actions: [{ label: 'Zurück', value: 1, kind: 'filled' }] });
        choice = null; continue;
      }
      if (choice === 'options') { await this.ui.dialog({ title: 'Optionen', content: this.ui.optionsContent(), actions: [{ label: 'Zurück', value: 1, kind: 'filled' }] }); choice = null; continue; }
      if (choice === 'menu') {
        const ok = await this.ui.dialog({ emoji: '🏠', title: 'Spiel verlassen?', text: 'Der aktuelle Spielstand geht verloren.', center: true, actions: [{ label: 'Abbrechen', value: false, kind: 'text' }, { label: 'Verlassen', value: true, kind: 'error' }] });
        if (ok) { this.backToMenu(); return; }
        choice = null; continue;
      }
      break;
    }
    this.state = 'playing'; this.clock.getDelta();
  },

  // ── cards ──
  canPlayCard(P, c) {
    const d = CARD_DEFS[c.id];
    return !!(d.playable && this.state === 'playing' && P === this.currentPlayer && this.phase === 'aim' && !this.cardBusy);
  },

  async resolveNope(card, by) {
    let current = card, last = by, nopes = 0;
    for (;;) {
      const responders = this.players.filter((p) => p !== last && p.alive && p.hand.some((c) => c.id === 'nope'));
      if (!responders.length) break;
      let noper = null;
      for (const p of responders.filter((p) => p.ai)) if (p.brain.wantsNope(current, last)) { noper = p; break; }
      const humans = responders.filter((p) => !p.ai);
      if (!noper && humans.length) { await this.sleep(0.2); noper = await this.ui.nopeWindow(current, last, humans); }
      if (!noper || !noper.hand || !noper.hand.some((c) => c.id === 'nope')) break;
      const nc = noper.hand.find((c) => c.id === 'nope');
      noper.hand.splice(noper.hand.indexOf(nc), 1); this.deck.discard.push(nc);
      nopes++; current = nc; last = noper;
      Sfx.nope();
      this.ui.banner('🙅 NOPE!', `${noper.profile.name} blockt ${nopes % 2 ? '„' + CARD_DEFS[card.id].name + '“' : 'das Nope'}!`, 'error');
      this.ui.renderHand(); this.ui.refreshTeams();
      await this.sleep(1.2);
    }
    return nopes % 2 === 0;
  },

  async playCard(P, c, opts = {}) {
    if (!this.canPlayCard(P, c)) return false;
    const d = CARD_DEFS[c.id];
    this.cardBusy = true; this.blocking++;
    P.hand.splice(P.hand.indexOf(c), 1); this.deck.discard.push(c);
    Sfx.cardFlip();
    this.ui.renderHand(); this.ui.refreshTeams();
    this.ui.toast(`${P.profile.name} spielt ${d.name}`, '', d.emoji);
    let ok = true;
    if (d.nopeable) ok = await this.resolveNope(c, P);
    this.blocking--; this.cardBusy = false;
    if (this.state !== 'playing' || this.currentPlayer !== P) return false;
    if (!ok) { this.ui.renderHand(); return false; }
    const f = this.activeFluff;
    switch (c.id) {
      case 'skip': this.turnFx.skipDraw = true; this.ui.toast('Zug übersprungen – keine Karte ziehen!', 'event', '⏭️'); this.endTurn(); break;
      case 'double': this.turnFx.double = true; this.ui.banner('⚔️ Doppelter Angriff!', 'Doppelter Schaden in diesem Zug', 'tertiary'); Sfx.sparkle(8, 900); break;
      case 'future': {
        const top = this.deck.peek(3);
        if (P.ai) { P.brain.knownTop = top[0] ? top[0].id : null; break; }
        const row = el('div', { class: 'future' });
        top.forEach((tc) => { const td = CARD_DEFS[tc.id]; row.append(el('div', { class: `gcard tone-${td.tone}`, html: `<div class="art">${shapeSvg(td.shape, 66, 'rgba(255,255,255,.55)')}<span>${td.emoji}</span></div><div class="nm">${td.name}</div>` })); });
        this.blocking++;
        await this.ui.dialog({ emoji: '🔮', shape: 'flower', title: 'Die Zukunft', text: 'Die obersten Karten (links = als Nächstes):', content: row, center: true, actions: [{ label: 'Pssst 🤫', value: 1, kind: 'filled' }] });
        this.blocking--;
        break;
      }
      case 'steal': {
        let target = opts.target && opts.target.alive && opts.target.hand.length ? opts.target : pick(this.players.filter((o) => o !== P && o.alive && o.hand.length));
        if (!target) { this.ui.toast('Niemand hatte Karten 🦝'); break; }
        const sc = target.hand.splice(Math.floor(Math.random() * target.hand.length), 1)[0];
        P.hand.push(sc);
        Sfx.rustle();
        const viewer = this.handOwner();
        if (viewer === P) this.ui.toast(`Geklaut von ${target.profile.name}: ${CARD_DEFS[sc.id].name}`, 'event', CARD_DEFS[sc.id].emoji);
        else if (viewer === target) this.ui.toast(`${P.profile.name} hat dir „${CARD_DEFS[sc.id].name}“ geklaut!`, 'error', '🦝');
        else this.ui.toast(`${P.profile.name} klaut ${target.profile.name} eine Karte`, '', '🦝');
        this.ui.renderHand(sc.uid); this.ui.refreshTeams();
        break;
      }
      case 'shuffle': this.deck.shuffle(); for (const p of this.players) if (p.brain) p.brain.knownTop = null; this.ui.toast('Der Stapel wurde gemischt', '', '🌀'); break;
      case 'lure': this.butterflies.lureTo(f); this.ui.toast('Ein Schmetterling wird angelockt …', 'event', '🦋'); break;
      case 'aim': this.turnFx.aim = true; this.ui.toast('Volle Flugbahn sichtbar!', 'event', '🎯'); break;
      case 'shield': f.shield = true; this.ui.toast(`${f.name} ist eingekuschelt (halber Schaden)`, 'event', '🛡️'); Sfx.heal(); break;
    }
    this.ui.renderHand();
    return true;
  },

  // ── butterfly events ──
  onButterflyEvent(ev, x, y, chain) {
    this.ui.banner(`${ev.emoji} ${ev.name}`, chain > 1 ? `Kettenreaktion ×${chain}!` : 'Schmetterlingseffekt!', 'tertiary');
    this.ui.toast(ev.desc, 'event', ev.emoji);
    ev.run(this, x, y);
  },

  setAntiGravity() { this.antiGrav = this.aliveTeams().length + 1; this.env.grav = -1; this.world.setMood(1); Sfx.gravity(); for (const f of this.fluffs) if (f.alive) f.impulse(0, 6); },
  setStorm() { this.storm = 3; this.env.wind = pick([-1, 1]); Sfx.whoosh(); },

  meteorShower(cx) {
    for (let i = 0; i < 9; i++) this.later(0.15 + i * 0.28, () => {
      if (this.state !== 'playing') return;
      const x = clamp(cx + rand(-35, 35), 4, this.W - 4);
      this.projectiles.push(new Projectile(this, { x, y: this.H + 25, vx: rand(-6, 6), vy: -32 * this.env.grav, kind: 'bullet', look: 'star', radius: 2.2, damage: 15, windK: 0.25, owner: null, trail: '#fff2a8' }));
    });
    if (this.phase === 'aim') this.blocking++, this.later(3, () => this.blocking--);
  },

  swapRandom() {
    const alive = this.fluffs.filter((f) => f.alive);
    if (alive.length < 2) return;
    let a = pick(alive), b = pick(alive.filter((f) => f !== a && f.team !== a.team)) || pick(alive.filter((f) => f !== a));
    for (const f of [a, b]) this.world.sparkleBurst(f.x, f.cy, '#e8c8ff', 40, 10);
    [a.x, b.x] = [b.x, a.x]; [a.y, b.y] = [b.y, a.y];
    a.vx = a.vy = b.vx = b.vy = 0; a.grounded = b.grounded = false;
    for (const f of [a, b]) { this.world.ring(f.x, f.cy, 0, 4, '#f2d4ff'); f.model.setExpression('wow', 1.4); }
    Sfx.sparkle(12);
    this.ui.toast(`${a.name} ⇄ ${b.name}`, 'event', '🔄');
  },

  shockwave(x, y, R, dmg) {
    this.world.ring(x, y, 0, R * 1.2, '#ffd6f0', 1.0); this.world.ring(x, y, 0, R * 0.8, '#ffffff', 0.7);
    this.world.explosionFx(x, y, 1.5, ['#ffffff', '#ffd6f0', '#e8c8ff']);
    Sfx.explosion(0.7); Sfx.boing();
    this.cam.shake = 1;
    for (const f of this.fluffs) {
      if (!f.alive) continue;
      const d = Math.hypot(f.x - x, f.cy - y); if (d > R) continue;
      const k = 1 - d / R, nx = (f.x - x) / (d || 1);
      f.damage(dmg * k, null, 'shock');
      f.impulse(nx * 32 * k, 12 + 10 * k);
    }
  },

  healArea(x, y, R, n) {
    Sfx.heal();
    for (let i = 0; i < 60; i++) this.world.fxAdd.spawn({ x: x + rand(-R, R), y: y + rand(4, 14), vx: 0, vy: rand(-6, -2), life: rand(1, 2), size: rand(0.5, 1.2), color: pick(['#ff5f7e', '#ffa64d', '#ffe14d', '#6fdc7a', '#5fb6ff', '#a07cff']), shape: pick([2, 3]), drag: 0.5 });
    for (const f of this.fluffs) if (f.alive && Math.hypot(f.x - x, f.cy - y) < R) f.heal(n);
  },

  cardRain() {
    for (const p of this.players) if (p.alive) p.hand.push(makeCard(pick(Object.keys(ACTION_POOL))));
    Sfx.rustle(); this.ui.renderHand(); this.ui.refreshTeams();
  },

  sugarIsland(x, y) {
    const cx = clamp(x, 8, this.W - 8), cy = clamp(y - 2, this.world.seaY + 3, this.H - 8);
    this.terrain.add(cx, cy, 5.5);
    this.world.sparkleBurst(cx, cy, '#ffffff', 40, 10);
    for (const f of this.fluffs) if (f.alive) { let k = 0; while ((this.terrain.solid(f.x, f.y + 0.3) || this.terrain.solid(f.x, f.cy)) && k++ < 120) f.y += 0.25; }
    Sfx.sparkle(8, 900);
  },
});
