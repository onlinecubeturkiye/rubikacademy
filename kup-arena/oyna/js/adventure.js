// Macera haritası (6 dünya × 6 bölüm) ve Sonsuz Kule.
(function () {
  const { $, h, esc, cubeById, D } = G;
  const R = window.Render;

  // ---------- Bölümler ----------
  const COUNTS = [1, 2, 0, 3, 3];
  function stagesOf(w, wi) {
    return [0, 1, 2, 3, 4, 5].map(i => {
      const id = `${w.id}-${i + 1}`;
      const label = `${wi + 1}-${i + 1}`;
      if (i === 2) return { id, label, i, wi, w, type: 'solve' };
      if (i === 5) return { id, label, i, wi, w, type: 'boss' };
      return { id, label, i, wi, w, type: 'battle' };
    });
  }
  const ALL = D.WORLDS.flatMap((w, wi) => stagesOf(w, wi));
  G.allStages = ALL;
  const stars = (st) => G.S.adv.stars[st.id] || 0;
  const unlocked = (st) => { const k = ALL.indexOf(st); return k === 0 || stars(ALL[k - 1]) > 0; };

  function enemyTeam(st) {
    const { w, wi, i } = st;
    const lv = (x) => Math.min(G.MAX_LVL, x);
    if (st.type === 'boss') {
      return [
        { id: w.pool[(wi + 1) % w.pool.length], lvl: lv(w.base + 1), mult: w.mult },
        { id: w.pool[(wi + 3) % w.pool.length], lvl: lv(w.base + 1), mult: w.mult },
        { id: w.boss.id, lvl: lv(w.base + 2), mult: w.mult, boss: true, label: w.boss.name },
      ];
    }
    const team = [];
    for (let k = 0; k < COUNTS[i]; k++) team.push({ id: w.pool[(i * 3 + k * 2 + wi) % w.pool.length], lvl: lv(w.base + Math.floor(i / 2) + (i === 4 ? 1 : 0)), mult: w.mult });
    return team;
  }
  function rewardOf(st, first) {
    const wi = st.wi;
    if (st.type === 'boss') return first ? { coins: 300 + wi * 120, xp: 120 + wi * 30 } : { coins: 60 + wi * 20, xp: 30 };
    return first ? { coins: 40 + wi * 25, xp: 40 + wi * 10 } : { coins: 15 + wi * 8, xp: 15 };
  }
  const myTeam = () => G.S.team.map(id => ({ id, lvl: G.level(id) }));

  // ---------- Harita ----------
  const CHEST_SVG = '<svg class="chest-ico" viewBox="0 0 48 48" aria-hidden="true"><path d="M6 20h36v20a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3V20Z" fill="#ff8a1f" stroke="#1d1446" stroke-width="3"/><path d="M6 20c0-8 6-13 18-13s18 5 18 13H6Z" fill="#ffcc1f" stroke="#1d1446" stroke-width="3"/><rect x="20" y="17" width="8" height="10" rx="2" fill="#fff" stroke="#1d1446" stroke-width="3"/></svg>';
  const FLAME_SVG = '<svg class="flame" viewBox="0 0 48 48" aria-hidden="true"><path d="M24 4c3 8 12 12 12 24a12 12 0 0 1-24 0c0-6 3-9 5-12 1 4 3 6 5 6-2-6 0-12 2-18Z" fill="#ff8a1f" stroke="#1d1446" stroke-width="3" stroke-linejoin="round"/><path d="M24 26c2 3 6 5 6 10a6 6 0 0 1-12 0c0-3 2-5 3-6 1 2 2 2 3 2-1-2 0-4 0-6Z" fill="#ffcc1f"/></svg>';
  function renderTop() {
    const S = G.S, cr = G.crownState(), ready = G.crownReady();
    $('adv-top').innerHTML = `
      <button class="chest-card${ready ? ' ready' : ''}" id="chest-btn">${G.chestSVG('tac', 'chest-ico')}<div><b>Şampiyon Kutusu</b>
        <small>${cr.got ? 'Yarın yine!' : ready ? 'Açmaya hazır!' : `Taç: ${cr.n}/10`}</small><span class="keys">${Array.from({ length: 10 }, (_, i) => `<i class="${i < cr.n ? 'on' : ''}"></i>`).join('')}</span></div></button>
      <div class="streak-card">${FLAME_SVG}<div><b>Seri: ${S.streak}</b><small>${S.streak >= 1 ? `Sonraki galibiyet: +${Math.min(S.streak + 1, 10) * 5}` : 'Üst üste kazan, bonus al'}</small></div></div>`;
    $('chest-btn').onclick = () => { G.openCrownChest(); renderTop(); };
    if (G.renderPuzzleCard) G.renderPuzzleCard();
  }

  function render() {
    renderTop();
    const total = G.totalStars();
    $('adv-stars').textContent = `${total}/${ALL.length * 3}`;
    const wrap = $('worlds'); wrap.innerHTML = '';
    D.WORLDS.forEach((w, wi) => {
      const sts = ALL.filter(s => s.wi === wi);
      const open = unlocked(sts[0]);
      const got = sts.reduce((a, s) => a + stars(s), 0);
      const card = h('div', 'world' + (open ? '' : ' locked'));
      card.style.setProperty('--wbg', w.bg);
      card.style.setProperty('--wink', w.ink);
      const done = G.S.adv.bosses.includes(w.id);
      const rew = cubeById(w.reward);
      card.innerHTML = `
        <div class="world-head">
          <div><span class="world-no">Dünya ${wi + 1}</span><h3>${esc(w.name)}</h3><p>${esc(w.desc)}</p></div>
          <div class="world-side"><span class="world-stars">★ ${got}/18</span>
            <span class="world-reward" title="Boss ödülü"><canvas></canvas>${done ? 'Alındı' : 'Ödül'}</span></div>
        </div>
        ${open ? '' : `<div class="lock">Kilitli: önce ${esc(D.WORLDS[wi - 1].boss.name)}’ni yen</div>`}
        <div class="path"></div>`;
      const path = card.querySelector('.path');
      // Kıvrılan yol: düğmeler sağa sola dağılır, aralarında kalın bir patika çizilir.
      const PTS = [[24, 48], [72, 118], [34, 190], [74, 262], [28, 334], [60, 404]];
      let d = `M ${PTS[0][0]} ${PTS[0][1]}`;
      for (let i = 1; i < PTS.length; i++) { const [x0, y0] = PTS[i - 1], [x1, y1] = PTS[i], my = (y0 + y1) / 2; d += ` C ${x0} ${my}, ${x1} ${my}, ${x1} ${y1}`; }
      path.innerHTML = `<svg class="route" viewBox="0 0 100 440" preserveAspectRatio="none" aria-hidden="true">
        <path d="${d}" fill="none" stroke="#0b1033" stroke-width="22" stroke-linecap="round" vector-effect="non-scaling-stroke" opacity="0.85"/>
        <path d="${d}" fill="none" stroke="#fff3c4" stroke-width="14" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
        <path d="${d}" fill="none" stroke="#e8c770" stroke-width="3" stroke-dasharray="2 14" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>`;
      sts.forEach(st => {
        const s = stars(st), ok = unlocked(st);
        const node = h('button', `node ${st.type}${ok ? '' : ' off'}${s ? ' done' : ''}${ok && !s ? ' next' : ''}`);
        node.innerHTML = `<span class="nlabel">${st.type === 'boss' ? 'BOSS' : st.type === 'solve' ? '<svg viewBox="0 0 24 24"><path d="m12 2 9 5v10l-9 5-9-5V7l9-5Z"/></svg>' : st.i + 1}</span>
          <span class="nstars">${'★'.repeat(s)}${'☆'.repeat(3 - s)}</span>`;
        node.setAttribute('aria-label', `Bölüm ${st.label}${ok ? '' : ', kilitli'}`);
        node.disabled = !ok;
        node.dataset.stage = st.id;
        node.style.left = PTS[st.i][0] + '%';
        node.style.top = PTS[st.i][1] + 'px';
        node.onclick = () => preview(st);
        path.appendChild(node);
      });
      wrap.appendChild(card);
      requestAnimationFrame(() => R.drawPuzzle(card.querySelector('.world-reward canvas'), rew, { unknown: !G.S.inv[rew.id] && !done }));
    });
    renderTower();
    // en son açık bölüme kaydır
  }
  G.renderAdventure = render;
  G.nextStage = () => ALL.find(st => unlocked(st) && !stars(st)) || null;

  function teamCanvases(list) {
    return `<div class="mini-row">${list.map((x, i) => `<span class="mini"><canvas data-i="${i}"></canvas><small>Sv ${x.lvl}</small></span>`).join('') || '<span class="empty">Takım boş</span>'}</div>`;
  }
  function drawTeam(container, list) {
    container.querySelectorAll('canvas[data-i]').forEach(c => R.drawPuzzle(c, cubeById(list[+c.dataset.i].id)));
  }

  function preview(st) {
    const first = !stars(st);
    const rw = rewardOf(st, first);
    if (st.type === 'solve') {
      const c = st.w.solve;
      G.modal(`Bölüm ${st.label}: Küp Bulmacası`, `
        <p>Bu ${c.n}×${c.n} küp <b>${c.depth} hamle</b> ile karıştırıldı. Hamleleri geri çevirerek çöz!</p>
        <div class="star-rules"><span>★★★ ${c.depth} hamlede, ipucusuz</span><span>★★ İpucusuz</span><span>★ İpucuyla</span></div>
        <p class="reward-line">Ödül: +${rw.coins} jeton · +${rw.xp} XP</p>`,
        [{ label: 'Vazgeç' }, { label: 'Başla', cls: 'btn-yellow', onClick: () => startSolve(st) }]);
      return;
    }
    const enemy = enemyTeam(st);
    const mine = myTeam();
    const extra = st.type === 'boss' && !G.S.adv.bosses.includes(st.w.id) ? ` · <b>${esc(cubeById(st.w.reward).name)}</b> bulmacası` : '';
    const body = G.modal(`Bölüm ${st.label}${st.type === 'boss' ? ': ' + st.w.boss.name : ''}`, `
      <span class="label">Rakipler</span>${teamCanvases(enemy)}
      <span class="label">Takımın</span>${teamCanvases(mine)}
      <p class="note">İpucu: Küp, Piramit’i; Piramit, Özel’i; Özel bulmacalar Küp’ü yener.</p>
      <p class="reward-line">${first ? 'İlk geçiş ödülü' : 'Tekrar ödülü'}: +${rw.coins} jeton · +${rw.xp} XP${first ? extra : ''}</p>`,
      [{ label: 'Takımı düzenle', onClick: () => G.show('inv') }, { label: 'Savaş!', cls: 'btn-pink', disabled: !mine.length, onClick: () => startBattle(st) }]);
    if (body) { const rows = body.querySelectorAll('.mini-row'); drawTeam(rows[0], enemy); drawTeam(rows[1], mine); }
  }

  function startBattle(st) {
    if (!G.S.team.length) { G.toast('Önce takımına bulmaca ekle'); return; }
    G.battle({
      mode: 'stage', title: `${st.w.name} · ${st.label}`, bg: st.w.bg, nameB: st.type === 'boss' ? st.w.boss.name : st.w.name,
      teamA: myTeam(), teamB: enemyTeam(st),
      onEnd: (res) => {
        const bonus = G.afterBattle(res);
        if (!res.won) return lost(st, bonus);
        G.bump('wins');
        const s = res.koA === 0 ? 3 : res.koA === 1 ? 2 : 1;
        finish(st, s, bonus);
      },
    });
  }
  function startSolve(st) {
    const c = st.w.solve;
    G.startChallenge({
      id: st.id, n: c.n, depth: c.depth, pal: D.PALETTES[st.w.pal === 'pastel' ? 'classic' : st.w.pal],
      seed: st.id.split('').reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7),
      title: `Bölüm ${st.label}`, goal: `${c.depth} hamlede çöz: 3 yıldız`,
      onSolved: (r) => {
        G.bump('solves');
        const s = r.hints > 0 ? 1 : r.moves <= c.depth ? 3 : 2;
        finish(st, s);
      },
    });
  }

  function lost(st, bonus) {
    G.bump('losses');
    G.addCoins(10); G.addXP(10); G.save();
    G.modal('Kaybettin', `<p>Teselli: +10 jeton, +10 XP.</p>${bonus ? bonus.html : ''}${G.replayButtonsHTML()}
      <ul class="tips"><li>Paket açarak yeni bulmacalar bul.</li><li>Envanter’de bulmacalarını jetonla güçlendir.</li><li>Tür avantajını kullan: Küp &gt; Piramit &gt; Özel &gt; Küp.</li><li>Zorlanırsan önceki bölümleri tekrar oynayıp jeton topla.</li></ul>`,
      [{ label: 'Haritaya dön', onClick: render }, { label: 'Tekrar dene', cls: 'btn-pink', onClick: () => preview(st) }]);
  }

  function finish(st, s, bonus) {
    const S = G.S;
    const prev = stars(st), first = !prev;
    S.adv.stars[st.id] = Math.max(prev, s);
    const rw = rewardOf(st, first);
    G.bump('stages');
    G.addCoins(rw.coins); G.addXP(rw.xp);
    let extra = '';
    if (st.type === 'boss' && !S.adv.bosses.includes(st.w.id)) {
      S.adv.bosses.push(st.w.id);
      const got = G.addCube(st.w.reward);
      extra = `<div class="boss-reward"><canvas id="boss-rw"></canvas><p><b>${esc(cubeById(st.w.reward).name)}</b> ${got.isNew ? 'koleksiyonuna eklendi!' : `seviye ${got.lvl} oldu!`}</p></div>`;
      if (st.wi + 1 < D.WORLDS.length) extra += `<p class="good">Yeni dünya açıldı: <b>${esc(D.WORLDS[st.wi + 1].name)}</b></p>`;
      else extra += '<p class="good"><b>Tebrikler! Tüm dünyaları bitirdin.</b> Sonsuz Kule seni bekliyor.</p>';
      if (st.wi === 0) extra += '<p class="good">Sonsuz Kule açıldı!</p>';
    }
    G.save();
    const k = ALL.indexOf(st), next = ALL[k + 1];
    const body = G.modal(st.type === 'solve' ? 'Çözdün!' : 'Kazandın!', `
      <div class="stars-big">${[0, 1, 2].map(i => `<span class="${i < s ? 'on' : ''}" style="animation-delay:${i * 0.25}s">★</span>`).join('')}</div>
      <p>+${rw.coins} jeton · +${rw.xp} XP${s > prev && !first ? ' · Yeni yıldız rekoru!' : ''}</p>${bonus ? bonus.html : ''}${G.replayButtonsHTML()}${extra}`,
      [{ label: 'Haritaya dön', onClick: () => { G.show('adv'); render(); } },
       ...(next ? [{ label: `Sonraki: ${next.label}`, cls: 'btn-yellow', onClick: () => { G.show('adv'); render(); preview(next); } }] : [])]);
    for (let i = 0; i < s; i++) setTimeout(() => window.Sound.star(i), 250 + i * 250);
    window.FX.coins(6);
    if (body && body.querySelector('#boss-rw')) R.drawPuzzle(body.querySelector('#boss-rw'), cubeById(st.w.reward));
    render();
  }

  // ---------- Sonsuz Kule ----------
  let run = null;
  const towerOpen = () => G.unlocked('tower');
  function towerTeam(f) {
    const rng = G.seeded(f * 1013 + 7);
    const w = [Math.max(5, 60 - f * 2), 30, 8 + f, 2 + f * 0.6, f > 15 ? f * 0.3 : 0];
    const size = f < 3 ? 2 : 3;
    const team = [];
    for (let i = 0; i < size; i++) {
      let x = rng() * w.reduce((a, b) => a + b, 0), ri = 0;
      for (; ri < 5; ri++) { x -= w[ri]; if (x < 0) break; }
      const pool = D.CUBES.filter(c => c.rarity === D.RARITY_ORDER[Math.min(ri, 4)]);
      const boss = f % 10 === 0 && i === size - 1;
      team.push({ id: G.pickOne(pool, rng).id, lvl: Math.min(G.MAX_LVL, 1 + Math.floor(f / 3)), mult: 0.75 + f * 0.025, boss, label: boss ? `Kule Muhafızı ${f / 10}` : undefined });
    }
    return team;
  }
  function renderTower() {
    const el = $('tower');
    const best = G.S.stats.towerBest || 0, cp = G.S.towerCheckpoint || 0;
    el.classList.toggle('locked', !towerOpen());
    el.innerHTML = `
      <div class="tower-art" aria-hidden="true">${Array.from({ length: 6 }, (_, i) => `<i style="--i:${i}"></i>`).join('')}</div>
      <div class="tower-info">
        <span class="world-no">Bitmeyen mod</span>
        <h3>Sonsuz Kule</h3>
        <p>${towerOpen() ? `En yüksek kat: <b>${best}</b> · Başlangıç: <b>Kat ${cp + 1}</b>` : 'Oyuncak Kasabası’nın boss’unu yenince açılır.'}</p>
        <p class="note">Her 5 katta bir kayıt noktası. Kat başına jeton, her 10 katta bir muhafız.</p>
      </div>
      <button class="btn btn-pink" id="tower-go" ${towerOpen() ? '' : 'disabled'}>${run ? `Devam: Kat ${run.floor}` : 'Tırman'}</button>`;
    $('tower-go').onclick = () => climb();
  }
  function climb() {
    if (!G.S.team.length) { G.toast('Önce takımına bulmaca ekle'); return; }
    if (!run) run = { floor: (G.S.towerCheckpoint || 0) + 1 };
    const f = run.floor;
    const enemy = towerTeam(f);
    G.battle({
      mode: 'tower', title: `Sonsuz Kule · Kat ${f}`, nameB: `Kat ${f}`,
      bg: `linear-gradient(180deg, hsl(${(260 + f * 9) % 360} 60% 30%), #120a2a)`,
      teamA: myTeam(), teamB: enemy,
      onEnd: (res) => {
        const S = G.S;
        const bonus = G.afterBattle(res);
        if (!res.won) {
          G.bump('losses');
          const reached = f - 1;
          run = null; G.save(); renderTower();
          G.modal('Kule bitti', `<div class="big-num">Kat ${f}</div><p>Bu katta durdun. ${reached > 0 ? `${reached}. kata kadar çıktın.` : ''}</p><p class="note">Sonraki tırmanış Kat ${S.towerCheckpoint + 1}’den başlar.</p>${bonus.html}${G.replayButtonsHTML()}`,
            [{ label: 'Tamam', cls: 'btn-yellow' }]);
          return;
        }
        G.bump('wins'); G.bump('floors');
        S.stats.towerBest = Math.max(S.stats.towerBest || 0, f);
        let coins = (15 + f * 3) * (G.event().id === 'tower' ? 2 : 1), note = '';
        if (f % 5 === 0) { S.towerCheckpoint = Math.max(S.towerCheckpoint || 0, f); coins += 150; note = `<p class="good">Kayıt noktası: artık Kat ${f + 1}’den başlarsın. +150 bonus jeton</p>`; }
        G.addCoins(coins); G.addXP(15 + Math.floor(f / 2));
        run.floor = f + 1;
        G.save(); renderTower();
        window.FX.coins(5);
        G.modal(`Kat ${f} geçildi!`, `<p>+${coins} jeton</p>${bonus.html}${G.replayButtonsHTML()}${note}<p class="note">Sıradaki kat daha zor. Devam et ya da mola ver.</p>`,
          [{ label: 'Mola ver', onClick: () => { run = null; renderTower(); } }, { label: `Kat ${f + 1}`, cls: 'btn-pink', onClick: climb }]);
      },
    });
  }
})();
