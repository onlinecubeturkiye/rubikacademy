// Mağaza, paket açma ve envanter.
(function () {
  const { $, h, esc, wait, cubeById, D } = G;
  const R = window.Render, Snd = window.Sound;
  const packById = (id) => D.PACKS.find(p => p.id === id);
  // Marka haftasında o markanın kutusu %30 indirimli
  const onSale = (p) => { const ev = G.event(); return ev.id === 'brand' && p.brand === ev.brand; };
  const priceOf = (p) => (onSale(p) ? Math.round(p.price * 0.7) : p.price);
  G.priceOf = priceOf;

  // ---------- Paket görseli ----------
  function zigzag(teeth, depth, bottom) {
    const pts = [];
    for (let i = 0; i <= teeth * 2; i++) {
      const x = (i / (teeth * 2)) * 100, y = i % 2 ? depth : 0;
      pts.push(bottom ? `${100 - x}% ${100 - y}%` : `${x}% ${y}%`);
    }
    return pts;
  }
  const CAP_CLIP = `polygon(${zigzag(14, 26, false).join(',')}, 100% 100%, 0% 100%)`;
  const MAIN_CLIP = `polygon(0% 0%, 100% 0%, ${zigzag(14, 3, true).join(',')})`;
  function makePack(pack, w) {
    const el = h('div', 'pack');
    if (w) el.style.setProperty('--w', w);
    el.style.setProperty('--cap', pack.cap);
    el.style.setProperty('--bg-pack', pack.bg);
    const cap = h('div', 'pack-cap'); cap.style.clipPath = CAP_CLIP;
    const main = h('div', 'pack-main'); main.style.clipPath = MAIN_CLIP;
    main.innerHTML = `<div class="pack-logo">Küp<span>Arena</span></div><canvas class="pack-art"></canvas><div class="pack-title">${esc(pack.name).replace(' ', '<br>')}</div><div class="pack-shade"></div><div class="pack-shine"></div>`;
    el.append(cap, main);
    requestAnimationFrame(() => R.drawPackArt(main.querySelector('canvas'), pack.art.map(cubeById)));
    return el;
  }
  G.makePack = makePack;

  // ---------- Mağaza ----------
  const fmtLeft = (ms) => { const hh = Math.floor(ms / 3600000), mm = Math.ceil((ms % 3600000) / 60000); return hh ? `${hh} sa ${mm} dk` : `${mm} dk`; };
  function dealOfDay() {
    const rng = G.seeded(G.dayIndex() * 104729);
    const pool = D.CUBES.filter(c => c.rarity === (rng() < 0.6 ? 'epic' : rng() < 0.8 ? 'rare' : 'legendary'));
    const def = G.pickOne(pool, rng);
    return { def, price: D.RARITIES[def.rarity].sell * 5 };
  }
  function render() {
    const S = G.S, now = Date.now();
    // Hediye ve bedava paket
    const giftLeft = S.lastGift + G.GIFT_MS - now, freeLeft = S.lastFree + G.FREE_MS - now;
    $('gift-text').textContent = giftLeft <= 0 ? '150 jeton seni bekliyor.' : `Sonraki: ${fmtLeft(giftLeft)}`;
    $('gift-btn').disabled = giftLeft > 0;
    $('free-text').textContent = freeLeft <= 0 ? 'Bedava Klasik Paket hazır!' : `Sonraki: ${fmtLeft(freeLeft)}`;
    $('free-btn').disabled = freeLeft > 0;
    const spun = S.wheelDay === G.dayIndex();
    $('wheel-text').textContent = spun ? 'Yarın yine çevirebilirsin.' : 'Bugünkü bedava çevirme hazır!';
    $('wheel-btn').disabled = spun || !G.unlocked('wheel');
    if (!G.unlocked('wheel')) $('wheel-text').textContent = G.lockText('wheel');

    // Sahip olunan paketler
    const owned = D.PACKS.filter(p => S.packs[p.id] > 0);
    $('owned-wrap').hidden = !owned.length;
    const ow = $('owned-packs'); ow.innerHTML = '';
    owned.forEach(p => {
      const b = h('button', 'owned');
      b.appendChild(makePack(p, '70px'));
      b.appendChild(h('span', '', `${esc(p.name)} ×${S.packs[p.id]}<b>Aç</b>`));
      b.onclick = () => { S.packs[p.id]--; G.save(); G.openPack(p); };
      ow.appendChild(b);
    });

    // Günlük fırsat
    const deal = dealOfDay(), bought = S.dealDay === G.dayIndex();
    const r = D.RARITIES[deal.def.rarity];
    $('deal').innerHTML = `<canvas></canvas><div class="deal-info"><span class="label">Günün fırsatı</span><b>${esc(deal.def.name)}</b><span style="color:${r.color}">${r.name}</span></div>`;
    const db = h('button', 'btn btn-yellow', bought ? 'Alındı' : `<i class="coin"></i>${deal.price}`);
    db.disabled = bought;
    db.onclick = () => {
      if (S.coins < deal.price) return G.toast(`Yeterli jeton yok (${deal.price} gerekli)`);
      S.coins -= deal.price; S.dealDay = G.dayIndex(); G.coinFloat(-deal.price);
      const got = G.addCube(deal.def.id);
      G.save(); render();
      G.toast(got.isNew ? `${deal.def.name} koleksiyonuna eklendi!` : `${deal.def.name} seviye ${got.lvl} oldu`);
    };
    $('deal').appendChild(db);
    requestAnimationFrame(() => R.drawPuzzle($('deal').querySelector('canvas'), deal.def));

    // Satılık paketler
    const wrap = $('packs'); wrap.innerHTML = '';
    $('brand-packs').innerHTML = '';
    const brandsOpen = G.unlocked('brands');
    if (!brandsOpen) $('brand-packs').appendChild(h('div', 'tier-head', `<span class="tier" style="--tc:#b9c5ff">🔒 Kilitli</span><span>${G.lockText('brands')}. Önce temel paketlerle başla!</span>`));
    const tierKeys = Object.keys(D.TIERS);
    const tierIdx = (p) => p.brand ? tierKeys.indexOf(D.BRANDS[p.brand].tier) : -1;
    let lastTier = null;
    D.PACKS.slice().sort((a, b) => tierIdx(a) - tierIdx(b)).filter(p => brandsOpen || !p.brand).forEach(p => {
      if (p.brand && D.BRANDS[p.brand].tier !== lastTier) {
        lastTier = D.BRANDS[p.brand].tier;
        const t = D.TIERS[lastTier];
        $('brand-packs').appendChild(h('div', 'tier-head', `${G.tierChip(lastTier)}<span>${esc(t.desc)}</span>`));
      }
      const card = h('div', 'pack-card' + (p.brand ? ' brand-box' : ''));
      const pk = makePack(p);
      card.appendChild(pk);
      if (p.brand) {
        const br = D.BRANDS[p.brand];
        card.appendChild(h('div', 'brand-perk', `<b>${esc(br.tag)}</b><span>Avantaj: ${esc(br.perk)}</span>`));
      }
      const odds = D.RARITY_ORDER.map((rr, i) => p.odds[i] ? `<b style="color:${D.RARITIES[rr].color}">${D.RARITIES[rr].name}</b> %${p.odds[i]}` : '').filter(Boolean).join(' · ');
      card.appendChild(h('div', 'odds', odds));
      const b = h('button', 'btn btn-yellow', `<i class="coin"></i>${priceOf(p)}${onSale(p) ? ` <span class="old">${p.price}</span>` : ''}`);
      b.setAttribute('aria-label', `${p.name} satın al, ${priceOf(p)} jeton`);
      b.onclick = () => buy(p);
      card.appendChild(b);
      (p.brand ? $('brand-packs') : wrap).appendChild(card);
    });
  }
  G.renderShop = render;
  setInterval(() => { if (G.current === 'shop' && !G.isModalOpen()) { render(); } G.renderHeader(); }, 30000);

  $('gift-btn').onclick = () => {
    if (G.S.lastGift + G.GIFT_MS > Date.now()) return;
    G.S.lastGift = Date.now(); G.addCoins(150); G.save(); render(); G.toast('+150 jeton!'); window.FX.coins(8, $('gift-btn'));
  };
  $('free-btn').onclick = () => {
    if (G.S.lastFree + G.FREE_MS > Date.now()) return;
    G.S.lastFree = Date.now(); G.save(); render(); G.openPack(packById('klasik'));
  };

  // ---------- Şans çarkı ----------
  const WHEEL = [
    { t: '50', c: '#ffcc1f', w: 20, coins: 50 }, { t: 'Klasik', c: '#2a7bff', w: 15, pack: 'klasik' },
    { t: '150', c: '#ff8a1f', w: 17, coins: 150 }, { t: '100 XP', c: '#2fcf73', w: 15, xp: 100 },
    { t: '300', c: '#ffcc1f', w: 10, coins: 300 }, { t: 'Usta', c: '#7b4dff', w: 10, pack: 'usta' },
    { t: '75', c: '#22d3ee', w: 10, coins: 75 }, { t: 'Efsane', c: '#ff4f9a', w: 3, pack: 'efsane' },
  ];
  function drawWheel(cv) {
    const { width: w } = cv;
    const ctx = cv.getContext('2d'), r = w / 2, n = WHEEL.length, a = Math.PI * 2 / n;
    WHEEL.forEach((seg, i) => {
      ctx.beginPath(); ctx.moveTo(r, r); ctx.arc(r, r, r, -Math.PI / 2 + i * a, -Math.PI / 2 + (i + 1) * a); ctx.closePath();
      ctx.fillStyle = seg.c; ctx.fill(); ctx.lineWidth = w * 0.012; ctx.strokeStyle = '#1d1446'; ctx.stroke();
      ctx.save(); ctx.translate(r, r); ctx.rotate(-Math.PI / 2 + (i + 0.5) * a);
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.font = `800 ${w * 0.065}px "Baloo 2", sans-serif`;
      ctx.lineWidth = w * 0.014; ctx.strokeStyle = '#1d1446'; ctx.strokeText(seg.t, r * 0.88, 0);
      ctx.fillStyle = '#fff'; ctx.fillText(seg.t, r * 0.88, 0);
      ctx.restore();
    });
  }
  $('wheel-btn').onclick = () => {
    const S = G.S;
    if (S.wheelDay === G.dayIndex() || G.needUnlock('wheel')) return;
    const body = G.modal('Şans Çarkı', `<div class="wheel-wrap"><canvas width="600" height="600"></canvas><span class="wheel-hub"></span></div><p id="wheel-res">Çevirmek için düğmeye bas!</p>`,
      [{ label: 'Çevir!', cls: 'btn-pink', keep: true, onClick: spin }], { replace: true });
    if (!body) return;
    const cv = body.querySelector('canvas');
    drawWheel(cv);
    let spinning = false;
    function spin() {
      if (spinning || S.wheelDay === G.dayIndex()) return;
      spinning = true;
      const total = WHEEL.reduce((a, b) => a + b.w, 0);
      let x = Math.random() * total, i = 0;
      for (; i < WHEEL.length; i++) { x -= WHEEL[i].w; if (x < 0) break; }
      const seg = WHEEL[Math.min(i, WHEEL.length - 1)], idx = WHEEL.indexOf(seg);
      S.wheelDay = G.dayIndex();
      G.save();
      const a = 360 / WHEEL.length;
      const target = 360 * 6 - (idx + 0.5) * a + (Math.random() - 0.5) * a * 0.6;
      cv.style.transform = `rotate(${target}deg)`;
      Snd.shake();
      document.querySelectorAll('#modal-actions .btn').forEach(b => (b.disabled = true));
      setTimeout(() => {
        if (seg.coins) { G.addCoins(seg.coins); window.FX.coins(8); }
        if (seg.xp) G.addXP(seg.xp);
        if (seg.pack) S.packs[seg.pack]++;
        G.save();
        Snd.reveal(seg.pack === 'efsane' ? 4 : 2);
        window.FX.confetti(60);
        const txt = seg.coins ? `+${seg.coins} jeton!` : seg.xp ? `+${seg.xp} XP!` : `${D.PACKS.find(p => p.id === seg.pack).name} kazandın! Paketlerin bölümünde.`;
        const res = document.getElementById('wheel-res'); if (res) res.innerHTML = `<b>${txt}</b>`;
        const row = document.getElementById('modal-actions');
        if (row) { row.innerHTML = ''; const b = h('button', 'btn btn-yellow', 'Harika!'); b.onclick = () => { G.closeModal(); render(); }; row.appendChild(b); }
      }, 4100);
    }
  };

  function buy(pack) {
    const price = priceOf(pack);
    if (G.S.coins < price) { G.toast(`Yeterli jeton yok (${price} gerekli)`); return; }
    G.S.coins -= price;
    G.coinFloat(-price);
    G.save();
    G.openPack(pack, true);
  }

  // ---------- Paket açma ----------
  let opening = null;
  G.openPack = function (pack, paid) {
    G.holdRewards = true;
    const def = G.rollPack(pack);
    const got = G.addCube(def.id);
    G.bump('packs'); G.addXP(10);
    G.save();
    opening = { pack, def, got, paid, stage: 'pack' };
    const slot = $('open-slot'); slot.innerHTML = '';
    const el = makePack(pack); el.classList.add('idle');
    slot.appendChild(el);
    slot.hidden = false;
    $('reveal').hidden = true; $('open-actions').hidden = true; $('open-hint').hidden = false;
    $('rays').className = 'rays';
    $('opener').hidden = false;
  };
  G.isOpening = () => !!opening;
  $('open-slot').addEventListener('click', async () => {
    if (!opening || opening.stage !== 'pack') return;
    opening.stage = 'tearing';
    const el = $('open-slot').firstChild;
    $('open-hint').hidden = true;
    el.classList.remove('idle'); el.classList.add('shake');
    Snd.shake();
    await wait(500);
    el.classList.remove('shake'); el.classList.add('torn');
    Snd.tear();
    await wait(650);
    reveal();
  });
  function reveal() {
    const { def, got, pack, paid } = opening;
    const r = D.RARITIES[def.rarity];
    $('open-slot').hidden = true;
    const rv = $('reveal');
    rv.style.setProperty('--glow', r.color);
    $('rays').style.setProperty('--ray', r.color);
    $('rays').className = 'rays on';
    $('rv-rarity').textContent = r.name;
    $('rv-name').innerHTML = `${G.brandChip(def, 'big')}<span>${esc(def.model)}</span>`;
    const ty = D.TYPES[G.typeOf(def)];
    rv.classList.toggle('holo', !!got.holo);
    $('rv-sub').innerHTML = (got.holo ? '<b class="holo-txt">✨ PARLAK SÜRÜM!</b> ' : '') + (got.isNew ? '<b class="good">YENİ!</b> Koleksiyonuna eklendi.' : `Tekrar geldi: <b>seviye ${got.lvl}</b> oldu.`) + ` · ${ty.name} · ${esc(D.SKILLS[def.skill].name)}`;
    rv.hidden = false;
    rv.style.animation = 'none'; void rv.offsetWidth; rv.style.animation = '';
    R.drawPuzzle($('rv-canvas'), def);
    Snd.reveal(r.order);
    setTimeout(() => window.FX.burstAt($('rv-canvas'), r.color, 20 + r.order * 12, 6 + r.order), 120);
    if (r.order >= 3 || got.holo) window.FX.confetti(60 + r.order * 20);
    if (r.order >= 3 && navigator.vibrate) { try { navigator.vibrate([60, 40, 120]); } catch (e) {} }
    const again = $('open-again');
    if (paid) { again.hidden = false; again.textContent = `Bir tane daha (${priceOf(pack)})`; again.disabled = G.S.coins < priceOf(pack); }
    else if (G.S.packs[pack.id] > 0) { again.hidden = false; again.textContent = `Sıradakini aç (${G.S.packs[pack.id]})`; again.disabled = false; }
    else again.hidden = true;
    $('open-actions').hidden = false;
    opening.stage = 'done';
  }
  G.closeOpener = function () {
    G.holdRewards = false; G.save();
    $('opener').hidden = true; opening = null;
    if (G.current === 'shop') render();
    if (G.current === 'inv') renderInv();
  };
  $('open-ok').onclick = G.closeOpener;
  $('open-again').onclick = () => {
    const { pack, paid } = opening;
    G.closeOpener();
    if (paid) buy(pack);
    else if (G.S.packs[pack.id] > 0) { G.S.packs[pack.id]--; G.save(); G.openPack(pack); }
  };

  // ---------- Envanter ----------
  let filter = 'all', brandFilter = 'all';
  function renderBrandFilter() {
    const S = G.S, row = $('brand-filter');
    const btn = (id, label, color, extra) => `<button data-b="${id}" aria-pressed="${brandFilter === id}" style="--bc:${color}">${label}${extra || ''}</button>`;
    row.innerHTML = btn('all', 'Tüm markalar', '#1d1446') + Object.entries(D.BRANDS).map(([id, b]) => {
      const all = D.CUBES.filter(c => c.brand === id), got = all.filter(c => S.inv[c.id]).length;
      return btn(id, b.name, b.color, ` <small>${got}/${all.length}</small>`);
    }).join('');
    const info = $('brand-info');
    if (brandFilter === 'all') { info.hidden = true; return; }
    const b = D.BRANDS[brandFilter];
    info.hidden = false;
    info.style.setProperty('--bc', b.color);
    info.innerHTML = `<span class="bm big" style="--bc:${b.color}">${b.name}</span><div>${G.tierChip(b.tier)}<b>${esc(b.tag)}</b><small>Avantaj: ${esc(b.perk)}</small></div>`;
  }
  function renderInv() {
    const S = G.S;
    $('inv-progress').textContent = `${G.statValue('collection')}/${G.baseCubeCount()} keşfedildi`;
    const dupes = D.CUBES.reduce((a, c) => a + Math.max(0, (S.inv[c.id] || 0) - 1) * D.RARITIES[c.rarity].sell, 0);
    $('sell-all').textContent = dupes ? `Fazlaları sat (+${dupes})` : 'Fazla yok';
    $('sell-all').disabled = !dupes;
    renderTeamSlots();
    renderBrandFilter();
    const grid = $('inv-grid'); grid.innerHTML = '';
    const list = D.CUBES.slice()
      .filter(c => c.rarity !== 'season' || S.inv[c.id])
      .filter(c => filter === 'all' || G.typeOf(c) === filter)
      .filter(c => brandFilter === 'all' || c.brand === brandFilter)
      .sort((a, b) => (S.inv[b.id] ? 1 : 0) - (S.inv[a.id] ? 1 : 0) || D.RARITIES[b.rarity].order - D.RARITIES[a.rarity].order || G.level(b.id) - G.level(a.id));
    list.forEach(def => {
      const have = S.inv[def.id] || 0;
      const card = h('button', 'card' + (have ? '' : ' locked') + (S.team.includes(def.id) ? ' in-team' : '') + (have && G.isHolo(def.id) ? ' holo' : ''));
      card.style.setProperty('--rc', D.RARITIES[def.rarity].color);
      const ty = D.TYPES[G.typeOf(def)];
      card.innerHTML = `${have ? `<span class="cost" title="Yetenek enerjisi">${G.skillCost(def)}</span>` : ''}<canvas></canvas>${have ? G.brandChip(def, 'sm') : ''}<span class="nm">${have ? esc(def.model) : '???'}</span><span class="rr">${D.RARITIES[def.rarity].name}</span>` +
        (have ? `<span class="lv">Sv ${G.level(def.id)}</span>${have > 1 ? `<span class="cnt">×${have}</span>` : ''}<span class="ty" style="background:${ty.color}">${ty.name}</span>` : '');
      if (have) card.onclick = () => openDetail(def);
      else card.disabled = true;
      grid.appendChild(card);
      requestAnimationFrame(() => R.drawPuzzle(card.querySelector('canvas'), def, { unknown: !have }));
    });
  }
  G.renderInv = renderInv;
  $('brand-filter').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    brandFilter = b.dataset.b; renderInv();
  });
  $('inv-filter').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    filter = b.dataset.f;
    $('inv-filter').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    renderInv();
  });
  $('sell-all').onclick = () => {
    const S = G.S;
    const extraOf = (c) => Math.max(0, (S.inv[c.id] || 0) - 1);
    const total = D.CUBES.reduce((a, c) => a + extraOf(c) * D.RARITIES[c.rarity].sell, 0);
    if (!total) return;
    G.confirm('Fazlaları sat?', `Her bulmacadan 1 tane kalır, seviyeler korunur. +${total} jeton alırsın.`, 'Sat', () => {
      let got = 0;
      D.CUBES.forEach(c => { const x = extraOf(c); if (x) { got += x * D.RARITIES[c.rarity].sell; S.inv[c.id] = 1; } });
      G.addCoins(got); G.save(); renderInv(); G.toast(`+${got} jeton`);
    });
  };

  function renderTeamSlots() {
    const wrap = $('team-slots'); wrap.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const id = G.S.team[i];
      const def = id && cubeById(id);
      const slot = h('button', 'slot' + (def ? ' filled' : ''), def ? `<canvas></canvas>${G.brandChip(def, 'sm')}<span>${esc(def.model)}</span><small>Sv ${G.level(id)}</small>` : '<span>Boş yer</span>');
      if (def) { slot.onclick = () => openDetail(def); requestAnimationFrame(() => R.drawPuzzle(slot.querySelector('canvas'), def)); }
      else slot.disabled = true;
      wrap.appendChild(slot);
    }
    let syn = $('team-syn');
    if (!syn) { syn = h('div', 'team-syn'); syn.id = 'team-syn'; wrap.after(syn); }
    const list = G.synergy(G.S.team.map(cubeById).filter(Boolean));
    syn.innerHTML = list.length ? list.map(x => `<span><b>${esc(x.name)}</b> ${esc(x.desc)}</span>`).join('')
      : '<span class="note">Takım uyumu: aynı markadan 2-3 küp ya da 3 farklı tür seç, bonus kazan.</span>';
  }
  function openDetail(def) {
    const S = G.S;
    const r = D.RARITIES[def.rarity], lv = G.level(def.id), st = G.statsOf(def, lv), have = S.inv[def.id];
    const next = lv < 10 ? G.statsOf(def, lv + 1) : null;
    const inTeam = S.team.includes(def.id);
    const sk = D.SKILLS[def.skill], ty = D.TYPES[G.typeOf(def)];
    const cost = G.upgradeCost(def);
    const body = G.modal(def.name, `
      <div class="tags"><span class="rarity-tag" style="--glow:${r.color}">${r.name}</span><span class="rarity-tag" style="--glow:${ty.color}">${ty.name}</span></div>
      <canvas class="detail-cv"></canvas>
      <div class="brand-banner" style="--bc:${G.brandOf(def).color}">${G.brandChip(def, 'big')}<div>${G.tierChip(G.brandOf(def).tier)}<b>${esc(G.brandOf(def).tag)}</b><small>Marka avantajı: ${esc(G.brandOf(def).perk)}${def.type === 'cube' ? ` · 3B dönüş: ${G.tierOf(def).speed < 150 ? 'çok hızlı' : G.tierOf(def).speed < 200 ? 'akıcı' : 'yavaş'}` : ''}</small></div></div>
      <div class="stats">
        <div><span class="label">Seviye</span><b>${lv}/10</b></div>
        <div><span class="label">Can</span><b>${st.hp}${next ? `<small> → ${next.hp}</small>` : ''}</b></div>
        <div><span class="label">Saldırı</span><b>${st.atk}${next ? `<small> → ${next.atk}</small>` : ''}</b></div>
      </div>
      <div class="skill"><b>${esc(sk.name)}</b>: ${esc(sk.desc)}<br><span class="note">${ty.name} ${G.ROLE[G.typeOf(def)].name}: ${G.ROLE[G.typeOf(def)].range} saldırır. ${G.ROLE[G.typeOf(def)].passive}. ${D.TYPES[ty.beats].name} türüne karşı güçlü.</span></div>
      ${G.isHolo(def.id) ? '<p class="holo-txt">✨ Parlak sürüm sende</p>' : ''}
      <button class="link-btn" id="fav-btn">${(G.S.prof && (G.S.prof.fav || []).includes(def.id)) ? '★ Profil vitrininden çıkar' : '☆ Profil vitrinine koy'}</button>
      <p class="note">${have} adet var. Kopyalar seviyeyi bedava yükseltir.</p>`,
      [
        { label: lv >= 10 ? 'En yüksek seviye' : `Güçlendir (${cost})`, cls: 'btn-yellow', disabled: lv >= 10 || S.coins < cost, onClick: () => upgrade(def) },
        { label: inTeam ? 'Takımdan çıkar' : (S.team.length >= 3 ? 'Takım dolu' : 'Takıma ekle'), cls: 'btn-pink', disabled: !inTeam && S.team.length >= 3,
          onClick: () => { toggleTeam(def.id); renderInv(); } },
        { label: `Sat (+${r.sell})`, disabled: have < 2, onClick: () => sell(def) },
        ...(def.type === 'cube' ? [{ label: 'Çöz', onClick: () => { G.solveId = def.id; G.show('solve'); } }] : []),
      ], { replace: true });
    if (!body) return;
    const cv = body.querySelector('canvas');
    cv.classList.toggle('holo-cv', G.isHolo(def.id));
    R.drawPuzzle(cv, def);
    $('fav-btn').onclick = () => { G.toggleFav(def.id); openDetail(def); };
  }
  G.openDetail = openDetail;
  function upgrade(def) {
    const cost = G.upgradeCost(def);
    if (G.S.coins < cost || G.level(def.id) >= 10) return;
    G.S.coins -= cost;
    G.S.lvl[def.id] = G.level(def.id) + 1;
    G.bump('upgrades');
    G.save();
    Snd.heal();
    G.toast(`${def.name} seviye ${G.S.lvl[def.id]} oldu!`);
    renderInv();
    openDetail(def);
  }
  function toggleTeam(id) {
    const t = G.S.team, i = t.indexOf(id);
    if (i >= 0) t.splice(i, 1); else if (t.length < 3) t.push(id);
    G.save();
  }
  function sell(def) {
    if ((G.S.inv[def.id] || 0) < 2) return;
    G.S.inv[def.id]--; G.addCoins(D.RARITIES[def.rarity].sell); G.save();
    G.toast(`${def.name} satıldı: +${D.RARITIES[def.rarity].sell} jeton`);
    renderInv();
  }
})();
