// ───────────────────────── UI · menus, editor, lexikon, options, dialogs ─────────────────────────
const Setup = Object.assign({ mode: 'ai', slots: ['human', 'ai', 'off', 'off'] }, store.get('fs_setup_v1', {}));
const saveSetup = () => store.set('fs_setup_v1', Setup);
const _badgeImg = {};
const badgeImg = (id) => (_badgeImg[id] = _badgeImg[id] || badgeDataURL(id, 96));

function avatar(p, size = 48, shape = 'cookie9') {
  return `${shapeSvg(shape, size, p.fur)}<img src="${badgeImg(p.badge)}" alt="">`;
}

class UI {
  constructor(game) {
    this.game = game;
    this.menu = $('#menu'); this.hud = $('#hud');
    this.labels = $('#labels'); this.floaters = $('#floaters');
    this.page = 'home'; this.editIdx = 0; this.lexTab = 'cards';
    document.addEventListener('pointerdown', (e) => { if (e.target.closest('button, .sw, .bd, .slot, .gcard, .switch')) Sfx.click(); }, true);
  }

  // ── generic widgets ──
  btnGroup(options, value, onChange, cls = '') {
    const g = el('div', { class: 'btn-group ' + cls });
    for (const o of options) {
      const b = el('button', { class: o.value === value ? 'on' : '', html: (o.icon ? icon(o.icon, 18) : '') + `<span>${o.label}</span>` });
      b.onclick = () => { $$('button', g).forEach((x) => x.classList.remove('on')); b.classList.add('on'); onChange(o.value); };
      g.append(b);
    }
    return g;
  }

  slider(min, max, value, onChange, fmt = (v) => Math.round(v * 100) + '%') {
    const s = el('div', { class: 'slider' }, el('div', { class: 'tr-a' }), el('div', { class: 'tr-b' }), el('div', { class: 'hd' }), el('div', { class: 'val' }));
    const [a, b, hd, val] = s.children;
    const set = (v) => {
      v = clamp(v, min, max); const k = (v - min) / (max - min);
      a.style.width = `calc(${k * 100}% - 6px)`; b.style.width = `calc(${(1 - k) * 100}% - 6px)`;
      hd.style.left = k * 100 + '%'; val.style.left = k * 100 + '%'; val.textContent = fmt(v);
      return v;
    };
    set(value);
    const move = (e) => { const r = s.getBoundingClientRect(); onChange(set(min + ((e.clientX - r.left) / r.width) * (max - min))); };
    s.addEventListener('pointerdown', (e) => { s.setPointerCapture(e.pointerId); s.classList.add('drag'); move(e); });
    s.addEventListener('pointermove', (e) => { if (s.classList.contains('drag')) move(e); });
    s.addEventListener('pointerup', () => s.classList.remove('drag'));
    s.addEventListener('pointercancel', () => s.classList.remove('drag'));
    return s;
  }

  switchRow(label, on, onChange) {
    const sw = el('button', { class: 'switch' + (on ? ' on' : ''), 'aria-label': label });
    sw.onclick = () => { sw.classList.toggle('on'); onChange(sw.classList.contains('on')); };
    return el('div', { class: 'switch-row' }, el('span', { class: 'title-m' }, label), sw);
  }

  sec(label, ...kids) { return el('div', { class: 'sec' }, el('span', { class: 'label-l' }, label), ...kids); }

