// Profil vitrini (unvan, çerçeve, favori küpler), savaş tekrarları ve paylaşım.
(function () {
  const { $, h, esc, cubeById, D } = G;
  const R = window.Render, Snd = window.Sound;

  // ---------- Paylaş ----------
  G.SHARE_URL = 'https://rubikacademy.fun/kup-arena';
  G.share = async function (text, title = 'Küp Arena') {
    const full = `${text}\n${G.SHARE_URL}`;
    try {
      const P = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Share;
      if (P && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) { await P.share({ title, text, url: G.SHARE_URL, dialogTitle: 'Paylaş' }); return; }
      if (navigator.share) { await navigator.share({ title, text, url: G.SHARE_URL }); return; }
    } catch (e) { if (e && /cancel|abort/i.test(String(e.message || e.name))) return; }
    try { await navigator.clipboard.writeText(full); G.toast('Panoya kopyalandı, istediğin yere yapıştır'); }
    catch (e) { G.toast('Paylaşım bu cihazda açılamadı'); }
  };

  // ---------- Unvanlar ----------
  const TITLES = [
    { id: 'caylak', name: 'Çaylak', how: 'Başlangıç unvanı', ok: () => true },
    { id: 'taktik', name: 'Taktisyen', how: '25 savaş kazan', ok: (S) => S.stats.wins >= 25 },
    { id: 'donen', name: 'Döndürme Ustası', how: 'Savaşta 30 kez sıra döndür', ok: (S) => (S.stats.rotates || 0) >= 30 },
    { id: 'kombo', name: 'Kombo Kralı', how: '5 mükemmel vuruş kombosu yap', ok: (S) => (S.stats.maxCombo || 0) >= 5 },
    { id: 'kasaba', name: 'Kasaba Kahramanı', how: '1. dünyayı bitir', ok: (S) => S.adv.bosses.includes('w1') },
    { id: 'kasif', name: 'Kâşif', how: '3 dünyayı bitir', ok: (S) => S.adv.bosses.length >= 3 },
    { id: 'kule', name: 'Kule Fatihi', how: 'Kulede 10. kata çık', ok: (S) => (S.stats.towerBest || 0) >= 10 },
    { id: 'koleksiyon', name: 'Koleksiyoncu', how: '15 farklı küp topla', ok: (S) => Object.keys(S.inv).length >= 15 },
    { id: 'parlak', name: 'Parlak Avcısı', how: '1 parlak küp bul', ok: (S) => Object.keys(S.holo || {}).length >= 1 },
    { id: 'parlak5', name: 'Hologram Ustası', how: '5 parlak küp bul', ok: (S) => Object.keys(S.holo || {}).length >= 5 },
    { id: 'altin', name: 'Altın Lig', how: 'Arenada Altın rütbeye çık', ok: (S) => (S.bestTr || S.trophies) >= 700 },
    { id: 'elmas', name: 'Elmas Yürek', how: 'Arenada Elmas rütbeye çık', ok: (S) => (S.bestTr || S.trophies) >= 1200 },
    { id: 'efsane', name: 'Efsane', how: 'Arenada Efsane rütbeye çık', ok: (S) => (S.bestTr || S.trophies) >= 3000 },
    { id: 'kulup', name: 'Takım Oyuncusu', how: 'Kulübünde 5 küp bağışla', ok: (S) => (S.stats.donated || 0) >= 5 },
    { id: 'tuccar', name: 'Tüccar', how: '3 takas tamamla', ok: (S) => (S.stats.trades || 0) >= 3 },
  ];
  G.TITLES = TITLES;
  G.titleName = (id) => (TITLES.find(t => t.id === id) || TITLES[0]).name;
  G.myTitle = () => { const S = G.S, t = TITLES.find(x => x.id === (S.prof && S.prof.title)); return t && t.ok(S) ? t.name : 'Çaylak'; };
  // Çerçeve: en yüksek rütbe ailesinin rengi
  G.frameColor = () => {
    const best = G.S.bestTr || G.S.trophies || 0;
    return best >= 3000 ? '#ff6a00' : best >= 2500 ? '#d01f5c' : best >= 2000 ? '#7b3fe0' : best >= 1200 ? '#22a6d6' : best >= 700 ? '#d39400' : best >= 300 ? '#8a98b3' : '#a8602c';
  };
  G.toggleFav = function (id) {
    const P = G.S.prof = G.S.prof || { fav: [], title: 'caylak' };
    const i = P.fav.indexOf(id);
    if (i >= 0) P.fav.splice(i, 1);
    else { if (P.fav.length >= 3) P.fav.shift(); P.fav.push(id); G.toast('Profil vitrinine kondu'); }
    G.save();
  };

  // Profil penceresinin üstündeki kart
  G.profileCardHTML = function () {
    const S = G.S, P = S.prof || { fav: [] };
    const favs = (P.fav || []).filter(id => S.inv[id]);
    const slots = [0, 1, 2].map(i => {
      const id = favs[i];
      return id ? `<button class="pf-fav${G.isHolo(id) ? ' holo' : ''}" data-fav="${id}"><canvas></canvas><small>${esc(cubeById(id).model)}</small></button>`
        : '<button class="pf-fav empty" data-fav=""><span>+</span><small>Küp seç</small></button>';
    }).join('');
    const holoN = Object.keys(S.holo || {}).length;
    return `<div class="pf-card" style="--fc:${G.frameColor()}">
      <div class="pf-top"><span class="pf-lv">${S.level}</span><div class="pf-id"><b>${esc(S.name)}</b><button class="pf-title" id="pf-title">${esc(G.myTitle())} ▾</button></div>
        <div class="pf-rank">${G.rankBadge ? G.rankBadge(S.bestTr || S.trophies, 'sm') : ''}<small>${S.trophies} kupa</small></div></div>
      <div class="pf-favs">${slots}</div>
      <div class="pf-mini"><span>✨ ${holoN} parlak</span><span>${G.statValue('collection')}/${G.baseCubeCount()} küp</span><span>${S.stats.wins} galibiyet</span></div>
    </div>`;
  };
  G.bindProfileCard = function (body, reopen) {
    body.querySelectorAll('.pf-fav').forEach(b => {
      const id = b.dataset.fav;
      if (id) requestAnimationFrame(() => R.drawPuzzle(b.querySelector('canvas'), cubeById(id)));
      b.onclick = () => pickFav(reopen);
    });
    const t = body.querySelector('#pf-title');
    if (t) t.onclick = () => pickTitle(reopen);
  };
  function pickTitle(reopen) {
    const S = G.S;
    const body = G.modal('Unvan seç', `<div class="title-list">${TITLES.map(t => {
      const ok = t.ok(S);
      return `<button class="title-opt${ok ? '' : ' locked'}${S.prof.title === t.id ? ' on' : ''}" data-t="${t.id}" ${ok ? '' : 'disabled'}><b>${esc(t.name)}</b><small>${ok ? 'Açık' : esc(t.how)}</small></button>`;
    }).join('')}</div>`, [{ label: 'Geri', onClick: reopen }], { replace: true });
    if (!body) return;
    body.querySelectorAll('.title-opt:not(.locked)').forEach(b => (b.onclick = () => { S.prof.title = b.dataset.t; G.save(); Snd.click(); reopen(); }));
  }
  function pickFav(reopen) {
    const S = G.S;
    const owned = D.CUBES.filter(c => S.inv[c.id]).sort((a, b) => D.RARITIES[b.rarity].order - D.RARITIES[a.rarity].order);
    const body = G.modal('Vitrin küpleri (en fazla 3)', `<div class="draft-grid">${owned.map(c => `<button class="draft${S.prof.fav.includes(c.id) ? ' on' : ''}${G.isHolo(c.id) ? ' holo' : ''}" data-id="${c.id}" style="--rc:${D.RARITIES[c.rarity].color}"><canvas></canvas><span>${esc(c.model)}</span></button>`).join('')}</div>`,
      [{ label: 'Tamam', cls: 'btn-yellow', onClick: reopen }], { replace: true, wide: true });
    if (!body) return;
    body.querySelectorAll('.draft').forEach(b => {
      requestAnimationFrame(() => R.drawPuzzle(b.querySelector('canvas'), cubeById(b.dataset.id)));
      b.onclick = () => { G.toggleFav(b.dataset.id); body.querySelectorAll('.draft').forEach(x => x.classList.toggle('on', S.prof.fav.includes(x.dataset.id))); };
    });
  }

  // ---------- Savaş tekrarları ----------
  const RKEY = 'kup-arena-replays';
  const loadR = () => { try { return JSON.parse(localStorage.getItem(RKEY)) || []; } catch (e) { return []; } };
  G.saveReplay = function (rp) {
    try { const list = loadR(); list.unshift(rp); localStorage.setItem(RKEY, JSON.stringify(list.slice(0, 5))); } catch (e) {}
  };
  G.replays = loadR;
  G.replayListHTML = function () {
    const list = loadR();
    if (!list.length) return '<p class="note">Henüz kayıtlı savaş yok. Son 5 savaşın burada tutulur.</p>';
    return `<div class="rp-list">${list.map((r, i) => `<div class="rp-row"><span class="rp-res ${r.won ? 'w' : 'l'}">${r.won ? 'G' : 'M'}</span>
      <div><b>${esc(r.nameB)}</b><small>${esc(r.title)} · ${r.rounds} tur · ${new Date(r.ts).toLocaleDateString('tr-TR')}</small></div>
      <button class="btn btn-small" data-rp="${i}">İzle</button><button class="btn btn-small btn-blue" data-rs="${i}">Paylaş</button></div>`).join('')}</div>`;
  };
  G.bindReplayList = function (body) {
    body.querySelectorAll('[data-rp]').forEach(b => (b.onclick = () => G.watchReplay(+b.dataset.rp)));
    body.querySelectorAll('[data-rs]').forEach(b => (b.onclick = () => shareReplay(loadR()[+b.dataset.rs])));
  };
  function shareReplay(r) {
    if (!r) return;
    const mine = r.units.filter(u => u.s === 'A').map(u => cubeById(u.id).model).join(', ');
    G.share(r.won ? `Küp Arena'da ${r.nameB} rakibimi ${r.rounds} turda yendim! 🏆 Takımım: ${mine}. Sen de dene!`
      : `Küp Arena'da ${r.nameB} ile ${r.rounds} tur kapıştım, az kalsın yeniyordum! Takımım: ${mine}. Rövanş zamanı!`);
  }
  G.shareLastBattle = () => shareReplay(loadR()[0]);

  // İzleme ekranı
  let RP = null;
  G.watchReplay = function (i) {
    const r = loadR()[i];
    if (!r || !r.frames || !r.frames.length) return G.toast('Bu tekrar açılamadı');
    if (RP) stopRP();
    const ov = $('replay');
    ov.style.setProperty('--bbg', 'linear-gradient(170deg, #3b2fd8, #2a7bff 55%, #19c0a8)');
    $('rp-title').textContent = `${r.nameA} vs ${r.nameB}`;
    $('rp-board').innerHTML = G.boardHTML();
    const grid = $('rp-board').querySelector('.b-grid');
    (r.power || []).forEach(p => { const c = grid.querySelector(`.cell[data-r="${p.r}"][data-c="${p.c}"]`); c && c.classList.add('pw'); });
    r.units.forEach(u => {
      const def = cubeById(u.id);
      const t = h('div', `tok ${u.s}${u.b ? ' boss' : ''}`, G.tokenHTML({ lvl: u.l }));
      t.dataset.u = u.u;
      t.style.setProperty('--tc', D.TYPES[G.typeOf(def)].color);
      grid.appendChild(t);
      requestAnimationFrame(() => R.drawPuzzle(t.querySelector('canvas'), def));
    });
    grid.querySelectorAll('.b-arrow').forEach(a => { a.disabled = true; });
    RP = { r, i: 0, playing: true, t: 0 };
    ov.hidden = false;
    showFrame(0);
    play();
  };
  function showFrame(i) {
    const { r } = RP;
    const f = r.frames[i];
    RP.i = i;
    f.u.forEach(([u, row, col, hp]) => {
      const t = $('rp-board').querySelector(`.tok[data-u="${u}"]`);
      const def = r.units.find(x => x.u === u);
      if (!t || !def) return;
      t.style.setProperty('--r', row); t.style.setProperty('--c', col);
      t.classList.toggle('ko', hp <= 0);
      const prev = +t.dataset.hp || def.m;
      if (hp < prev && i > 0) { t.classList.remove('hit'); void t.offsetWidth; t.classList.add('hit'); }
      t.dataset.hp = hp;
      const bar = t.querySelector('.t-hp i'); const pct = Math.max(0, hp / def.m * 100);
      bar.style.width = pct + '%'; bar.classList.toggle('low', pct < 30);
    });
    $('rp-log').textContent = f.t;
    $('rp-step').textContent = `${i + 1}/${r.frames.length}`;
    $('rp-bar').style.width = ((i + 1) / r.frames.length * 100) + '%';
  }
  function play() {
    clearTimeout(RP.t);
    $('rp-play').textContent = RP.playing ? '⏸' : '▶';
    if (!RP.playing) return;
    RP.t = setTimeout(() => {
      if (!RP) return;
      if (RP.i < RP.r.frames.length - 1) { showFrame(RP.i + 1); play(); }
      else { RP.playing = false; play(); }
    }, 750);
  }
  function stopRP() { clearTimeout(RP.t); RP = null; $('replay').hidden = true; }
  $('rp-play').onclick = () => { if (!RP) return; if (!RP.playing && RP.i >= RP.r.frames.length - 1) showFrame(0); RP.playing = !RP.playing; play(); };
  $('rp-prev').onclick = () => { if (!RP) return; RP.playing = false; play(); showFrame(Math.max(0, RP.i - 1)); };
  $('rp-next').onclick = () => { if (!RP) return; RP.playing = false; play(); showFrame(Math.min(RP.r.frames.length - 1, RP.i + 1)); };
  $('rp-close').onclick = () => RP && stopRP();
  $('rp-share').onclick = () => RP && shareReplay(RP.r);

  // Savaş sonu pencerelerindeki "Tekrarı izle / Paylaş" düğmeleri
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-last-replay]');
    if (!b) return;
    if (b.dataset.lastReplay === 'share') G.shareLastBattle(); else G.watchReplay(0);
  });
  G.replayButtonsHTML = () => '<div class="rp-quick"><button class="link-btn" data-last-replay="watch">▶ Tekrarı izle</button><button class="link-btn" data-last-replay="share">↗ Paylaş</button></div>';
})();
