// Çöz sekmesi: serbest çözme ödülleri, günlük bulmaca ve macera bulmacaları.
(function () {
  const { $, h, esc, cubeById, D } = G;
  const R = window.Render, Sim = window.Sim;
  const REWARD = { 2: 30, 3: 80, 4: 150, 5: 250, 6: 400, 7: 600 };
  const FAST = { 2: 60e3, 3: 180e3, 4: 420e3, 5: 720e3, 6: 1200e3, 7: 1800e3 };
  G.solveId = 'c3';
  let loadedId = null, chal = null, confirmSwitch = false;

  const daily = () => { const d = G.dayIndex(); return { id: 'daily-' + d, n: 3, depth: 5 + (d % 3), seed: d * 2654435761 % 4294967296, day: d }; };

  function render() {
    const S = G.S;
    $('chal').hidden = !chal;
    $('daily').hidden = !!chal;
    $('solve-pick').hidden = !!chal;
    if (chal) {
      $('chal-title').textContent = chal.title;
      $('chal-goal').textContent = chal.goal;
      $('sim-reward').textContent = chal.rewardText || '';
      requestAnimationFrame(() => Sim.resize && Sim.resize());
      return;
    }
    const dl = daily(), done = S.dailyDone === dl.day;
    $('daily').innerHTML = `<div><span class="label">Günlük bulmaca</span><b>3×3 · ${dl.depth} hamlelik karışım</b><span class="note">${done ? 'Bugün tamamlandı. Yarın yenisi gelir.' : 'Ödül: 200 jeton + 50 XP'}</span></div>`;
    const db = h('button', 'btn btn-yellow btn-small', done ? 'Tekrar oyna' : 'Oyna');
    db.onclick = startDaily;
    $('daily').appendChild(db);

    const owned = D.CUBES.filter(c => S.inv[c.id] && c.type === 'cube');
    if (!owned.find(c => c.id === G.solveId)) G.solveId = owned.length ? owned[0].id : 'c3';
    const pick = $('solve-pick'); pick.innerHTML = '';
    owned.forEach(def => {
      const b = h('button', '', '<canvas></canvas>');
      b.setAttribute('aria-pressed', String(def.id === G.solveId));
      b.setAttribute('aria-label', def.name);
      b.title = def.name;
      b.onclick = () => {
        if (Sim.isBusy() && !confirmSwitch) { confirmSwitch = true; G.toast('Süre işliyor. Değiştirmek için tekrar dokun.'); setTimeout(() => (confirmSwitch = false), 2500); return; }
        confirmSwitch = false; G.solveId = def.id; render();
      };
      pick.appendChild(b);
      requestAnimationFrame(() => R.drawPuzzle(b.querySelector('canvas'), def));
    });
    const def = cubeById(G.solveId);
    if (loadedId !== G.solveId) { loadedId = G.solveId; Sim.load(def.n, D.PALETTES[def.pal], D.BRANDS[def.brand].name, G.tierOf(def).speed); }
    else requestAnimationFrame(() => Sim.resize && Sim.resize());
    $('sim-reward').textContent = `${D.BRANDS[def.brand].name} · ${G.tierOf(def).name} · +${REWARD[def.n]} jeton`;
  }
  G.renderSolve = render;

  G.startChallenge = function (cfg) {
    chal = cfg;
    G.show('solve');
    Sim.challenge({ id: cfg.id, n: cfg.n, depth: cfg.depth, pal: cfg.pal, seed: cfg.seed });
    render();
  };
  function exitChallenge() {
    chal = null; loadedId = null;
    render();
  }
  $('chal-exit').onclick = exitChallenge;
  G.inChallenge = () => !!chal;

  function startDaily() {
    const dl = daily();
    G.startChallenge({
      id: dl.id, n: dl.n, depth: dl.depth, seed: dl.seed, pal: D.PALETTES.classic,
      title: 'Günlük bulmaca', goal: `${dl.depth} hamlede karıştırıldı. Geri çevir!`,
      rewardText: G.S.dailyDone === dl.day ? 'Ödül alındı' : '+200 jeton',
      onSolved: (r) => {
        const S = G.S;
        G.bump('solves');
        if (S.dailyDone !== dl.day) {
          S.dailyDone = dl.day;
          G.addCoins(200); G.addXP(50);
          G.save();
          G.modal('Günlük bulmaca çözüldü!', `<div class="big-num">${Sim.fmt(r.ms)}</div><p>${r.moves} hamle${r.hints ? `, ${r.hints} ipucu` : ''}</p><p>+200 jeton · +50 XP</p>`, null);
        } else {
          G.save();
          G.modal('Yine çözdün!', `<div class="big-num">${Sim.fmt(r.ms)}</div><p>${r.moves} hamle</p>`, null);
        }
      },
    });
  }

  Sim.onSolved = (r) => {
    if (r.challenge && chal && chal.id === r.challenge) {
      const c = chal;
      exitChallenge();
      c.onSolved(r);
      return;
    }
    const S = G.S, n = r.n;
    const base = REWARD[n] || 50, fast = r.ms < FAST[n];
    const coins = base + (fast ? Math.round(base / 2) : 0);
    const prev = S.best[n], record = !prev || r.ms < prev;
    if (record) S.best[n] = r.ms;
    G.bump('solves');
    if (n >= 5) G.bump('bigSolve');
    G.addCoins(coins); G.addXP(20 + n * 10);
    G.save();
    G.modal('Çözüldü!', `
      <div class="big-num">${Sim.fmt(r.ms)}</div>
      <p class="note">${n}×${n} · ${r.moves} hamle${record ? ' · Yeni rekor!' : ` · Rekorun ${Sim.fmt(prev)}`}</p>
      <p>+${coins} jeton${fast ? ' (hız bonusu dahil)' : ''} · +${20 + n * 10} XP</p>`,
      [{ label: 'Kapat' }, { label: 'Yeniden karıştır', cls: 'btn-yellow', onClick: () => $('sim-scramble').click() }]);
  };
})();