  // ── menu ──
  showMenu(page = this.page) {
    this.page = page;
    this.hud.classList.add('hidden');
    this.menu.classList.remove('hidden');
    this.labels.innerHTML = '';
    this.menu.innerHTML = '';
    const items = [['home', 'home', 'Start'], ['editor', 'brush', 'Charakter-Editor'], ['lexikon', 'book', 'Lexikon'], ['options', 'tune', 'Optionen']];
    const rail = el('nav', { class: 'rail' },
      el('div', { class: 'logo', html: `${shapeSvg('flower', 34, '#ffb8f1')}<span>Fluffspheres</span>` }),
    );
    const play = el('button', { class: 'fab ext st', html: `${icon('play', 22, true)}<span>Spielen</span>` });
    play.onclick = () => this.startFromMenu();
    rail.append(play);
    for (const [id, ic, label] of items) {
      const b = el('button', { class: 'rail-item st' + (id === page ? ' on' : ''), html: `${icon(ic, 22)}<span>${label}</span>` });
      b.onclick = () => this.showMenu(id);
      rail.append(b);
    }
    rail.append(el('div', { class: 'spacer' }), el('div', { class: 'ver' }, 'v1.0 · Material 3 Expressive'));
    this.menu.append(rail);
    const pg = el('section', { class: 'menu-page' });
    this.menu.append(pg);
    ({ home: () => this.pageHome(pg), editor: () => this.pageEditor(pg), lexikon: () => this.pageLexikon(pg), options: () => this.pageOptions(pg) })[page]();
    this.game.menuShowcase(page === 'editor' ? this.editIdx : -1);
  }

  hideMenu() { this.menu.classList.add('hidden'); this.menu.innerHTML = ''; }

  pageHome(pg) {
    pg.append(el('div', { class: 'hero', html: `<div class="deco">${shapeSvg('cookie12', 150, 'rgba(255,184,241,.85)')}</div><div class="deco2">${shapeSvg('flower', 120, 'rgba(255,255,255,.6)')}</div>
      <div class="display-l" style="position:relative">Fluff<span>spheres</span></div>
      <p style="position:relative">Flauschige Kugeln, explosive Karten und magische Schmetterlinge. Wer bleibt am längsten knuffig?</p>` }));
    pg.append(this.sec('Spielmodus', this.btnGroup([
      { value: 'ai', label: 'Gegen KI', icon: 'sparkle' }, { value: 'local', label: 'Pass & Play', icon: 'cards' }, { value: 'chaos', label: 'Chaos', icon: 'dice' },
    ], Setup.mode, (v) => {
      Setup.mode = v;
      if (v === 'local') Setup.slots = Setup.slots.map((s) => (s === 'off' ? 'off' : 'human'));
      else Setup.slots = Setup.slots.map((s, i) => (s === 'off' ? 'off' : i === 0 ? 'human' : 'ai'));
      saveSetup(); renderSlots();
    }, 'wide')));
    const modeInfo = el('div', { class: 'body-m', style: { marginTop: '8px' } });
    const slotsWrap = el('div', { class: 'player-slots' });
    const renderSlots = () => {
      modeInfo.textContent = { ai: 'Tritt gegen schlaue Bots an, die Wind, Flugbahn und Karten berechnen.', local: 'Gebt das Gerät reihum weiter – die Kartenhand wird zwischen den Zügen verdeckt.', chaos: 'Doppelt so viele Schmetterlinge und ständige Kettenreaktionen. Viel Glück!' }[Setup.mode];
      slotsWrap.innerHTML = '';
      Setup.slots.forEach((t, i) => {
        const p = Profiles[i];
        const s = el('button', { class: 'slot st' + (t === 'off' ? ' off' : ''), html: `<div class="av">${avatar(p, 48, SHAPE_KEYS[(i * 3 + 2) % SHAPE_KEYS.length])}</div><div style="text-align:left"><div class="nm">${p.name}</div><div class="tp">${t === 'human' ? '🙋 Mensch' : t === 'ai' ? '🤖 KI-Bot' : '— nicht dabei'}</div></div>` });
        s.onclick = () => {
          const order = ['human', 'ai', 'off'];
          let nt = order[(order.indexOf(t) + 1) % 3];
          if (nt === 'off' && Setup.slots.filter((x) => x !== 'off').length <= 2) nt = 'human';
          Setup.slots[i] = nt; saveSetup(); renderSlots();
        };
        slotsWrap.append(s);
      });
    };
    pg.append(modeInfo);
    pg.append(this.sec('Mitspielende (antippen zum Wechseln)', slotsWrap));
    renderSlots();
    pg.append(this.sec('KI-Stärke', this.btnGroup([{ value: 'easy', label: 'Kuschelig' }, { value: 'normal', label: 'Normal' }, { value: 'hard', label: 'Gnadenlos' }], Settings.aiLevel, (v) => { Settings.aiLevel = v; saveSettings(); }, 'wide')));
    pg.append(this.sec('Fluffspheres pro Team', this.btnGroup([1, 2, 3].map((n) => ({ value: n, label: String(n) })), Settings.fluffsPerTeam, (v) => { Settings.fluffsPerTeam = v; saveSettings(); }, 'wide')));
    const start = el('button', { class: 'btn xl tertiary', html: `${icon('play', 28, true)}<span>Los geht's!</span>` });
    start.onclick = () => this.startFromMenu();
    pg.append(el('div', { class: 'start-row' }, start));
  }

