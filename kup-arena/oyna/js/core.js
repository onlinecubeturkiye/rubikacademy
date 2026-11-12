// Çekirdek: kayıt, ekonomi, oyuncu seviyesi, görevler, başarımlar, pencere ve bildirimler.
(function () {
  const D = window.GameData;
  const $ = (id) => document.getElementById(id);
  const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const rand = (a, b) => a + Math.random() * (b - a);
  const pickOne = (arr, rng = Math.random) => arr[(rng() * arr.length) | 0];
  const cubeById = (id) => D.CUBES.find(c => c.id === id);
  const dayIndex = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);
  function seeded(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  // ---------- Kayıt ----------
  const KEY = 'kup-arena-v1';
  const STAT_KEYS = ['wins', 'losses', 'packs', 'solves', 'skills', 'stages', 'upgrades', 'floors', 'arena', 'pvp', 'bigSolve', 'towerBest'];
  function defaults() {
    const stats = {}; STAT_KEYS.forEach(k => (stats[k] = 0));
    return {
      v: 2, name: 'Oyuncu', coins: 200, trophies: 0, level: 1, xp: 0,
      inv: { c3: 1, c2: 1 }, lvl: { c3: 1, c2: 1 }, team: ['c3', 'c2'],
      packs: { klasik: 0, usta: 0, efsane: 0 },
      lastGift: 0, lastFree: 0, dealDay: -1,
      stats, best: {}, adv: { stars: {}, bosses: [] }, towerCheckpoint: 0,
      quests: null, ach: {}, settings: { sound: true, power: true }, seenIntro: false, dailyDone: -1,
      streak: 0, bestStreak: 0, chests: [null, null, null, null], chestIdx: 0, crowns: null, login: { day: -1, streak: 0 }, wheelDay: -1, trial: 0, account: null,
    };
  }
  function migrate(s) {
    const d = defaults();
    const out = Object.assign(d, s);
    out.stats = Object.assign(defaults().stats, s.stats || {});
    out.packs = Object.assign(d.packs, s.packs || {});
    out.adv = Object.assign({ stars: {}, bosses: [] }, s.adv || {});
    out.settings = Object.assign({ sound: true, power: true }, s.settings || {});
    out.login = Object.assign({ day: -1, streak: 0 }, s.login || {});
    if (!s.lvl) { out.lvl = {}; for (const id in out.inv) out.lvl[id] = Math.min(20, out.inv[id]); }
    if (!s.v) out.seenIntro = true; // eski oyuncular rehberi tekrar görmesin
    out.team = (out.team || []).filter(id => out.inv[id]).slice(0, 3);
    out.holo = s.holo || {};
    out.prof = Object.assign({ fav: [], title: 'caylak' }, s.prof || {});
    // Eski 'sandık anahtarı' sistemi: biriken anahtarlar sandık olarak verilir
    if (s.keys) { out.chests = out.chests || [null, null, null, null]; out.chests[0] = out.chests[0] || { type: s.keys >= 3 ? 'altin' : 'gumus', end: null }; }
    delete out.keys;
    out.v = 2;
    return out;
  }
  function load() {
    try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.inv) return migrate(s); } catch (e) {}
    return defaults();
  }
  const G = window.G = {};
  G.S = load();
  G.save = function () {
    checkAchievements();
    try { localStorage.setItem(KEY, JSON.stringify(G.S)); } catch (e) {}
    renderHeader();
  };
  G.resetSave = function () { try { localStorage.removeItem(KEY); } catch (e) {} location.reload(); };
  G.exportSave = () => btoa(unescape(encodeURIComponent(JSON.stringify(G.S))));
  G.loadState = function (obj) { G.S = migrate(obj); };
  G.importSave = function (code) {
    try {
      const s = JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
      if (!s || !s.inv) return false;
      G.S = migrate(s); G.save(); return true;
    } catch (e) { return false; }
  };

  // ---------- Bulmacalar ----------
  G.level = (id) => G.S.inv[id] ? (G.S.lvl[id] || 1) : 0;
  G.statsOf = (def, lvl, mult = 1) => { const m = (1 + 0.1 * (lvl - 1)) * mult; return { hp: Math.round(def.hp * m), atk: Math.round(def.atk * m) }; };
  G.MAX_LVL = 20;
  G.HOLO_CHANCE = 0.04;
  G.isHolo = (id) => !!(G.S.holo && G.S.holo[id]);
  G.addCube = function (id) {
    const isNew = !G.S.inv[id];
    G.S.inv[id] = (G.S.inv[id] || 0) + 1;
    if (isNew) G.S.lvl[id] = 1; else G.S.lvl[id] = Math.min(G.MAX_LVL, (G.S.lvl[id] || 1) + 1);
    if (isNew && G.S.team.length < 3) G.S.team.push(id);
    // Parlak (holo) sürüm: %4 şans. Gücü değişmez, koleksiyonda parlar.
    G.S.holo = G.S.holo || {};
    let holo = false;
    if (!G.S.holo[id] && Math.random() < G.HOLO_CHANCE) { G.S.holo[id] = true; holo = true; G.bump('holo'); }
    return { isNew, lvl: G.S.lvl[id], holo };
  };
  G.upgradeCost = (def) => Math.round(40 * G.level(def.id) * (1 + D.RARITIES[def.rarity].order * 0.5) * (def.brand === 'topac' ? 0.6 : 1));
  G.rollPack = function (pack) {
    const total = pack.odds.reduce((a, b) => a + b, 0);
    let x = Math.random() * total, ri = 0;
    for (; ri < pack.odds.length; ri++) { x -= pack.odds[ri]; if (x < 0) break; }
    const rarity = D.RARITY_ORDER[Math.min(ri, 4)];
    const pool = D.CUBES.filter(c => c.rarity === rarity && (!pack.brand || c.brand === pack.brand));
    return pickOne(pool.length ? pool : D.CUBES.filter(c => !pack.brand || c.brand === pack.brand));
  };
  G.brandOf = (def) => D.BRANDS[def.brand];
  G.skillCost = (def) => Math.max(1, D.SKILLS[def.skill].cost - (def.brand === 'hayate' ? 1 : 0));
  G.tierOf = (def) => D.TIERS[D.BRANDS[def.brand].tier];
  G.tierChip = (t) => `<span class="tier" style="--tc:${D.TIERS[t].color}">${D.TIERS[t].name}</span>`;
  // Marka amblemi (şekilli logo) ve amblemli marka etiketi
  G.brandLogo = (id, cls = '') => `<svg class="blogo ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path fill-rule="evenodd" d="${D.BRANDS[id].logo}"/></svg>`;
  G.brandChip = (def, cls = '') => { const b = D.BRANDS[def.brand]; return `<span class="bm ${cls}" style="--bc:${b.color}">${G.brandLogo(def.brand)}<i>${b.name}</i></span>`; };
  // Seviye kademesi: 1-5 bronz, 6-10 gümüş, 11-15 altın, 16-20 elmas
  G.lvTier = (lv) => (lv >= 16 ? 'd' : lv >= 11 ? 'g' : lv >= 6 ? 's' : 'b');
  G.typeOf = (def) => D.TYPE_OF[def.type];

  // ---------- Jeton ve deneyim ----------
  G.addCoins = function (n) { G.S.coins += n; if (n > 0) window.Sound.coin(); };
  // Jeton sayacının yanında kısa süre "-250" / "+40" gösterir
  G.coinFloat = function (n) {
    const res = $('coins') && $('coins').parentElement;
    if (!res || !n) return;
    const f = h('span', 'cfloat' + (n < 0 ? ' neg' : ''), (n > 0 ? '+' : '') + n);
    res.appendChild(f);
    setTimeout(() => f.remove(), 1400);
  };
  G.xpNeed = (lv) => 100 + 60 * (lv - 1);
  G.addXP = function (n) {
    const S = G.S;
    if (G.baseBonus) n = Math.round(n * (1 + G.baseBonus('gym')));
    S.xp += n;
    G.seasonState().pts += n;
    while (S.xp >= G.xpNeed(S.level)) {
      S.xp -= G.xpNeed(S.level);
      S.level++;
      const coins = 100 + 20 * S.level;
      S.coins += coins;
      const pack = S.level % 5 === 0 ? 'usta' : null;
      if (pack) S.packs.usta++;
      const opened = Object.values(UNLOCK).filter(u => u.lv === S.level).map(u => u.name);
      G.notify(`Seviye ${S.level}!`, `<div class="big-num">Sv ${S.level}</div><p>+${coins} jeton${pack ? ' ve bedava <b>Usta Paketi</b>' : ''}</p>${opened.length ? `<p class="good">Yeni açıldı: <b>${opened.join(', ')}</b>!</p>` : ''}`);
      window.Sound.win();
    }
  };

  // ---------- Yeni başlayanlar için kilitler ----------
  // Seviye kilitleri; 'w1' = ilk dünyanın boss'u yenilince açılır.
  const UNLOCK = {
    wheel:  { lv: 2, name: 'Şans Çarkı' },
    season: { lv: 2, name: 'Sezon Yolu' },
    arena:  { lv: 3, name: 'Arena' },
    brands: { lv: 5, name: 'Marka Kutuları' },
    tower:  { w1: true, name: 'Sonsuz Kule' },
    pvp:    { w1: true, name: '2 Kişilik Maç' },
  };
  G.UNLOCK = UNLOCK;
  G.unlocked = (k) => { const u = UNLOCK[k]; return u.w1 ? G.S.adv.bosses.includes('w1') : G.S.level >= u.lv; };
  G.lockText = (k) => { const u = UNLOCK[k]; return u.w1 ? `${u.name}, Oyuncak Kasabası’nın boss’unu yenince açılır` : `${u.name} seviye ${u.lv}’de açılır`; };
  G.needUnlock = (k) => { if (G.unlocked(k)) return false; G.toast(G.lockText(k)); return true; };

  // ---------- Sayaçlar, görevler, başarımlar ----------
  G.bump = function (stat, n = 1) { G.S.stats[stat] = (G.S.stats[stat] || 0) + n; };
  G.totalStars = () => Object.values(G.S.adv.stars).reduce((a, b) => a + b, 0);
  function statValue(name) {
    const S = G.S;
    switch (name) {
      case 'collection': return D.CUBES.filter(c => c.rarity !== 'season' && S.inv[c.id]).length;
      case 'worlds': return S.adv.bosses.length;
      case 'stars': return G.totalStars();
      case 'trophies': return S.trophies;
      case 'maxLevel': return Math.max(0, ...Object.keys(S.inv).map(G.level));
      case 'mythics': return D.CUBES.filter(c => c.rarity === 'mythic' && S.inv[c.id]).length;
      case 'brandSet': return Object.keys(D.BRANDS).some(b => D.CUBES.filter(c => c.brand === b).every(c => S.inv[c.id])) ? 1 : 0;
      case 'proOwned': return D.CUBES.some(c => S.inv[c.id] && D.BRANDS[c.brand].tier === 'pro') ? 1 : 0;
      case 'fast3': return S.best[3] && S.best[3] < 120000 ? 1 : 0;
      case 'flash3': return S.best[3] && S.best[3] < 60000 ? 1 : 0;
      default: return S.stats[name] || 0;
    }
  }
  G.statValue = statValue;
  // Paket/kutu açılırken başarım ödülü verilmez; açılış bitince verilir (jeton sayacı karışmasın)
  G.holdRewards = false;
  function checkAchievements() {
    if (G.holdRewards) return;
    for (const a of D.ACHIEVEMENTS) {
      if (G.S.ach[a.id] || statValue(a.stat) < a.target) continue;
      G.S.ach[a.id] = true;
      G.S.coins += a.reward;
      G.toast(`Başarım: ${a.name} (+${a.reward} jeton)`);
    }
  }
  G.achProgress = (a) => Math.min(a.target, statValue(a.stat));

  G.ensureQuests = function () {
    const day = dayIndex();
    if (G.S.quests && G.S.quests.day === day) return G.S.quests;
    const rng = seeded(day * 7919);
    const pool = D.QUESTS.slice();
    const list = [];
    while (list.length < 3) list.push(pool.splice((rng() * pool.length) | 0, 1)[0]);
    G.S.quests = { day, bonus: false, list: list.map(q => ({ id: q.id, start: statValue(q.stat), claimed: false })) };
    G.save();
    return G.S.quests;
  };
  G.questInfo = function (q) {
    const def = D.QUESTS.find(x => x.id === q.id);
    const progress = Math.min(def.target, statValue(def.stat) - q.start);
    return { def, progress, done: progress >= def.target };
  };
  G.questsClaimable = function () {
    const qs = G.ensureQuests();
    const any = qs.list.some(q => !q.claimed && G.questInfo(q).done);
    const bonus = !qs.bonus && qs.list.every(q => q.claimed);
    return any || bonus;
  };

  // ---------- Savaş sonrası bonuslar: seri, sandık anahtarı, mükemmel vuruş ----------
  G.afterBattle = function (res) {
    const S = G.S, lines = [];
    if (res.crowns) { const c = G.crownState(); if (!c.got) { const before = c.n; G.addCrowns(res.crowns); if (c.n > before) lines.push(['Taç', `+${c.n - before} (${c.n}/10)`]); } }
    if (G.auth && G.auth.enabled && !G.auth.user) S.trial = (S.trial || 0) + 1;
    S.stats.maxCombo = Math.max(S.stats.maxCombo || 0, res.maxCombo || 0);
    if (!res.won) {
      if (S.streak >= 2) lines.push(['Seri bitti', `${S.streak} galibiyet`]);
      S.streak = 0;
      return { coins: 0, html: lines.length ? bonusHtml(lines) : '' };
    }
    S.streak++; S.bestStreak = Math.max(S.bestStreak || 0, S.streak);
    if (G.clubWin) G.clubWin();
    let coins = 0;
    if (res.perfects) { const c = res.perfects * 5; coins += c; lines.push([`Mükemmel vuruş ×${res.perfects}`, `+${c}`]); }
    if (S.streak >= 2) { const c = Math.min(S.streak, 10) * 5; coins += c; lines.push([`Galibiyet serisi ×${S.streak}`, `+${c}`]); }
    const chest = G.dropChest();
    lines.push(chest ? ['Kutu kazandın', D.CHESTS[chest].name] : ['Kutu rafın dolu', 'Ana ekranda aç']);
    if (G.event().id === 'coins') { coins += 50; lines.push(['Etkinlik: Çift Jeton', '+50']); }
    if (coins) G.addCoins(coins);
    return { coins, html: bonusHtml(lines) };
  };
  function bonusHtml(lines) {
    return `<div class="bonus-list">${lines.map(([a, b]) => `<span><span>${a}</span><b>${b}</b></span>`).join('')}</div>`;
  }

  // ---------- Günlük giriş takvimi ----------
  const LOGIN = [
    { t: '100 jeton', coins: 100 }, { t: 'Klasik Paket', pack: 'klasik' }, { t: '200 jeton', coins: 200 },
    { t: 'Usta Paketi', pack: 'usta' }, { t: '300 jeton', coins: 300 }, { t: '2 Klasik', pack: 'klasik', n: 2 },
    { t: 'Efsane Paketi', pack: 'efsane' },
  ];
  G.checkLogin = function () {
    const S = G.S, today = dayIndex();
    if (S.login.day === today) return false;
    const next = S.login.day === today - 1 ? (S.login.streak % 7) + 1 : 1;
    const cells = LOGIN.map((r, i) => `<div class="${i + 1 < next ? 'got' : ''}${i + 1 === next ? ' today' : ''}${i === 6 ? ' big' : ''}"><span>Gün ${i + 1}</span><b>${r.t}</b></div>`).join('');
    G.modal('Günlük giriş', `<p>Her gün gel, ödüller büyüsün! Bir gün kaçırırsan baştan başlar.</p><div class="cal">${cells}</div>`,
      [{ label: `${LOGIN[next - 1].t} al`, cls: 'btn-yellow', onClick: () => {
        const r = LOGIN[next - 1];
        S.login = { day: today, streak: next };
        if (r.coins) { G.addCoins(r.coins); window.FX.coins(8); }
        if (r.pack) S.packs[r.pack] += r.n || 1;
        G.save();
        G.toast(r.pack ? `${r.t} Mağaza’da seni bekliyor!` : `+${r.coins} jeton!`);
      } }]);
    return true;
  };

  // ---------- Üst bar ----------
  // ---------- Sezon Yolu: her 28 günde yenilenen 30 kademeli ödül yolu ----------
  G.SEASON_TIER = 300;
  G.SEASON_TIERS = 30;
  G.seasonId = () => Math.floor(dayIndex() / 28);
  G.seasonDaysLeft = () => 28 - (dayIndex() % 28);
  G.seasonState = function () {
    const S = G.S, id = G.seasonId();
    if (!S.season || S.season.id !== id) S.season = { id, pts: 0, claimed: [] };
    return S.season;
  };
  G.seasonTheme = () => D.SEASONS[G.seasonId() % D.SEASONS.length];
  G.baseCubeCount = () => D.CUBES.filter(c => c.rarity !== 'season').length;
  G.seasonReward = function (t) {
    if (t === G.SEASON_TIERS) { const th = G.seasonTheme(); return { text: `Sezon küpü: ${cubeById(th.cube).model}`, seasonCube: th.cube }; }
    if (t === 25) return { text: 'Mitik Küp', mythic: true };
    if (t % 10 === 0) return { text: 'Efsane Paketi', pack: 'efsane' };
    if (t % 5 === 0) return { text: 'Usta Paketi', pack: 'usta' };
    if (t % 3 === 0) return { text: 'Klasik Paket', pack: 'klasik' };
    return { text: `${60 + t * 10} jeton`, coins: 60 + t * 10 };
  };
  G.seasonTier = () => Math.min(G.SEASON_TIERS, Math.floor(G.seasonState().pts / G.SEASON_TIER));
  G.seasonClaimable = () => { if (!G.unlocked('season')) return false; const st = G.seasonState(), t = G.seasonTier(); for (let i = 1; i <= t; i++) if (!st.claimed.includes(i)) return true; return false; };

  // ---------- Haftalık etkinlik ----------
  G.event = function () {
    const week = Math.floor((dayIndex() + 3) / 7);
    const brands = Object.keys(D.BRANDS);
    const list = [
      { id: 'coins', name: 'Çift Jeton Haftası', desc: 'Her galibiyette +50 bonus jeton', color: '#ff9f2e' },
      { id: 'pyramid', name: 'Piramit Festivali', desc: 'Piramitlerin saldırısı %25 fazla', color: '#3bdc6e' },
      { id: 'tower', name: 'Kule Haftası', desc: 'Sonsuz Kule ödülleri 2 kat', color: '#8a5cff' },
      { id: 'brand', brand: brands[week % brands.length], name: `${D.BRANDS[brands[week % brands.length]].name} Haftası`, desc: 'Bu markanın kutusu %30 indirimli', color: D.BRANDS[brands[week % brands.length]].color },
    ];
    const ev = list[week % list.length];
    ev.daysLeft = 7 - ((dayIndex() + 3) % 7);
    return ev;
  };

  function renderHeader() {
    const S = G.S;
    $('coins').textContent = G.short(S.coins);
    $('lvl-num').textContent = S.level;
    $('hdr-name').textContent = S.name;
    $('hdr-tr').textContent = G.short(S.trophies);
    const pct = Math.min(100, S.xp / G.xpNeed(S.level) * 100);
    document.querySelector('.lvl-badge').style.setProperty('--p', pct + '%');
    $('hdr-xp').style.width = pct + '%';
    if (S.quests) $('quest-btn').classList.toggle('dot', G.questsClaimable());
    const arenaTab = document.querySelector('[data-tab=arena]');
    if (arenaTab && G.roadClaimable) arenaTab.classList.toggle('dot', G.unlocked('arena') && G.roadClaimable());
    if (arenaTab) arenaTab.classList.toggle('locked-tab', !G.unlocked('arena'));
    const baseTab = document.querySelector('[data-tab=base]');
    if (baseTab && G.baseNeedsAttention) baseTab.classList.toggle('dot', G.baseNeedsAttention());
    const homeTab = document.querySelector('[data-tab=home]');
    if (homeTab && S.quests) homeTab.classList.toggle('dot', G.questsClaimable() || (G.chestsReady && G.chestsReady()) || G.seasonClaimable());
    const packCount = S.packs.klasik + S.packs.usta + S.packs.efsane;
    const shopTab = document.querySelector('[data-tab=shop]');
    if (shopTab) shopTab.classList.toggle('dot', packCount > 0 || S.lastGift + G.GIFT_MS <= Date.now() || S.lastFree + G.FREE_MS <= Date.now() || (S.wheelDay !== dayIndex() && G.unlocked('wheel')));

  }
  G.renderHeader = renderHeader;
  // Geri sayımlar: sayfayı baştan çizmeden yalnız süre yazılarını günceller
  G.fmtLeft = (ms) => { ms = Math.max(0, ms); const m = Math.ceil(ms / 60000); return m >= 60 ? `${Math.floor(m / 60)} sa ${m % 60 ? (m % 60) + ' dk' : ''}`.trim() : ms < 60000 ? `${Math.ceil(ms / 1000)} sn` : `${m} dk`; };
  G.tickTimers = function (root) {
    (root || document).querySelectorAll('[data-end]').forEach(el => { el.textContent = (el.dataset.pre || '') + G.fmtLeft(+el.dataset.end - Date.now()); });
    (root || document).querySelectorAll('[data-rush]').forEach(el => { el.textContent = `Hemen bitir (${Math.max(10, Math.ceil(Math.max(0, +el.dataset.rush - Date.now()) / 60000 * 1.5))})`; });
  };
  // Büyük sayılar üst barda kısalır: 14845 → 14.8K
  G.short = (n) => (n >= 100000 ? Math.floor(n / 1000) + 'K' : n >= 10000 ? (Math.floor(n / 100) / 10) + 'K' : String(n));
  G.GIFT_MS = 20 * 3600 * 1000;
  G.FREE_MS = 3 * 3600 * 1000;

  // ---------- Bildirim ----------
  const toasts = [];
  let toastBusy = false;
  G.toast = function (msg) { toasts.push(msg); if (!toastBusy) nextToast(); };
  function nextToast() {
    const msg = toasts.shift();
    if (!msg) { toastBusy = false; $('toast').hidden = true; return; }
    toastBusy = true;
    const t = $('toast'); t.textContent = msg; t.hidden = false;
    t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
    setTimeout(nextToast, 2100);
  }

  // ---------- Pencere (sıralı) ----------
  const modalQueue = [];
  let modalOpen = false, onModalClose = null;
  G.modal = function (title, bodyHtml, actions, opts = {}) {
    if (modalOpen && !opts.replace) { modalQueue.push([title, bodyHtml, actions, opts]); return null; }
    modalOpen = true;
    onModalClose = opts.onClose || null;
    $('modal-title').textContent = title;
    $('modal-body').innerHTML = bodyHtml;
    $('modal').classList.toggle('wide', !!opts.wide);
    const row = $('modal-actions'); row.innerHTML = '';
    (actions || [{ label: 'Tamam', cls: 'btn-yellow' }]).forEach(a => {
      const b = h('button', 'btn ' + (a.cls || ''), esc(a.label));
      b.disabled = !!a.disabled;
      b.onclick = () => { window.Sound.click(); if (!a.keep) G.closeModal(); a.onClick && a.onClick(); };
      row.appendChild(b);
    });
    $('modal').hidden = false;
    $('modal').querySelector('.modal-card').scrollTop = 0;
    return $('modal-body');
  };
  G.notify = (title, html) => G.modal(title, html, null);
  G.closeModal = function () {
    $('modal').hidden = true; modalOpen = false;
    const cb = onModalClose; onModalClose = null;
    if (cb) cb();
    if (modalQueue.length && !modalOpen) { const [t, b, a, o] = modalQueue.shift(); setTimeout(() => G.modal(t, b, a, o), 120); }
  };
  G.isModalOpen = () => modalOpen;
  G.confirm = function (title, text, okLabel, onOk) {
    G.modal(title, `<p>${text}</p>`, [{ label: 'Vazgeç' }, { label: okLabel, cls: 'btn-pink', onClick: onOk }], { replace: true });
  };
  $('modal').addEventListener('click', e => { if (e.target.id === 'modal') G.closeModal(); });

  Object.assign(G, { $, h, esc, wait, rand, pickOne, cubeById, dayIndex, seeded, D });
  window.Sound.setEnabled(G.S.settings.sound);
})();
