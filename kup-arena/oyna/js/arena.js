// Arena (kupa maçları + lig), sıralama ve aynı telefonda 2 kişilik maç.
(function () {
  const { $, h, esc, cubeById, D } = G;
  const R = window.Render;

  // ---------- Rütbeler: 15 basamak. Aile tabanının altına düşülmez. ----------
  const FAM = {
    bronz:    { name: 'Bronz',    c1: '#f2b27a', c2: '#a8602c', floor: 0 },
    gumus:    { name: 'Gümüş',    c1: '#f3f6fb', c2: '#8a98b3', floor: 300 },
    altin:    { name: 'Altın',    c1: '#fff1a6', c2: '#d39400', floor: 700 },
    elmas:    { name: 'Elmas',    c1: '#c9f6ff', c2: '#22a6d6', floor: 1200 },
    usta:     { name: 'Usta',     c1: '#e3c9ff', c2: '#7b3fe0', floor: 2000 },
    sampiyon: { name: 'Şampiyon', c1: '#ffc0d4', c2: '#d01f5c', floor: 2500 },
    efsane:   { name: 'Efsane',   c1: '#fff3b0', c2: '#ff6a00', floor: 3000 },
  };
  const RANKS = [];
  [['bronz', [0, 100, 200]], ['gumus', [300, 400, 500]], ['altin', [700, 850, 1000]], ['elmas', [1200, 1400, 1600]]].forEach(([f, mins]) =>
    mins.forEach((min, i) => RANKS.push({ fam: f, div: ['III', 'II', 'I'][i], min, name: `${FAM[f].name} ${['III', 'II', 'I'][i]}` })));
  [['usta', 2000], ['sampiyon', 2500], ['efsane', 3000]].forEach(([f, min]) => RANKS.push({ fam: f, div: '', min, name: FAM[f].name }));
  const rankIdx = (t) => { let i = 0; RANKS.forEach((r, k) => { if (t >= r.min) i = k; }); return i; };
  const rankOf = (t) => RANKS[rankIdx(t)];
  const leagueOf = (t) => { const r = rankOf(t); return { name: r.name, color: FAM[r.fam].c2 }; };
  G.RANKS = RANKS; G.rankOf = rankOf; G.rankIdx = rankIdx;
  // Rütbe rozeti (kalkan)
  G.rankBadge = function (t, cls = '') {
    const r = rankOf(t), f = FAM[r.fam], id = 'rb' + Math.random().toString(36).slice(2, 7);
    const stars = r.div ? { III: 1, II: 2, I: 3 }[r.div] : 0;
    const crown = r.fam === 'efsane' || r.fam === 'sampiyon' || r.fam === 'usta';
    return `<svg class="rank-badge ${cls}" viewBox="0 0 64 72" aria-label="${r.name}">
      <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${f.c1}"/><stop offset="1" stop-color="${f.c2}"/></linearGradient></defs>
      ${crown ? '<path d="M14 14 22 2l10 9 10-9 8 12z" fill="#ffc928" stroke="#0b1033" stroke-width="3" stroke-linejoin="round"/>' : ''}
      <path d="M32 8 56 16v20c0 16-10 26-24 32C18 62 8 52 8 36V16z" fill="url(#${id})" stroke="#0b1033" stroke-width="4" stroke-linejoin="round"/>
      <path d="M32 15 50 21v15c0 11-7 19-18 24-11-5-18-13-18-24V21z" fill="#fff" opacity=".22"/>
      ${stars ? Array.from({ length: stars }, (_, i) => `<path transform="translate(${32 + (i - (stars - 1) / 2) * 13} 38)" d="M0-7 2 -2 7-2 3 1 5 6 0 3-5 6-3 1-7-2-2-2z" fill="#fff" stroke="#0b1033" stroke-width="1.8" stroke-linejoin="round"/>`).join('')
        : '<path d="M32 26l4 8 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1z" fill="#fff" stroke="#0b1033" stroke-width="2" stroke-linejoin="round"/>'}
    </svg>`;
  };
  // Rütbe ödülü: her rütbeye ilk kez çıkınca bir kez
  function rankReward(i) {
    const r = RANKS[i];
    const coins = 80 + i * 40;
    const pack = i >= 12 ? 'efsane' : i % 3 === 0 && i > 0 ? (i >= 9 ? 'efsane' : 'usta') : null;
    return { coins, pack, text: `+${coins} jeton${pack ? ` ve ${D.PACKS.find(p => p.id === pack).name}` : ''}`, r };
  }
  function promote(before, after) {
    const S = G.S;
    S.rankBest = S.rankBest || 0;
    const lines = [];
    for (let i = before + 1; i <= after; i++) {
      if (i <= S.rankBest) continue;
      const rw = rankReward(i);
      G.addCoins(rw.coins); if (rw.pack) S.packs[rw.pack]++;
      lines.push(rw.text);
    }
    S.rankBest = Math.max(S.rankBest, after);
    G.save();
    window.FX.confetti(140);
    window.Sound.reveal(4);
    G.modal('Rütbe atladın!', `<div class="rank-up">${G.rankBadge(S.trophies, 'big')}</div><div class="big-num">${esc(RANKS[after].name)}</div>
      ${lines.length ? `<p>Ödül: <b>${lines.join(', ')}</b></p>` : '<p>Rütbeni korumaya devam et!</p>'}`, [{ label: 'Harika!', cls: 'btn-yellow' }]);
  }
  // Sezon sonu: en yüksek rütbeye göre ödül, yüksek kupalar yarıya yaklaşır
  function checkRankSeason() {
    const S = G.S, id = G.seasonId();
    if (!S.rankSeason) { S.rankSeason = { id, peak: rankIdx(S.trophies) }; return; }
    if (S.rankSeason.id === id) { S.rankSeason.peak = Math.max(S.rankSeason.peak, rankIdx(S.trophies)); return; }
    const peak = S.rankSeason.peak, coins = 100 + peak * 60;
    const oldTr = S.trophies;
    if (S.trophies > 1000) S.trophies = 1000 + Math.floor((S.trophies - 1000) / 2);
    S.rankSeason = { id, peak: rankIdx(S.trophies) };
    G.addCoins(coins);
    if (peak >= 6) S.packs.usta++;
    G.save();
    G.modal('Yeni rütbe sezonu!', `<div class="rank-up">${G.rankBadge(RANKS[peak].min, 'big')}</div>
      <p>Geçen sezon en yüksek rütben: <b>${esc(RANKS[peak].name)}</b></p><p>Sezon ödülü: <b>+${coins} jeton${peak >= 6 ? ' ve Usta Paketi' : ''}</b></p>
      ${oldTr !== S.trophies ? `<p class="note">Kupaların ${oldTr} → ${S.trophies} oldu. Yeni sezonda tekrar tırman!</p>` : ''}`, null);
  }
  G.checkRankSeason = checkRankSeason;

  // ---------- Dönen arena modları (her 6 saatte değişir) ----------
  const MODES = [
    { id: 'klasik', name: 'Klasik', desc: 'Normal kurallar.', color: '#2e8cff', mod: {} },
    { id: 'enerji', name: 'Enerji Fırtınası', desc: 'Her turda +1 hamle puanı. Hareketli savaşlar!', color: '#c040ff', mod: { energy: 3 } },
    { id: 'kritik', name: 'Kritik Gecesi', desc: 'Kritik vuruş şansı %20 daha fazla.', color: '#ff4d5e', mod: { crit: 0.2 } },
    { id: 'dev', name: 'Dev Küpler', desc: 'Tüm küplerin canı 2 kat. Uzun savaşlar!', color: '#3bdc6e', mod: { hp: 2 } },
    { id: 'teke', name: 'Teke Tek', desc: 'Takımının ilk küpüyle tek başına savaş.', color: '#ff8a1f', mod: { solo: true } },
  ];
  const SLOT = 6 * 3600000;
  const modeNow = () => MODES[Math.floor(Date.now() / SLOT) % MODES.length];
  const modeLeft = () => { const ms = SLOT - (Date.now() % SLOT); const hh = Math.floor(ms / 3600000), mm = Math.ceil((ms % 3600000) / 60000); return hh ? `${hh} sa ${mm} dk` : `${mm} dk`; };
  G.arenaMode = modeNow;

  function dayDrift(i) { const day = G.dayIndex(); return Math.round(Math.sin(day * 1.7 + i * 2.3) * 35); }
  function botList() { return D.BOTS.map((b, i) => ({ name: b.name, tr: Math.max(0, b.tr + dayDrift(i)) })); }

  let opp = null;
  function makeOpponent() {
    const S = G.S;
    const bots = botList().sort((a, b) => Math.abs(a.tr - S.trophies) - Math.abs(b.tr - S.trophies)).slice(0, 6);
    const bot = G.pickOne(bots), t = bot.tr;
    const w = [Math.max(6, 60 - t / 40), 30, 8 + t / 120, 2 + t / 300, t > 1500 ? t / 1000 : 0];
    const size = Math.max(1, Math.min(3, S.team.length || 1));
    const team = [];
    for (let i = 0; i < size; i++) {
      let x = Math.random() * w.reduce((a, b) => a + b, 0), ri = 0;
      for (; ri < 5; ri++) { x -= w[ri]; if (x < 0) break; }
      const def = G.pickOne(D.CUBES.filter(c => c.rarity === D.RARITY_ORDER[Math.min(ri, 4)]));
      const lvl = Math.max(1, Math.min(G.MAX_LVL, 1 + Math.floor(t / 200) + ((Math.random() * 3) | 0) - 1));
      team.push({ id: def.id, lvl, mult: 0.9 });
    }
    return { name: bot.name, tr: bot.tr, team };
  }

  function miniRow(el, items) {
    el.innerHTML = '';
    if (!items.length) { el.innerHTML = '<span class="empty">Takım boş</span>'; return; }
    items.forEach(x => {
      const s = h('span', 'mini', `<canvas></canvas><small>Sv ${x.lvl}</small>`);
      el.appendChild(s);
      requestAnimationFrame(() => R.drawPuzzle(s.querySelector('canvas'), cubeById(x.id)));
    });
  }

  function render() {
    const S = G.S;
    const locked = !G.unlocked('arena');
    $('tab-arena').classList.toggle('is-locked', locked);
    $('arena-lock').hidden = !locked;
    if (locked) {
      const need = G.xpNeed(S.level), pct = S.level >= 3 ? 100 : Math.round(((S.level - 1) * 100 + S.xp / need * 100) / 2);
      $('arena-lock').innerHTML = `<div class="lock-ico">🔒</div><h3>Arena seviye 3’te açılır</h3><p>Önce Macera’da oyunu öğren. Savaş kazandıkça XP toplar, seviye atlarsın.</p><div class="bar"><i style="width:${pct}%"></i></div><small>Şu an seviye ${S.level}</small>`;
      const b = h('button', 'btn btn-yellow btn-big', 'Maceraya git'); b.onclick = () => G.show('adv'); $('arena-lock').appendChild(b);
      return;
    }
    $('pvp-btn').classList.toggle('locked', !G.unlocked('pvp'));
    checkRankSeason();
    const ri = rankIdx(S.trophies), r = RANKS[ri], nx = RANKS[ri + 1];
    const pct = nx ? Math.round((S.trophies - r.min) / (nx.min - r.min) * 100) : 100;
    $('league').innerHTML = `${G.rankBadge(S.trophies, 'mid')}
      <div class="rank-info"><span class="label">Rütben</span><div class="league-name" style="color:${FAM[r.fam].c1}">${esc(r.name)}</div>
      <div class="bar"><i style="width:${pct}%"></i></div>
      <div class="note">${nx ? `${esc(nx.name)} için ${nx.min - S.trophies} kupa` : 'En yüksek rütbe!'} · Sezon ${G.seasonDaysLeft()} gün</div></div>
      <div class="league-tr"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10v3h3v3a4 4 0 0 1-4 4h-.4A5 5 0 0 1 13 15.9V18h3v3H8v-3h3v-2.1A5 5 0 0 1 8.4 13H8a4 4 0 0 1-4-4V6h3V3Z" fill="#ffd23f"/></svg>${S.trophies}</div>`;
    const m = modeNow();
    $('arena-mode').style.setProperty('--ev', m.color);
    $('arena-mode').innerHTML = `<span class="ev-tag">MOD</span><div><b>${esc(m.name)}</b><small>${esc(m.desc)}${m.id !== 'klasik' ? ' · +%20 jeton' : ''}</small></div><span class="ev-time">${modeLeft()}</span>`;
    if (!opp) opp = makeOpponent();
    miniRow($('my-team'), S.team.map(id => ({ id, lvl: G.level(id) })));
    miniRow($('opp-team'), opp.team);
    $('opp-name').textContent = opp.name;
    $('opp-tr').innerHTML = `<span class="opp-bot">BİLGİSAYAR</span> ${opp.tr} kupa`;
    $('fight').disabled = !S.team.length;
    renderRoad();
  }
  G.renderArena = render;

  // ---------- Kupa Yolu: her 100 kupada bir ödül ----------
  const ROAD = Array.from({ length: 30 }, (_, i) => {
    const tr = (i + 1) * 100;
    if (tr % 1000 === 0) return { tr, text: 'Efsane Paketi', pack: 'efsane' };
    if (tr % 500 === 0) return { tr, text: 'Usta Paketi', pack: 'usta' };
    if (tr % 200 === 0) return { tr, text: 'Klasik Paket', pack: 'klasik' };
    return { tr, text: `${100 + i * 20} jeton`, coins: 100 + i * 20 };
  });
  const TR_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10v3h3v3a4 4 0 0 1-4 4h-.4A5 5 0 0 1 13 15.9V18h3v3H8v-3h3v-2.1A5 5 0 0 1 8.4 13H8a4 4 0 0 1-4-4V6h3V3Z" fill="#ffc928" stroke="#0b1033" stroke-width="1.5"/></svg>';
  function renderRoad() {
    const S = G.S;
    S.road = S.road || [];
    const best = Math.max(S.bestTr || 0, S.trophies);
    const wrap = $('road'); wrap.innerHTML = '';
    let focus = null;
    ROAD.forEach(r => {
      const reached = best >= r.tr, claimed = S.road.includes(r.tr);
      const el = h('div', `road-step${reached ? ' reached' : ''}${claimed ? ' claimed' : ''}${r.pack ? ' big' : ''}`,
        `<span class="road-tr">${TR_SVG}${r.tr}</span><small>${esc(r.text)}</small>`);
      const b = h('button', 'btn btn-small ' + (reached && !claimed ? 'btn-green' : ''), claimed ? 'Alındı' : reached ? 'Al' : `${r.tr - best} kupa`);
      b.disabled = !reached || claimed;
      b.onclick = () => {
        if (S.road.includes(r.tr)) return;
        S.road.push(r.tr);
        if (r.coins) { G.addCoins(r.coins); window.FX.coins(6, b); G.toast(`+${r.coins} jeton`); }
        if (r.pack) { S.packs[r.pack]++; window.FX.confetti(60); G.toast(`${r.text} Mağaza’da seni bekliyor!`); }
        G.save(); renderRoad();
      };
      el.appendChild(b);
      wrap.appendChild(el);
      if (!focus && (!claimed || !reached)) focus = el;
    });
    if (focus) requestAnimationFrame(() => { wrap.scrollLeft = focus.offsetLeft - 20; });
  }
  G.roadClaimable = () => { const S = G.S, best = Math.max(S.bestTr || 0, S.trophies); return ROAD.some(r => best >= r.tr && !(S.road || []).includes(r.tr)); };

  $('opp-new').onclick = () => { opp = makeOpponent(); render(); };
  $('fight').onclick = () => {
    if (!G.S.team.length) { G.toast('Önce Envanter’den takımına bulmaca ekle'); return; }
    const o = opp, m = modeNow();
    let teamA = G.S.team.map(id => ({ id, lvl: G.level(id) })), teamB = o.team;
    if (m.mod.solo) { teamA = teamA.slice(0, 1); teamB = teamB.slice(0, 1); }
    G.battle({
      mode: 'arena', mod: m.mod, bg: 'linear-gradient(170deg, #ff8a1f, #ff4f9a 55%, #7b4dff)', title: `${m.name} · ${rankOf(G.S.trophies).name}`, nameB: o.name,
      teamA, teamB,
      onEnd: (res) => {
        const S = G.S;
        const bonus = G.afterBattle(res);
        const coins = Math.round((res.won ? 40 + Math.round(o.tr / 40) : 10) * (m.id !== 'klasik' ? 1.2 : 1));
        const before = rankIdx(S.trophies);
        // Rütbe koruması: aile tabanının altına düşülmez
        const floor = FAM[RANKS[before].fam].floor;
        const tr = res.won ? 25 + ((Math.random() * 7) | 0) : -Math.min(15, Math.max(0, S.trophies - floor));
        S.trophies += tr;
        S.bestTr = Math.max(S.bestTr || 0, S.trophies);
        G.bump('arena'); G.bump(res.won ? 'wins' : 'losses');
        G.addCoins(coins); G.addXP(res.won ? 30 : 10);
        G.save();
        opp = null;
        if (res.won) window.FX.coins(6);
        const after = rankIdx(S.trophies);
        const up = after > before;
        if (G.S.rankSeason) G.S.rankSeason.peak = Math.max(G.S.rankSeason.peak, after);
        G.modal(res.won ? 'Kazandın!' : 'Kaybettin', `
          <div class="big-num">${tr >= 0 ? '+' : ''}${tr} kupa</div>
          <p>+${coins} jeton · +${res.won ? 30 : 10} XP</p>${bonus.html}${G.replayButtonsHTML()}
          ${!res.won && tr === 0 ? '<p class="note">Rütbe koruması: bu rütbe ailesinin altına düşmezsin.</p>' : ''}
          ${res.won ? '' : '<p class="note">Takımını güçlendir ya da tür avantajı olan bulmacalar seç.</p>'}`,
          [{ label: 'Tamam', cls: 'btn-yellow', onClick: render }]);
        if (up) promote(before, after);
        render();
      },
    });
  };

  // ---------- 2 kişilik maç (aynı telefon) ----------
  const PVP_LVL = 5;
  $('pvp-btn').onclick = () => { if (G.needUnlock('pvp')) return; draft(1, []); };
  function draft(player, p1) {
    const picked = [];
    const body = G.modal(`${player}. Oyuncu: 3 bulmaca seç`, `
      <p class="note">${player === 1 ? 'Telefonu 1. oyuncuya ver.' : 'Şimdi telefonu 2. oyuncuya ver. Seçimini rakibin görmesin!'} Tüm bulmacalar seviye ${PVP_LVL}.</p>
      <div class="draft-grid"></div>`,
      [{ label: 'Vazgeç' }, { label: 'Hazır', cls: 'btn-pink', keep: true, onClick: () => {
        if (picked.length !== 3) return G.toast('3 bulmaca seç');
        if (player === 1) draft(2, picked.slice());
        else { G.closeModal(); start(p1, picked); }
      } }], { replace: true, wide: true });
    if (!body) return;
    const grid = body.querySelector('.draft-grid');
    D.CUBES.forEach(def => {
      const b = h('button', 'draft', `<canvas></canvas><span>${esc(def.name)}</span>`);
      b.style.setProperty('--rc', D.RARITIES[def.rarity].color);
      b.onclick = () => {
        const i = picked.indexOf(def.id);
        if (i >= 0) picked.splice(i, 1); else if (picked.length < 3) picked.push(def.id); else return G.toast('En fazla 3 bulmaca');
        grid.querySelectorAll('.draft').forEach((x, k) => {
          const n = picked.indexOf(D.CUBES[k].id);
          x.classList.toggle('on', n >= 0);
          x.dataset.n = n >= 0 ? n + 1 : '';
        });
      };
      grid.appendChild(b);
      requestAnimationFrame(() => R.drawPuzzle(b.querySelector('canvas'), def));
    });
  }
  function start(a, b) {
    G.battle({
      mode: 'pvp', bg: 'linear-gradient(170deg, #19c0a8, #2a7bff)', title: '2 Kişilik Maç', nameA: '1. Oyuncu', nameB: '2. Oyuncu',
      teamA: a.map(id => ({ id, lvl: PVP_LVL })), teamB: b.map(id => ({ id, lvl: PVP_LVL })),
      onEnd: (res) => {
        G.bump('pvp'); G.save();
        G.modal(`${res.won ? '1.' : '2.'} Oyuncu kazandı!`, '<p>Güzel maçtı. Rövanş?</p>',
          [{ label: 'Kapat' }, { label: 'Rövanş', cls: 'btn-pink', onClick: () => start(a, b) }]);
      },
    });
  }
})();