  startFromMenu() {
    const slots = Setup.slots.map((t, i) => ({ type: t, profile: Profiles[i], idx: i })).filter((s) => s.type !== 'off');
    if (slots.length < 2) { this.toast('Mindestens zwei Mitspielende nötig!', 'error'); return; }
    this.hideMenu();
    this.game.startMatch({ slots, mode: Setup.mode });
  }

  pageEditor(pg) {
    const p = Profiles[this.editIdx];
    const changed = () => { saveProfiles(); Bus.emit('profile', this.editIdx); };
    pg.append(el('h2', { class: 'headline' }, 'Charakter-Editor'));
    pg.append(el('div', { class: 'body-m' }, 'Gestalte deinen Fluffsphere – Fell, Augen und Bauch-Abzeichen.'));
    pg.append(this.sec('Fluffsphere', this.btnGroup(Profiles.map((q, i) => ({ value: i, label: q.name })), this.editIdx, (v) => { this.editIdx = v; this.showMenu('editor'); }, 'wide')));
    const name = el('input', { value: p.name, maxlength: 12 });
    name.oninput = () => { p.name = name.value.trim() || 'Fluffi'; saveProfiles(); };
    pg.append(el('div', { class: 'sec' }, el('div', { class: 'textfield' }, el('label', {}, 'Name'), name)));
    const sw = (list, key) => {
      const w = el('div', { class: 'swatches' });
      for (const c of list) {
        const b = el('button', { class: 'sw' + (p[key] === c.hex ? ' on' : ''), style: { background: c.hex }, title: c.name, html: p[key] === c.hex ? icon('check', 20) : '' });
        b.onclick = () => { p[key] = c.hex; changed(); $$('.sw', w).forEach((x) => { x.classList.remove('on'); x.innerHTML = ''; }); b.classList.add('on'); b.innerHTML = icon('check', 20); };
        w.append(b);
      }
      return w;
    };
    pg.append(this.sec('Fellfarbe', sw(FUR_COLORS, 'fur')));
    pg.append(this.sec('Felllänge', this.slider(0, 1, p.furLen, (v) => { p.furLen = v; changed(); }, (v) => (v < 0.33 ? 'Kurz' : v < 0.66 ? 'Flauschig' : 'Mega-Fluff') + ` · ${Math.round(v * 100)}%`)));
    pg.append(this.sec('Augenfarbe', sw(EYE_COLORS, 'eye')));
    const bg = el('div', { class: 'badges' });
    BADGES.forEach((b, i) => {
      const sh = SHAPE_KEYS[(i + 1) % SHAPE_KEYS.length];
      const x = el('button', { class: 'bd' + (p.badge === b.id ? ' on' : ''), title: b.name, html: `${shapeSvg(sh, 64, 'var(--md-secondary-container)')}<img src="${badgeImg(b.id)}" alt="${b.name}">` });
      x.onclick = () => { p.badge = b.id; changed(); $$('.bd', bg).forEach((y) => y.classList.remove('on')); x.classList.add('on'); };
      bg.append(x);
    });
    pg.append(this.sec('Bauch-Abzeichen', bg));
    const rnd = el('button', { class: 'btn tonal', html: `${icon('dice', 20)}<span>Zufall</span>` });
    rnd.onclick = () => { Object.assign(p, { fur: pick(FUR_COLORS).hex, eye: pick(EYE_COLORS).hex, badge: pick(BADGES).id, furLen: Math.random() }); changed(); this.showMenu('editor'); };
    const done = el('button', { class: 'btn filled', html: `${icon('check', 20)}<span>Fertig</span>` });
    done.onclick = () => this.showMenu('home');
    pg.append(el('div', { class: 'start-row' }, rnd, done));
  }

