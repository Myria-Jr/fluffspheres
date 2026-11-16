// ───────────────────────── Boot ─────────────────────────
(function boot() {
  const blob = $('#loadBlob');
  const wave = new WavyBar($('#loadWave'), { height: 16, amp: 3.5, wl: 18 });
  const msgs = ['Fell wird gekämmt …', 'Kulleraugen werden poliert …', 'Schmetterlinge wachen auf …', 'Zuckerguss wird verteilt …'];
  let t = 0, k = 0, alive = true, prog = 0.1;
  const shapes = ['cookie9', 'flower', 'clover', 'sunny', 'cookie4', 'puffy'];
  const tick = () => {
    if (!alive) return;
    t += 0.016; prog = Math.min(0.95, prog + 0.008);
    blob.setAttribute('d', shapePath(shapes[Math.floor(t * 1.2) % shapes.length], 96, t));
    wave.set(prog); wave.update(0.016);
    if (Math.floor(t * 1.2) !== k) { k = Math.floor(t * 1.2); $('#loadMsg').textContent = msgs[k % msgs.length]; }
    requestAnimationFrame(tick);
  };
  tick();

  const start = () => {
    let game;
    try {
      game = new Game();
    } catch (e) {
      console.error(e);
      alive = false;
      $('#loading').innerHTML = `<div class="dialog"><div class="hicon">${shapeSvg('burst', 72, 'var(--md-error-container)')}<span>😿</span></div><h3>WebGL nicht verfügbar</h3><p>Dein Gerät oder Browser unterstützt kein WebGL. Bitte aktiviere Hardwarebeschleunigung oder nutze einen aktuellen Browser.</p></div>`;
      return;
    }
    window.FLUFF = game;
    game.ui.showMenu('home');
    wave.set(1);
    setTimeout(() => { alive = false; const L = $('#loading'); L.style.opacity = 0; setTimeout(() => L.remove(), 650); }, 450);

    // Android hardware back button (called from the WebView wrapper)
    window.onAndroidBack = () => {
      const scrim = $('#scrim');
      if (scrim) { game.ui.closeDialog(null); return true; }
      if (game.state === 'playing') { game.pause(); return true; }
      if (game.state === 'menu' && game.ui.page !== 'home') { game.ui.showMenu('home'); return true; }
      return false;
    };
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && game.state === 'playing') game.pause();
      if (Sfx.ctx) { if (document.hidden) Sfx.ctx.suspend(); else Sfx.ctx.resume(); }
    });
  };

  const fontsReady = document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]) : Promise.resolve();
  fontsReady.then(() => setTimeout(start, 60));
})();
