// ───────────────────────── UI · in-game HUD ─────────────────────────
Object.assign(UI.prototype, {
  buildHud() {
    const g = this.game;
    this.hud.innerHTML = '';
    this.hud.classList.remove('hidden');
    this.labels.innerHTML = ''; this.labelEls = new Map();
    // teams
    this.teamsEl = el('div', { id: 'teams', class: 'glass' });
    // turn pill
    this.turnPill = el('div', { id: 'turnPill', class: 'glass' });
    this.whoEl = el('div', { class: 'who' });
    const tm = el('div', { class: 'tm' }, el('div', { class: 'wvwrap' }), el('div', { class: 'num' }));
    this.timerNum = tm.children[1];
    this.deckEl = el('div', { class: 'deck', html: `${icon('cards', 16)}<span>0</span>` });
    this.turnPill.append(this.whoEl, tm, this.deckEl);
    // right top: wind + minimap + pause
    this.windEl = el('div', { id: 'windCard', class: 'glass', html: `<div class="dial">${shapeSvg('cookie9', 64, 'var(--md-primary-container)')}<div class="arrow">${icon('right', 32)}</div></div><div class="bar"></div><div class="lbl">WIND</div>` });
    this.minimap = el('canvas', { id: 'minimap', width: 360, height: 180 });
    const pause = el('button', { id: 'pauseBtn', class: 'icon-btn tonal st', html: icon('pause', 22), 'aria-label': 'Pause' });
    pause.onclick = () => g.pause();
    const rt = el('div', { id: 'rightTop' }, el('div', { id: 'minimapCard', class: 'glass' }, this.minimap), this.windEl, pause);
    // weapons
    this.weaponBar = el('div', { id: 'weaponBar', class: 'glass' });
    // movement
    const mk = (cls, ic, key) => {
      const b = el('button', { class: 'icon-btn ' + cls, html: icon(ic, 28) });
      const on = (e) => { e.preventDefault(); b.classList.add('held'); if (key === 'jump') g.humanJump(); else g.input[key] = true; };
      const off = () => { b.classList.remove('held'); if (key !== 'jump') g.input[key] = false; };
      b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointerleave', off); b.addEventListener('pointercancel', off);
      return b;
    };
    this.moveBar = el('div', { id: 'moveBar', class: 'glass' }, mk('', 'left', 'left'), mk('jump', 'jump', 'jump'), mk('', 'right', 'right'));
    this.staminaEl = el('div', { id: 'stamina' }, el('div', { class: 'label-s' }, 'AUSDAUER'), el('div', { class: 'sbar' }));
    // hand
    this.handEl = el('div', { id: 'hand' });
    // fire + fab menu
    this.fireFab = el('button', { id: 'fireFab', html: `<span class="em">💘</span><span class="lbl">FEUER</span>` });
    this.fireFab.onclick = () => g.humanFire();
    this.fabMenu = el('div', { class: 'fab-menu' }, el('div', { class: 'items' }), el('button', { class: 'toggle', html: icon('plus', 26), 'aria-label': 'Mehr' }));
    this.fabMenu.lastChild.onclick = () => this.toggleFabMenu();
    const fw = el('div', { id: 'fireWrap' }, this.fabMenu, this.fireFab);
    this.hud.append(this.teamsEl, this.turnPill, rt, this.weaponBar, this.staminaEl, this.moveBar, this.handEl, fw);
    this.timerBar = new WavyBar(tm.firstChild, { height: 16, amp: 3.2, wl: 18 });
    this.windBar = new WavyBar(this.windEl.querySelector('.bar'), { height: 10, amp: 2, wl: 10, color: 'var(--md-tertiary)' });
    this.stamBar = new WavyBar(this.staminaEl.querySelector('.sbar'), { height: 14, amp: 2.5, wl: 14 });
    for (const f of g.fluffs) this.makeLabel(f);
    this.refreshTeams(); this.refreshWeapons(); this.renderHand();
    this.miniT = 0;
  },

  toggleFabMenu(force) {
    const g = this.game, open = force != null ? force : !this.fabMenu.classList.contains('open');
    this.fabMenu.classList.toggle('open', open);
    const items = this.fabMenu.firstChild; items.innerHTML = '';
    if (!open) return;
    const add = (ic, label, fn) => { const b = el('button', { class: 'st', html: `${icon(ic, 20)}<span>${label}</span>` }); b.onclick = () => { this.toggleFabMenu(false); fn(); }; items.append(b); };
    add('skip', 'Zug beenden', () => g.humanEndTurn());
    add('crosshair', 'Kamera zentrieren', () => g.focusActive());
    add('book', 'Lexikon', () => g.pause('lexikon'));
    add('pause', 'Pause', () => g.pause());
  },

  makeLabel(f) {
    const acc = TEAM_ACCENTS[f.team.id % 4];
    const e = el('div', { class: 'flabel', html: `<div class="n" style="background:${acc}">${f.name}</div><div class="hp"><i style="background:${acc}"></i></div><div class="sh"></div>` });
    this.labels.append(e); this.labelEls.set(f, e);
  },

  refreshTeams() {
    const g = this.game;
    this.teamsEl.innerHTML = '';
    for (const p of g.players) {
      const hp = p.fluffs.reduce((s, f) => s + f.hp, 0), max = p.fluffs.length * 100;
      const acc = TEAM_ACCENTS[p.id % 4];
      this.teamsEl.append(el('div', { class: 'team' + (p === g.currentPlayer ? ' cur' : '') + (p.alive ? '' : ' dead'), html: `<div class="av">${avatar(p.profile, 32, 'cookie9')}</div><div><div class="nm">${p.profile.name} ${p.ai ? '🤖' : ''}</div><div class="hpbar"><i style="width:${(hp / max) * 100}%;background:${acc}"></i></div></div><div class="cards">${icon('cards', 13)}${p.hand.length}</div>` }));
    }
  },

  refreshWeapons() {
    const g = this.game, P = g.currentPlayer;
    this.weaponBar.innerHTML = '';
    if (!P) return;
    WEAPONS.forEach((w, i) => {
      const ammo = P.ammo[w.id];
      const b = el('button', { class: 'wbtn st' + (g.weapon === w.id ? ' on' : '') + (ammo <= 0 ? ' empty' : ''), title: `${w.name} (${i + 1})`, html: `<span>${w.emoji}</span><span class="wl">${w.name}</span>${ammo !== Infinity ? `<span class="am">${ammo}</span>` : ''}` });
      b.onclick = () => { if (g.isHumanTurn()) g.selectWeapon(w.id); };
      this.weaponBar.append(b);
    });
    this.fireFab.querySelector('.em').textContent = WEAPON_BY_ID[g.weapon].emoji;
  },

  renderHand(newUid = null) {
    const g = this.game, P = g.handOwner();
    this.handEl.innerHTML = '';
    $('#cardPop') && $('#cardPop').remove();
    if (!P) return;
    const n = P.hand.length;
    P.hand.forEach((c, i) => {
      const d = CARD_DEFS[c.id];
      const off = i - (n - 1) / 2;
      const can = g.canPlayCard(P, c);
      const card = el('div', { class: `gcard tone-${d.tone}` + (can ? '' : ' dis') + (c.uid === newUid ? ' enter' : ''), html: `<div class="art">${shapeSvg(d.shape, 66, 'rgba(255,255,255,.55)')}<span>${d.emoji}</span></div><div class="nm">${d.name}</div>` });
      card.style.transform = `translateY(${Math.abs(off) * Math.abs(off) * 3}px) rotate(${off * 5}deg)`;
      card.style.zIndex = i;
      card.onclick = (e) => { e.stopPropagation(); this.selectCard(card, c, P); };
      card.onmouseenter = () => Sfx.hover();
      this.handEl.append(card);
    });
  },

  selectCard(cardEl, c, P) {
    const g = this.game, was = cardEl.classList.contains('sel');
    $$('.gcard', this.handEl).forEach((x) => x.classList.remove('sel'));
    $('#cardPop') && $('#cardPop').remove();
    if (was) return;
    cardEl.classList.add('sel');
    Sfx.cardFlip();
    const d = CARD_DEFS[c.id], can = g.canPlayCard(P, c);
    const pop = el('div', { id: 'cardPop', class: 'glass', html: `<div class="t">${d.emoji} ${d.name}</div><div class="d">${d.desc}</div>` });
    const why = d.reactive ? 'Wird automatisch angeboten, wenn ein Gegner eine Karte spielt.' : d.id === 'defuse' ? 'Wird automatisch bei einer Exploding-Fluff-Karte eingesetzt.' : 'Nur während deines Zuges vor dem Schuss spielbar.';
    if (can) {
      const b = el('button', { class: 'btn filled', html: `${icon('play', 18, true)}<span>Ausspielen</span>` });
      b.onclick = async () => { pop.remove(); let target = null; if (d.target) { target = await this.pickTarget(P); if (!target) return; } g.playCard(P, c, { target }); };
      pop.append(el('div', { class: 'row', style: { justifyContent: 'flex-end' } }, b));
    } else pop.append(el('div', { class: 'label-l', style: { color: 'var(--md-outline)' } }, why));
    this.hud.append(pop);
  },

  pickTarget(P) {
    const g = this.game;
    const opts = g.players.filter((o) => o !== P && o.alive && o.hand.length);
    if (!opts.length) { this.toast('Niemand hat Karten zum Klauen 🦝'); return Promise.resolve(null); }
    return this.dialog({ emoji: '🦝', shape: 'puffy', tone: 'secondary', title: 'Wen beklauen?', text: 'Wähle einen Gegner – du bekommst eine zufällige Karte.', actions: [...opts.map((o) => ({ label: `${o.profile.name} (${o.hand.length})`, kind: 'tonal', value: o })), { label: 'Abbrechen', kind: 'text', value: null }] });
  },

  floatText(wx, wy, text, kind = 'dmg') {
    const p = this.game.project(wx, wy, -1);
    if (!p) return;
    const f = el('div', { class: 'floater ' + kind, style: { left: p.x + 'px', top: p.y + 'px' } }, text);
    this.floaters.append(f);
    setTimeout(() => f.remove(), 1500);
  },

  flashTarget(pt) { this.game.world.sparkleBurst(pt.x, pt.y, '#ffffff', 24, 6); this.floatText(pt.x, pt.y + 2, '🎯', 'info'); },

  updateHud(dt) {
    const g = this.game;
    if (!this.labelEls) return;
    for (const [f, e] of this.labelEls) {
      if (!f.alive) { if (e.style.opacity !== '0') e.style.opacity = '0'; continue; }
      const p = g.project(f.x, f.y + 3.4, -1);
      if (!p) continue;
      e.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
      e.querySelector('.hp i').style.width = Math.max(0, f.shownHp) + '%';
      e.classList.toggle('active', f === g.activeFluff);
      const sh = (f.shield ? '🛡️' : '') + (f === g.activeFluff && g.turnFx.double ? '⚔️' : '');
      const se = e.querySelector('.sh'); if (se.textContent !== sh) se.textContent = sh;
    }
    const P = g.currentPlayer;
    if (P) {
      const tl = Math.max(0, g.turnTime);
      this.timerBar.set(tl / Settings.turnTime);
      this.timerBar.calm = g.phase !== 'aim';
      this.timerNum.textContent = g.phase === 'aim' ? `${Math.ceil(tl)} s` : g.phase === 'retreat' ? `Rückzug ${Math.ceil(g.retreatTime)} s` : '…';
      const f = g.activeFluff;
      this.stamBar.set(f ? g.stamina / STAMINA_MAX : 0);
    }
    this.timerBar.update(dt); this.stamBar.update(dt);
    const w = g.env.wind;
    this.windEl.querySelector('.arrow').style.transform = `rotate(${w < 0 ? 180 : 0}deg) scale(${0.7 + Math.abs(w) * 0.5})`;
    this.windBar.set(Math.abs(w)); this.windBar.update(dt);
    this.windEl.querySelector('.lbl').textContent = `WIND ${Math.round(Math.abs(w) * 100)}%`;
    this.deckEl.lastChild.textContent = g.deck.count;
    const human = g.isHumanTurn() && g.phase === 'aim';
    this.fireFab.disabled = !human;
    this.fireFab.classList.toggle('ready', human);
    this.moveBar.style.opacity = human ? 1 : 0.45;
    this.miniT -= dt;
    if (this.miniT <= 0) { this.miniT = 0.12; this.drawMinimap(); }
  },

  drawMinimap() {
    const g = this.game, c = this.minimap.getContext('2d'), W = 360, H = 180;
    if (g.terrain.miniDirty) { g.terrain.updateMini(); g.terrain.miniDirty = false; }
    c.clearRect(0, 0, W, H);
    c.fillStyle = 'rgba(255,160,210,.5)'; c.fillRect(0, H - (g.world.seaY / g.H) * H, W, H);
    c.imageSmoothingEnabled = true;
    c.drawImage(g.terrain.mini, 0, 0, W, H);
    const sx = W / g.W, sy = H / g.H;
    for (const b of g.butterflies.list) if (b.alive && b.cooldown <= 0) { c.fillStyle = '#b06cff'; c.beginPath(); c.arc(b.x * sx, H - b.y * sy, 4, 0, TAU); c.fill(); }
    for (const f of g.fluffs) {
      if (!f.alive) continue;
      c.fillStyle = TEAM_ACCENTS[f.team.id % 4]; c.strokeStyle = '#fff'; c.lineWidth = f === g.activeFluff ? 4 : 2.5;
      c.beginPath(); c.arc(f.x * sx, H - f.cy * sy, f === g.activeFluff ? 8 : 6, 0, TAU); c.fill(); c.stroke();
    }
    // camera viewport
    const v = g.viewRect();
    c.strokeStyle = 'rgba(106,75,196,.8)'; c.lineWidth = 3; c.setLineDash([8, 6]);
    c.strokeRect(v.x0 * sx, H - v.y1 * sy, (v.x1 - v.x0) * sx, (v.y1 - v.y0) * sy); c.setLineDash([]);
  },

  curtain(player) {
    return new Promise((res) => {
      const cv = el('div', { id: 'curtain' });
      const d = el('div', { class: 'dialog', html: `<div class="hicon">${shapeSvg('cookie12', 72, player.profile.fur)}<span><img src="${badgeImg(player.profile.badge)}" style="width:40px"></span></div><h3>${player.profile.name} ist dran!</h3><p>Gib das Gerät weiter. Die Karten der anderen bleiben geheim. 🤫</p>` });
      const b = el('button', { class: 'btn filled lg', html: `${icon('eye', 22)}<span>Ich bin bereit</span>` });
      b.onclick = () => { cv.remove(); res(); };
      d.append(el('div', { class: 'acts center' }, b));
      cv.append(d); document.body.append(cv);
    });
  },

  nopeWindow(card, by, responders) {
    const d = CARD_DEFS[card.id];
    return new Promise((res) => {
      let done = false;
      const finish = (v) => { if (done) return; done = true; clearInterval(iv); this.closeDialog('__x'); res(v); };
      const wv = el('div', { class: 'wavy-loader' });
      const bar = new WavyBar(wv, { height: 14, color: 'var(--md-error)' });
      let t = 4.5;
      const iv = setInterval(() => { t -= 0.05; bar.set(t / 4.5); bar.update(0.05); if (t <= 0) finish(null); }, 50);
      this.dialog({
        emoji: d.emoji, shape: d.shape, tone: d.tone, title: `${by.profile.name} spielt „${d.name}“`, text: 'Möchte jemand mit einer Nope!-Karte dazwischengehen?', content: wv, center: true,
        actions: [...responders.map((p) => ({ label: `🙅 Nope! (${p.profile.name})`, kind: 'error', value: p })), { label: 'Kein Nope', kind: 'text', value: null }],
      }).then((v) => finish(v === '__x' ? null : v));
    });
  },
});