  lexEntries(tab) {
    if (tab === 'cards') return Object.entries(CARD_DEFS).map(([id, c]) => ({ art: c.emoji, shape: c.shape, tone: c.tone, t: c.name, d: c.desc }));
    if (tab === 'weapons') return WEAPONS.map((w, i) => ({ art: w.emoji, shape: SHAPE_KEYS[(i + 4) % SHAPE_KEYS.length], tone: 'primary', t: `${w.name} ${w.ammo === Infinity ? '· ∞' : '· ×' + w.ammo}`, d: w.desc + (w.damage ? ` (Schaden ${w.damage})` : '') }));
    if (tab === 'butterflies') return BUTTERFLY_EVENTS.map((e, i) => ({ art: e.emoji, shape: SHAPE_KEYS[(i + 2) % SHAPE_KEYS.length], tone: 'tertiary', t: e.name, d: e.desc }));
    return [
      { art: '👆', shape: 'cookie9', tone: 'primary', t: 'Zielen', d: 'Ziehe auf dem Spielfeld vom Fluffsphere weg: Richtung = Winkel, Länge = Kraft. Am PC folgt das Ziel der Maus beim Gedrückthalten.' },
      { art: '💥', shape: 'burst', tone: 'tertiary', t: 'Feuern', d: 'Großer rosa Button unten rechts – oder Leertaste/Enter.' },
      { art: '🏃', shape: 'puffy', tone: 'secondary', t: 'Bewegen & Springen', d: 'Pfeil-Buttons unten links, A/D bzw. ←/→ zum Laufen, W/↑ springen, S/↓ Rückwärtssalto. Ausdauer ist pro Zug begrenzt.' },
      { art: '🎥', shape: 'flower', tone: 'primary', t: 'Kamera', d: 'Zwei Finger ziehen/zoomen oder rechte Maustaste & Mausrad. Bei Schüssen zoomt die Kamera automatisch mit.' },
      { art: '🃏', shape: 'cookie4', tone: 'mint', t: 'Karten', d: 'Karte antippen, dann „Ausspielen“. Am Zugende ziehst du automatisch eine Karte – Vorsicht vor Exploding Fluff!' },
      { art: '🦋', shape: 'clover', tone: 'tertiary', t: 'Schmetterlinge', d: 'Berühre sie mit deinem Fluffsphere oder triff sie mit Geschossen. Nahe Schmetterlinge lösen Kettenreaktionen aus.' },
      { art: '⌨️', shape: 'sunny', tone: 'secondary', t: 'Tastatur', d: '1–6 Waffe wählen · Leertaste feuern · Tab Kamera auf aktiven Fluff · Esc Pause.' },
    ];
  }

  lexikonContent(tab, onTab) {
    const wrap = el('div');
    wrap.append(this.btnGroup([{ value: 'cards', label: 'Karten' }, { value: 'weapons', label: 'Waffen' }, { value: 'butterflies', label: 'Schmetterlinge' }, { value: 'help', label: 'Steuerung' }], tab, onTab, 'wide'));
    const list = el('div', { class: 'lex-list' });
    this.lexEntries(tab).forEach((e, i) => {
      const it = el('div', { class: 'lex-item', style: { animationDelay: i * 0.035 + 's' }, html: `<div class="art">${shapeSvg(e.shape, 64, `var(--md-${e.tone}-container)`)}<span>${e.art}</span></div><div><div class="t">${e.t}</div><div class="d">${e.d}</div></div>` });
      list.append(it);
    });
    wrap.append(list);
    return wrap;
  }

  pageLexikon(pg) {
    pg.append(el('h2', { class: 'headline' }, 'Lexikon'));
    pg.append(el('div', { class: 'body-m', style: { marginBottom: '14px' } }, 'Alles über Karten, Waffen und magische Schmetterlinge.'));
    pg.append(this.lexikonContent(this.lexTab, (t) => { this.lexTab = t; this.showMenu('lexikon'); }));
  }

  optionsContent() {
    const w = el('div');
    w.append(this.sec('Grafikqualität', this.btnGroup([{ value: 'low', label: 'Sparsam' }, { value: 'medium', label: 'Mittel' }, { value: 'high', label: 'Ultra-Fluff' }], Settings.quality, (v) => { Settings.quality = v; saveSettings(); this.toast('Grafik wird beim nächsten Start übernommen ✨'); }, 'wide')));
    w.append(this.sec('Rundenzeit', this.btnGroup([30, 45, 60, 90].map((n) => ({ value: n, label: n + ' s' })), Settings.turnTime, (v) => { Settings.turnTime = v; saveSettings(); }, 'wide')));
    w.append(this.sec('Lautstärke', this.slider(0, 1, Settings.volume, (v) => { Settings.volume = v; saveSettings(); Sfx.applySettings(); })));
    w.append(this.switchRow('Musik', Settings.music, (v) => { Settings.music = v; saveSettings(); Sfx.applySettings(); }));
    w.append(this.switchRow('Soundeffekte', Settings.sfx, (v) => { Settings.sfx = v; saveSettings(); Sfx.applySettings(); }));
    w.append(this.switchRow('Kamera-Wackeln', Settings.shake, (v) => { Settings.shake = v; saveSettings(); }));
    return w;
  }

  pageOptions(pg) {
    pg.append(el('h2', { class: 'headline' }, 'Optionen'));
    pg.append(this.optionsContent());
    const reset = el('button', { class: 'btn outlined', html: `${icon('restart', 18)}<span>Charaktere zurücksetzen</span>` });
    reset.onclick = () => { DEFAULT_PROFILES.forEach((d, i) => Object.assign(Profiles[i], d)); saveProfiles(); this.toast('Alle Fluffspheres sind wieder wie neu 💖'); Bus.emit('profile', -1); };
    pg.append(el('div', { class: 'start-row' }, reset));
  }

  // ── dialogs ──
  dialog({ emoji, shape = 'cookie12', tone = 'primary', title, text, content, actions = [{ label: 'OK', kind: 'filled', value: true }], center = false, dismiss = false }) {
    return new Promise((resolve) => {
      const scrim = el('div', { id: 'scrim' });
      const d = el('div', { class: 'dialog' });
      if (emoji) d.append(el('div', { class: 'hicon', html: `${shapeSvg(shape, 72, `var(--md-${tone}-container)`)}<span>${emoji}</span>` }));
      if (title) d.append(el('h3', {}, title));
      if (text) d.append(el('p', { html: text }));
      if (content) d.append(content);
      const acts = el('div', { class: 'acts' + (center ? ' center' : '') });
      const close = (v) => { scrim.remove(); resolve(v); };
      for (const a of actions) { const b = el('button', { class: 'btn ' + (a.kind || 'text'), html: (a.icon ? icon(a.icon, 18) : '') + `<span>${a.label}</span>` }); b.onclick = () => close(a.value); acts.append(b); }
      if (actions.length) d.append(acts);
      scrim.append(d);
      if (dismiss) scrim.addEventListener('pointerdown', (e) => { if (e.target === scrim) close(null); });
      document.body.append(scrim);
      d._close = close;
      this.activeDialog = d;
    });
  }

  closeDialog(v) { if (this.activeDialog && this.activeDialog.isConnected) this.activeDialog._close(v); }

  toast(text, kind = '', emoji = '') {
    const s = el('div', { class: 'snack ' + kind, html: (emoji ? `<span class="em">${emoji}</span>` : '') + `<span>${text}</span>` });
    const box = $('#snacks');
    box.append(s);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => { s.classList.add('out'); setTimeout(() => s.remove(), 320); }, 2800);
  }

  banner(text, sub = '', tone = '') {
    const b = $('#banner');
    b.innerHTML = '';
    b.append(el('div', { class: 'b ' + tone, html: text + (sub ? `<small>${sub}</small>` : '') }));
  }
}
