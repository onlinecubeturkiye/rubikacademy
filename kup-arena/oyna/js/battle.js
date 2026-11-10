// Savaş motoru: KÜP TAHTASI. Macera, Kule, Arena ve 2 kişilik maç bunu kullanır.
// G.battle({ mode, title, bg, nameA, nameB, teamA:[{id,lvl}], teamB:[{id,lvl,mult,boss,label}], mod, onEnd(res) })
// Tahta 3 sütun × 4 satır. Rakip üstte (0-1), oyuncu altta (2-3). Her takımın tüm küpleri sahadadır.
// Her tur 3 hamle puanı: yürü 1, saldır 2, yetenek 1-3, sıra döndür 1 (turda bir kez).
(function () {
  const { $, h, esc, wait, cubeById, D } = G;
  const R = window.Render, Snd = window.Sound;
  const COLS = 3, ROWS = 4, AP = 3;
  let B = null;

  // ---------- Kurallar ----------
  const typeKey = (f) => G.typeOf(f.def);
  const eff = (a, d) => {
    const ta = typeKey(a), td = typeKey(d);
    if (D.TYPES[ta].beats === td) return 1.3;
    if (D.TYPES[td].beats === ta) return 0.8;
    return 1;
  };
  // Menzil: Küp yanındakine (dört yön), Piramit düz çizgide 2 kareye, Özel çevresindeki 8 kareye vurur
  const ROLE = {
    kup: { name: 'Savaşçı', range: 'Yanındaki kareler', passive: 'Kalkan duvarı: yanında dostu varsa %15 az hasar alır', can: (dr, dc) => Math.abs(dr) + Math.abs(dc) === 1 },
    piramit: { name: 'Nişancı', range: 'Düz çizgide 2 kare', passive: 'Keskin nişan: engelin üstünden vurur, 2 kareden +%15 kritik', can: (dr, dc) => (dr === 0 || dc === 0) && Math.abs(dr) + Math.abs(dc) <= 2 && (dr || dc) },
    ozel: { name: 'Büyücü', range: 'Çevresindeki 8 kare', passive: 'Destek aurası: çevresindeki dostlar %10 fazla vurur', can: (dr, dc) => Math.max(Math.abs(dr), Math.abs(dc)) === 1 },
  };
  G.ROLE = ROLE;
  const inRange = (a, d) => ROLE[typeKey(a)].can(d.r - a.r, d.c - a.c);
  const SK_AP = { shield: 1, heal: 2, drain: 2, double: 3, stun: 3 };
  const skillAP = (f) => Math.max(1, SK_AP[f.def.skill] - (f.def.brand === 'hayate' ? 1 : 0));
  const NEED_TARGET = { double: 1, stun: 1, drain: 1 };

  // Marka / tür uyumu (takım bonusu)
  G.synergy = function (defs) {
    const out = [];
    const brands = {};
    defs.forEach(d => { brands[d.brand] = (brands[d.brand] || 0) + 1; });
    const top = Object.entries(brands).sort((a, b) => b[1] - a[1])[0];
    if (top && top[1] >= 3) out.push({ id: 'brand3', name: `${D.BRANDS[top[0]].name} Ekibi`, desc: '+%20 saldırı, +%10 can', atk: 0.2, hp: 0.1, brand: top[0] });
    else if (top && top[1] === 2) out.push({ id: 'brand2', name: `${D.BRANDS[top[0]].name} İkilisi`, desc: '+%10 saldırı', atk: 0.1, hp: 0, brand: top[0] });
    const types = new Set(defs.map(d => G.typeOf(d)));
    if (defs.length >= 3 && types.size === 3) out.push({ id: 'balance', name: 'Üçlü Denge', desc: 'İlk turda +1 hamle puanı', ap: 1 });
    return out;
  };

  let uid = 0;
  function mkF(x, side) {
    const def = cubeById(x.id);
    const st = G.statsOf(def, x.lvl, 1);
    const hpM = (x.mult || 1) * (x.boss ? 2.2 : 1), atkM = (x.mult || 1) * (x.boss ? 1.15 : 1);
    const hp = Math.round(st.hp * hpM);
    return { uid: ++uid, side, def, lvl: x.lvl, hp, max: hp, atk: Math.round(st.atk * atkM), shield: def.brand === 'torva' ? 1 : 0,
      stun: false, boss: !!x.boss, label: x.label || def.name, r: 0, c: 0, acted: false, cd: 0, holo: !!x.holo };
  }
  const other = (s) => (s === 'A' ? 'B' : 'A');
  const units = () => B.A.list.concat(B.B.list);
  const alive = (s) => B[s].list.filter(f => f.hp > 0);
  const at = (r, c) => units().find(f => f.hp > 0 && f.r === r && f.c === c);
  const isHuman = (s) => (s === 'A' ? !B.auto : B.mode === 'pvp');
  const pace = (ms) => wait(ms * (B && B.fast ? 0.45 : 0.8));
  const powerOn = () => G.S.settings.power !== false;
  const rng = () => Math.random();

  function place(list, row) {
    const order = list.length === 1 ? [1] : list.length === 2 ? [0, 2] : [1, 0, 2];
    list.forEach((f, i) => { f.r = row; f.c = order[i]; });
  }

  G.battle = function (cfg) {
    // Deneme maçları bittiyse önce RA ID ile giriş
    if (cfg.mode !== 'pvp' && G.auth && G.auth.needsLogin()) { G.auth.openLogin('trial', () => G.battle(cfg)); return; }
    B = {
      mode: cfg.mode, cfg, auto: false, fast: false, over: false, resolve: null, turnSide: 'A', round: 0,
      A: { list: cfg.teamA.map(x => mkF(x, 'A')), name: cfg.nameA || G.S.name, ap: 0, rot: false },
      B: { list: cfg.teamB.map(x => mkF(x, 'B')), name: cfg.nameB || 'Rakip', ap: 0, rot: false },
      crowns: 0, combo: { A: 0, B: 0 }, perfects: { A: 0, B: 0 }, maxCombo: 0, sel: null, aim: null, frames: [],
    };
    // Oyuncunun parlak (holo) küpleri tahtada da parlar
    if (cfg.mode !== 'pvp') B.A.list.forEach(f => { f.holo = !!(G.S.holo && G.S.holo[f.def.id]); });
    place(B.A.list, 3); place(B.B.list, 0);
    (cfg.posA || []).forEach((p, i) => { if (B.A.list[i]) { B.A.list[i].r = p[0]; B.A.list[i].c = p[1]; } });
    (cfg.posB || []).forEach((p, i) => { if (B.B.list[i]) { B.B.list[i].r = p[0]; B.B.list[i].c = p[1]; } });
    // Güç kareleri: üstünde duran küp %30 fazla vurur
    const pc = [0, 1, 2].sort(() => rng() - 0.5);
    B.power = cfg.power || [{ r: 1, c: pc[0] }, { r: 2, c: pc[1] }];
    B.ice = [];
    // Arena modu: can çarpanı
    const hpM = cfg.mod && cfg.mod.hp;
    if (hpM) units().forEach(f => { f.max = f.hp = Math.round(f.max * hpM); });
    // Atölye: Laboratuvar oyuncunun küplerini güçlendirir
    const lab = G.baseBonus ? G.baseBonus('lab') : 0;
    if (lab && cfg.mode !== 'pvp') B.A.list.forEach(f => { f.max = f.hp = Math.round(f.max * (1 + lab)); f.atk = Math.round(f.atk * (1 + lab)); });
    // Takım uyumu
    ['A', 'B'].forEach(s => {
      const syn = G.synergy(B[s].list.map(f => f.def));
      B[s].syn = syn;
      syn.forEach(x => B[s].list.forEach(f => {
        if (x.atk) f.atk = Math.round(f.atk * (1 + x.atk));
        if (x.hp) { f.max = f.hp = Math.round(f.max * (1 + x.hp)); }
      }));
    });
    // İlk savaş: rehberli. Rakip daha dayanıklı ama daha zayıf vurur
    B.guided = cfg.mode === 'stage' && !(G.S.tut && G.S.tut.board);
    if (B.guided) B.B.list.forEach(f => { f.max = f.hp = Math.round(f.max * 1.6); f.atk = Math.max(1, Math.round(f.atk * 0.55)); });
    if (cfg.mode !== 'pvp' && G.event().id === 'pyramid') B.A.list.forEach(f => { if (f.def.type === 'pyramid') f.atk = Math.round(f.atk * 1.25); });
    $('b-title').textContent = cfg.title || 'Savaş';
    $('battle').style.setProperty('--bbg', cfg.bg || 'linear-gradient(180deg, #2a7bff, #5fd0ff)');
    $('b-auto').hidden = cfg.mode === 'pvp' || !!cfg.noAuto;
    $('b-auto').textContent = 'Oto: Kapalı';
    $('b-quit').textContent = cfg.mode === 'pvp' ? 'Bitir' : 'Pes et';
    $('battle').hidden = false;
    $('power').hidden = true; $('defend').hidden = true; $('b-acts').hidden = false; $('emote-pop').hidden = true;
    buildBoard();
    renderAll();
    const synTxt = (B.A.syn || []).map(x => `<b>${esc(x.name)}</b>`).join(' · ');
    say(`<b>${esc(B.B.name)}</b> ile savaş başladı!${synTxt ? ' Takım uyumu: ' + synTxt : ''}`);
    snap('start');
    if (B.guided || !(G.S.tut && G.S.tut.boardIntro)) howTo(() => run()); else run();
  };
  G.inBattle = () => !!B;

  function howTo(next) {
    G.S.tut = Object.assign(G.S.tut || {}, { boardIntro: true }); G.save();
    G.modal('Küp Tahtası', `
      <ul class="howto">
        <li><b>Her tur 3 hamle puanın var.</b> Küpüne dokun, sonra ne yapacağını seç.</li>
        <li><span class="ht-g"></span><b>Yürü</b> (1 puan): yeşil karelere.</li>
        <li><span class="ht-r"></span><b>Saldır</b> (2 puan): kırmızı çerçeveli rakibe. Her küp turda bir kez saldırır.</li>
        <li><span class="ht-a">⟲</span><b>Döndür</b> (1 puan, turda bir kez): sıranın yanındaki oka dokun, o sıradaki herkes kayar. Rakibi menzile çek!</li>
        <li><span class="ht-p">⚡</span><b>Güç karesi:</b> üstünde duran küp %30 fazla vurur.</li>
        <li><b>Menzil:</b> Küp yanına, Piramit düz 2 kareye, Özel çevresindeki 8 kareye vurur.</li>
        <li><b>Tür özellikleri:</b> Küp yanında dost varsa az hasar alır. Piramit uzaktan daha kritik vurur. Özel çevresindeki dostları güçlendirir.</li>
        <li><b>Olaylar:</b> Her 3 turda tahtada bir şey olur: buz, süper güç, şifa, deprem…</li>
      </ul>`, [{ label: 'Başla!', cls: 'btn-yellow', onClick: next }], { replace: true });
  }

  async function run() {
    let side = 'A';
    await pace(500);
    while (B && !B.over) {
      await takeTurn(side);
      if (!B || B.over) break;
      side = other(side);
    }
  }

  async function takeTurn(side) {
    const T = B[side];
    if (side === 'A') {
      B.round++;
      B.ice = (B.ice || []).filter(x => x.until >= B.round);
      // Bulmaca savaşı: tur sınırı
      if (B.cfg.goal && B.round > B.cfg.goal) { say(`<b>Süre doldu!</b> ${B.cfg.goal} turda kazanamadın.`); await pace(900); return end(false); }
      if (B.round >= 3 && B.round % 3 === 0 && !B.cfg.goal) await boardEvent();
      if (!B || B.over) return;
      // Uzayan savaş: 12. turdan sonra arena daralır
      if (B.round >= 12) {
        say('<b>Arena daralıyor!</b> Tüm küpler can kaybediyor.');
        units().filter(f => f.hp > 0).forEach(f => { const d = Math.max(1, Math.round(f.max * 0.08)); f.hp = Math.max(0, f.hp - d); floatNum(f, '-' + d); });
        renderAll(); await pace(700);
        for (const s of ['A', 'B']) if (!alive(s).length) return end(s === 'B');
        if (await checkKO()) return;
      }
    }
    T.ap = AP + ((B.cfg.mod && B.cfg.mod.energy) ? 1 : 0) + (B.round === 1 && side === 'A' || B.round === 1 && side === 'B' ? (T.syn || []).reduce((a, x) => a + (x.ap || 0), 0) : 0);
    T.rot = false;
    T.list.forEach(f => { f.acted = false; if (f.cd > 0) f.cd--; });
    B.turnSide = side; B.sel = null; B.aim = null;
    renderAll();
    if (isHuman(side)) {
      if (B.mode === 'pvp') { Snd.turn(); say(`Sıra: <b>${esc(T.name)}</b>`); }
      if (B.guided && side === 'A') guide();
      await new Promise(res => { B.endTurn = res; renderAll(); });
      B.endTurn = null;
    } else {
      await pace(side === 'A' ? 300 : 500);
      const boss = alive(side).find(f => f.rage);
      if (boss) await bossTwist(boss);
      if (!B || B.over) return;
      await aiTurn(side);
    }
    // sersemlik, sersemleyen takımın beklediği tur bitince geçer
    T.list.forEach(f => { f.stun = false; });
    B && (B.sel = null);
  }

  // ---------- Seçenekler ----------
  const stepDirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const canAct = (f) => f.hp > 0 && !f.stun;
  function moveCells(f) {
    if (!canAct(f) || B[f.side].ap < 1) return [];
    return stepDirs.map(([dr, dc]) => ({ r: f.r + dr, c: f.c + dc })).filter(p => p.r >= 0 && p.r < ROWS && p.c >= 0 && p.c < COLS && !at(p.r, p.c) && !iceAt(p.r, p.c));
  }
  const iceAt = (r, c) => (B.ice || []).some(x => x.r === r && x.c === c);
  function targets(f) {
    if (!canAct(f) || f.acted) return [];
    return alive(other(f.side)).filter(d => inRange(f, d));
  }
  const canAttack = (f) => B[f.side].ap >= 2 && targets(f).length > 0;
  const skillReady = (f) => canAct(f) && !f.acted && f.cd === 0 && B[f.side].ap >= skillAP(f);
  const onPower = (f) => B.power.some(p => p.r === f.r && p.c === f.c);
  const powerMul = () => (B.superRound === B.round ? 1.6 : 1.3);
  const near = (a, b, cheb) => a !== b && (cheb ? Math.max(Math.abs(a.r - b.r), Math.abs(a.c - b.c)) === 1 : Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1);

  // ---------- İnsan girişi ----------
  function tapCell(r, c) {
    if (!B || B.over || B.busy || !isHuman(B.turnSide) || !B.endTurn) return;
    const side = B.turnSide, u = at(r, c), sel = B.sel;
    if (B.aim) {
      // yetenek hedefi seçiliyor
      if (u && u.side !== side && inRange(sel, u)) { const s = sel; B.aim = null; act(() => doSkill(s, u)); }
      else { B.aim = null; renderAll(); }
      return;
    }
    if (u && u.side === side) {
      if (!canAct(u)) { say(`<b>${esc(u.label)}</b> sersem, bu tur bekliyor`); return; }
      B.sel = sel === u ? null : u; Snd.click(); renderAll(); return;
    }
    if (!sel) { if (u) showInfo(u); return; }
    if (u && u.side !== side) {
      if (sel.acted) return say('Bu küp bu tur zaten saldırdı');
      if (!inRange(sel, u)) return say(`Menzil dışında. ${ROLE[typeKey(sel)].name}: ${ROLE[typeKey(sel)].range}`);
      if (B[side].ap < 2) return say('Saldırı için 2 hamle puanı gerekir');
      return act(() => doAttack(sel, u));
    }
    if (!u && moveCells(sel).some(p => p.r === r && p.c === c)) return act(() => doMove(sel, r, c));
  }
  function tapRotate(r, d) {
    if (!B || B.over || B.busy || !isHuman(B.turnSide) || !B.endTurn) return;
    const T = B[B.turnSide];
    if (T.rot) return say('Turda yalnız bir kez döndürebilirsin');
    if (T.ap < 1) return say('Döndürmek için 1 hamle puanı gerekir');
    act(() => doRotate(B.turnSide, r, d));
  }
  async function act(fn) {
    B.busy = true; renderAll();
    await fn();
    if (!B) return;
    B.busy = false;
    if (B.over) return;
    if (await checkKO()) return;
    const side = B.turnSide;
    if (B.sel && B.sel.hp <= 0) B.sel = null;
    renderAll();
    // yapılacak bir şey kalmadıysa tur kendiliğinden biter
    const T = B[side];
    const any = T.ap > 0 && alive(side).some(f => canAct(f) && (moveCells(f).length || canAttack(f) || skillReady(f))) || (T.ap >= 1 && !T.rot && alive(side).some(f => !f.acted && canAct(f)));
    if (!any && B.endTurn) { await pace(350); B.endTurn && B.endTurn(); }
  }

  // ---------- Hamleler ----------
  async function doMove(f, r, c) {
    B[f.side].ap -= 1;
    f.r = r; f.c = c;
    Snd.click(); renderAll();
    snap(`${f.label} yürüdü`);
    await pace(260);
  }
  async function doRotate(side, r, d) {
    B[side].ap -= 1; B[side].rot = true;
    if (side === 'A' && B.mode !== 'pvp') G.bump('rotates');
    units().filter(f => f.hp > 0 && f.r === r).forEach(f => { f.c = (f.c + d + COLS) % COLS; });
    Snd.skill();
    const row = $('bd').querySelector(`.b-rowfx[data-r="${r}"]`);
    if (row) { row.classList.remove('go'); void row.offsetWidth; row.classList.add('go'); }
    say(`<b>${esc(B[side].name)}</b> ${r + 1}. sırayı ${d > 0 ? 'sağa' : 'sola'} döndürdü!`);
    renderAll();
    snap('döndürme');
    await pace(420);
  }
  async function strike(a, d, k, label) {
    const human = isHuman(a.side), vsHuman = isHuman(d.side) && B.mode !== 'pvp';
    let pm = 1;
    if (human && powerOn() && !B.auto) { const p = await powerBar(a.side); pm = p.m; }
    else if (!human && vsHuman && !B.auto && powerOn()) pm = await defendQTE();
    if (!B || B.over) return 0;
    let dmg = a.atk * (0.88 + rng() * 0.24) * k * pm;
    const e = eff(a, d); dmg *= e;
    if (onPower(a)) dmg *= powerMul();
    // tür özellikleri
    const far = typeKey(a) === 'piramit' && Math.abs(d.r - a.r) + Math.abs(d.c - a.c) === 2;
    const aura = alive(a.side).some(x => typeKey(x) === 'ozel' && near(x, a, true));
    const wall = typeKey(d) === 'kup' && alive(d.side).some(x => near(x, d, false));
    if (aura) dmg *= 1.1;
    if (wall) dmg *= 0.85;
    if (a.rage) dmg *= 1.3;
    const crit = rng() < (a.def.brand === 'zenko' ? 0.2 : 0.1) + ((B.cfg.mod && B.cfg.mod.crit) || 0) + (far ? 0.15 : 0);
    if (crit) dmg *= a.def.brand === 'vexa' ? 2 : 1.5;
    dmg = Math.max(1, Math.round(dmg));
    if (d.shield > 0) { dmg = Math.max(1, Math.round(dmg / 2)); d.shield--; }
    const big = pm >= 1.5 || crit;
    anim(a, 'lunge'); await pace(150);
    d.hp = Math.max(0, d.hp - dmg);
    anim(d, 'hit'); floatNum(d, '-' + dmg, false, big);
    if (d.boss && !d.rage && d.hp > 0 && d.hp < d.max / 2) { d.rage = true; setTimeout(() => banner('Patron öfkelendi!', `${d.label} daha sert vuruyor ve her tur bir sırayı kendisi döndürecek!`, 'rage'), 300); }
    window.FX.burstAt(tokEl(d), big ? null : '#ffcc1f', big ? 24 : 10, big ? 7 : 4);
    if (big || dmg > d.max * 0.3) window.FX.shake($('battle'));
    if (navigator.vibrate && big) { try { navigator.vibrate(40); } catch (er) {} }
    Snd.hit();
    const tags = [];
    if (crit) tags.push('kritik!');
    if (e > 1) tags.push('<b class="good">çok etkili</b>');
    else if (e < 1) tags.push('<span class="weak">pek etkili değil</span>');
    if (onPower(a)) tags.push(B.superRound === B.round ? '⚡ SÜPER güç' : '⚡ güç karesi');
    if (aura) tags.push('aura');
    if (wall) tags.push('kalkan duvarı');
    if (pm >= 1.5 && human) tags.push('<b class="good">mükemmel</b>');
    if (pm < 1 && vsHuman) tags.push('<b class="good">blokladın</b>');
    say(`<b>${esc(a.label)}</b> ${label}: ${dmg} hasar${tags.length ? ' · ' + tags.join(' · ') : ''}`);
    return dmg;
  }
  async function doAttack(a, d) {
    B[a.side].ap -= 2; a.acted = true;
    await strike(a, d, 1, 'saldırdı');
    if (!B) return;
    renderAll(); snap('saldırı');
    await pace(420);
  }
  async function doSkill(a, d) {
    const sk = D.SKILLS[a.def.skill];
    B[a.side].ap -= skillAP(a); a.acted = true; a.cd = 2;
    if (a.side === 'A' || B.mode === 'pvp') G.bump('skills');
    Snd.skill();
    const s = a.def.skill;
    if (s === 'double') await strike(a, d, 2, sk.name);
    else if (s === 'stun') { await strike(a, d, 0.6, sk.name); if (B && d.hp > 0) { d.stun = true; say(`<b>${esc(d.label)}</b> sersemledi, bir tur bekleyecek!`); } }
    else if (s === 'drain') { const dealt = await strike(a, d, 1.2, sk.name); const v = Math.min(a.max - a.hp, Math.round(dealt / 2)); a.hp += v; if (v) floatNum(a, '+' + v, true); }
    else if (s === 'heal') {
      // kendisini ya da yanındaki en yaralı dostunu iyileştirir
      const friends = alive(a.side).filter(f => f === a || Math.abs(f.r - a.r) + Math.abs(f.c - a.c) === 1);
      const t = friends.sort((x, y) => x.hp / x.max - y.hp / y.max)[0];
      const v = Math.min(t.max - t.hp, Math.round(t.max * 0.35));
      t.hp += v; floatNum(t, '+' + v, true); Snd.heal();
      window.FX.burstAt(tokEl(t), '#2fcf73', 14, 4);
      say(`<b>${esc(a.label)}</b> ${sk.name}: <b>${esc(t.label)}</b> ${v} can yeniledi`);
    } else if (s === 'shield') {
      a.shield = 2;
      window.FX.burstAt(tokEl(a), '#2e8cff', 14, 4);
      say(`<b>${esc(a.label)}</b> ${sk.name} açtı: sonraki 2 saldırıda yarı hasar`);
    }
    if (!B) return;
    renderAll(); snap('yetenek');
    await pace(450);
  }
  function useSkill() {
    const f = B && B.sel;
    if (!f || B.busy || !B.endTurn || !skillReady(f)) return;
    if (NEED_TARGET[f.def.skill]) {
      if (!targets(f).length) return say('Menzilde rakip yok. Önce yaklaş!');
      B.aim = true; say(`<b>${esc(D.SKILLS[f.def.skill].name)}</b>: hedef seç`); renderAll(); return;
    }
    act(() => doSkill(f, null));
  }

  async function checkKO() {
    let any = false;
    for (const f of units()) {
      if (f.hp <= 0 && !f.dead) {
        f.dead = true; any = true;
        if (f.side === 'B' && B.mode !== 'pvp') { B.crowns++; if (rng() < 0.3) botEmote([3, 5]); }
        if (f.side === 'A' && B.mode !== 'pvp' && rng() < 0.35) botEmote([0, 4]);
        say(`<b>${esc(f.label)}</b> oyun dışı!`);
        renderAll();
        await pace(500);
        if (!B) return true;
      }
    }
    if (any) {
      if (!alive('B').length) { end(true); return true; }
      if (!alive('A').length) { end(false); return true; }
    }
    return false;
  }

  // ---------- Tahta olayları (her 3 turda bir) ----------
  function banner(title, text, kind) {
    const el = $('b-event');
    if (!el) return;
    el.className = 'b-event ' + (kind || '');
    el.innerHTML = `<b>${esc(title)}</b><small>${esc(text)}</small>`;
    el.hidden = false;
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    Snd.reveal(2);
    clearTimeout(banner.t); banner.t = setTimeout(() => { el.hidden = true; }, 2600);
  }
  const emptyCells = (rows) => { const out = []; rows.forEach(r => { for (let c = 0; c < COLS; c++) if (!at(r, c) && !iceAt(r, c)) out.push({ r, c }); }); return out; };
  async function boardEvent() {
    const kind = G.pickOne(['ice', 'super', 'heal', 'shift', 'move']);
    if (kind === 'ice') {
      const cells = emptyCells([1, 2]).sort(() => rng() - 0.5).slice(0, 2);
      if (!cells.length) return boardEvent2('super');
      cells.forEach(p => B.ice.push({ r: p.r, c: p.c, until: B.round + 2 }));
      banner('Buzlanma!', 'Buzlu karelere 2 tur boyunca girilemez.', 'ice');
    } else boardEvent2(kind);
    renderAll(); snap('olay');
    await pace(1300);
  }
  function boardEvent2(kind) {
    if (kind === 'super') { B.superRound = B.round; banner('Süper güç!', 'Bu tur ⚡ güç kareleri %60 fazla vurduruyor.', 'super'); }
    else if (kind === 'heal') {
      units().filter(f => f.hp > 0).forEach(f => { const v = Math.min(f.max - f.hp, Math.round(f.max * 0.1)); if (v) { f.hp += v; floatNum(f, '+' + v, true); } });
      banner('Şifa yağmuru!', 'Tüm küpler canının %10’unu yeniledi.', 'heal');
    } else if (kind === 'shift') {
      [[1, 1], [2, -1]].forEach(([r, d]) => units().filter(f => f.hp > 0 && f.r === r).forEach(f => { f.c = (f.c + d + COLS) % COLS; }));
      banner('Deprem!', 'Ortadaki iki sıra kendiliğinden döndü.', 'shift');
    } else {
      const cols = [0, 1, 2].sort(() => rng() - 0.5);
      B.power = [{ r: 1, c: cols[0] }, { r: 2, c: cols[1] }];
      banner('Güç kareleri yer değiştirdi!', 'Yeni ⚡ karelere koş.', 'super');
    }
  }
  // Öfkeli patron her turunun başında oyuncunun en kalabalık sırasını döndürür (puan harcamaz)
  async function bossTwist(boss) {
    const foe = other(boss.side);
    let best = null;
    for (let r = 0; r < ROWS; r++) { const n = alive(foe).filter(f => f.r === r).length; if (n && (!best || n > best.n)) best = { r, n }; }
    if (!best) return;
    const d = rng() < 0.5 ? 1 : -1;
    units().filter(f => f.hp > 0 && f.r === best.r).forEach(f => { f.c = (f.c + d + COLS) % COLS; });
    const row = $('bd').querySelector(`.b-rowfx[data-r="${best.r}"]`);
    if (row) { row.classList.remove('go'); void row.offsetWidth; row.classList.add('go'); }
    anim(boss, 'lunge'); Snd.skill();
    say(`<b>${esc(boss.label)}</b> öfkeyle ${best.r + 1}. sırayı döndürdü!`);
    renderAll(); snap('patron');
    await pace(700);
  }

  // ---------- Yapay zekâ ----------
  function bfs(f) {
    // f'nin boş karelerden yürüyerek ulaşabileceği kareler ve adım sayısı
    const seen = new Map([[f.r * 9 + f.c, 0]]), q = [[f.r, f.c, 0]], out = [{ r: f.r, c: f.c, d: 0 }];
    while (q.length) {
      const [r, c, d] = q.shift();
      if (d >= 3) continue;
      for (const [dr, dc] of stepDirs) {
        const nr = r + dr, nc = c + dc, k = nr * 9 + nc;
        if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || seen.has(k) || at(nr, nc) || iceAt(nr, nc)) continue;
        seen.set(k, d + 1); q.push([nr, nc, d + 1]); out.push({ r: nr, c: nc, d: d + 1 });
      }
    }
    return out;
  }
  function stepsToAttack(f) {
    let best = 9;
    const foes = alive(other(f.side));
    for (const p of bfs(f)) {
      const g = { def: f.def, r: p.r, c: p.c };
      if (foes.some(d => inRange(g, d))) best = Math.min(best, p.d);
    }
    return best;
  }
  function attackScore(a, d, k) {
    let v = a.atk * k * eff(a, d) * (onPower(a) ? 1.3 : 1);
    if (d.shield) v /= 2;
    if (v >= d.hp) v += 40; // bitirici vuruş
    return v + (1 - d.hp / d.max) * 10;
  }
  async function aiTurn(side) {
    const T = B[side];
    for (let guard = 0; guard < 12 && B && !B.over && T.ap > 0; guard++) {
      const mine = alive(side).filter(canAct);
      let best = null;
      for (const f of mine) {
        if (f.acted) continue;
        for (const d of targets(f)) {
          if (T.ap >= 2) { const s = attackScore(f, d, 1); if (!best || s > best.s) best = { s, kind: 'atk', f, d }; }
          if (skillReady(f) && NEED_TARGET[f.def.skill]) {
            const k = f.def.skill === 'double' ? 2 : f.def.skill === 'drain' ? 1.35 : 0.9;
            const s = attackScore(f, d, k) - skillAP(f) * 3;
            if (!best || s > best.s) best = { s, kind: 'skill', f, d };
          }
        }
        if (skillReady(f) && f.def.skill === 'heal') {
          const hurt = alive(side).filter(x => (x === f || Math.abs(x.r - f.r) + Math.abs(x.c - f.c) === 1) && x.hp < x.max * 0.55);
          if (hurt.length) { const s = 45; if (!best || s > best.s) best = { s, kind: 'skill', f, d: null }; }
        }
        if (skillReady(f) && f.def.skill === 'shield' && f.hp < f.max * 0.7 && !f.shield && T.ap === skillAP(f)) {
          const s = 12; if (!best || s > best.s) best = { s, kind: 'skill', f, d: null };
        }
      }
      if (best) {
        if (best.kind === 'atk') await doAttack(best.f, best.d); else await doSkill(best.f, best.d);
        if (await checkKO()) return;
        renderAll(); await pace(250);
        continue;
      }
      // Yürü: saldırıya en çok yaklaştıran adım (güç karesini sever)
      let mv = null;
      for (const f of mine) {
        if (f.acted && T.ap < 3) continue;
        const now = stepsToAttack(f);
        for (const p of moveCells(f)) {
          const or = f.r, oc = f.c; f.r = p.r; f.c = p.c;
          const after = stepsToAttack(f);
          const pw = onPower(f) ? 0.6 : 0;
          f.r = or; f.c = oc;
          const gain = now - after + pw + (f.acted ? -0.5 : 0);
          if (gain > 0 && (!mv || gain > mv.g)) mv = { g: gain, f, p };
        }
      }
      if (mv) { await doMove(mv.f, mv.p.r, mv.p.c); renderAll(); await pace(200); continue; }
      // Döndür: bir sırayı kaydırmak saldırı fırsatı açıyorsa
      if (!T.rot && T.ap >= 3 && mine.some(f => !f.acted)) {
        let rb = null;
        for (let r = 0; r < ROWS; r++) for (const d of [1, -1]) {
          const moved = units().filter(f => f.hp > 0 && f.r === r);
          if (!moved.length) continue;
          moved.forEach(f => { f.c = (f.c + d + COLS) % COLS; });
          const ok = mine.filter(f => !f.acted && targets(f).length).length;
          moved.forEach(f => { f.c = (f.c - d + COLS) % COLS; });
          if (ok && (!rb || ok > rb.ok)) rb = { ok, r, d };
        }
        if (rb) { await doRotate(side, rb.r, rb.d); continue; }
      }
      break;
    }
  }

  // ---------- Rehber (ilk savaş) ----------
  async function guide() {
    await G.wait(300);
    if (!B || !B.guided || !B.endTurn) return;
    const n = B.gStep = (B.gStep || 0) + 1;
    if (n === 1) {
      await G.guide('#bd .tok.A.can', 'Küpünü seç', 'Küplerinden birine dokun. Yeşil kareler gidebileceğin yerler.');
      if (!B) return;
      G.coach('#bd', 'Yeşil kareye dokunarak yürü (1 puan). Rakip menzile girince kırmızı çerçeveli olur: dokun ve saldır (2 puan)!', 5200);
    } else if (n === 2) {
      G.coach('#b-hp', 'Her turda 3 hamle puanın var. Puanın bitince tur kendiliğinden biter.', 4200);
    } else if (n === 3) {
      G.coach('#bd .b-arrow', 'Sıranın yanındaki oklar o sırayı döndürür: rakipler de kayar! Menzile çekmek için kullan (1 puan, turda bir kez).', 5200);
      endGuide();
    }
  }
  function endGuide() {
    if (!B || !B.guided) return;
    B.guided = false;
    G.S.tut = Object.assign(G.S.tut || {}, { guided: true, board: true, atk: true, power: true, defend: true, skill: true });
    G.save();
  }

  // ---------- Güç çubuğu ve savunma ----------
  function powerBar(side) {
    return new Promise(res => {
      const el = $('power'), needle = el.querySelector('.power-needle');
      el.hidden = false; $('b-acts').hidden = true;
      if (!B.guided) G.tip('power', '#power', 'İbre yeşilin ORTASINDAYKEN dokun: MÜKEMMEL vuruş!', 4500);
      const combo = B.combo[side];
      $('power-combo').textContent = combo > 1 ? `Kombo ×${combo}` : '';
      el.querySelectorAll('.power-result').forEach(x => x.remove());
      let period = Math.max(600, 1100 - combo * 70);
      if (B.guided && !B.gPower) { B.gPower = true; period = 1700; G.coach('#power', 'İbre YEŞİLİN ORTASINA gelince dokun: MÜKEMMEL vuruş, 1,5 kat hasar!', 3500); }
      const t0 = performance.now();
      let raf, done = false, p = 0;
      const step = (now) => {
        const t = ((now - t0) % (period * 2)) / period;
        p = t <= 1 ? t : 2 - t;
        needle.style.left = (p * 100) + '%';
        if (now - t0 > 4500) return finish();
        raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
      const finish = () => {
        if (done) return; done = true;
        cancelAnimationFrame(raf);
        el.onpointerdown = null; window.removeEventListener('keydown', key);
        const dist = Math.abs(p - 0.5);
        let m, txt;
        if (dist < 0.05) { m = 1.5; txt = 'MÜKEMMEL!'; }
        else if (dist < 0.1) { m = 1.2; txt = 'Harika!'; }
        else if (dist < 0.22) { m = 1; txt = 'İyi'; }
        else { m = 0.75; txt = 'Kaçtı!'; }
        if (B) {
          if (m >= 1.5) { B.combo[side]++; B.perfects[side]++; B.maxCombo = Math.max(B.maxCombo, B.combo[side]); }
          else if (m < 1) B.combo[side] = 0;
        }
        el.appendChild(h('div', 'power-result', txt));
        if (m >= 1.5) { Snd.star(2); window.FX.burstAt(needle, '#2fcf73', 14, 5); }
        else if (m < 1) Snd.lose();
        setTimeout(() => { el.hidden = true; $('b-acts').hidden = false; res({ m, txt }); }, 380);
      };
      const key = (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); finish(); } };
      el.onpointerdown = (e) => { e.preventDefault(); finish(); };
      window.addEventListener('keydown', key);
    });
  }
  function defendQTE() {
    return new Promise(res => {
      const el = $('defend'), btn = $('def-btn'), ring = $('def-ring');
      el.hidden = false; $('b-acts').hidden = true;
      el.querySelectorAll('.def-result').forEach(x => x.remove());
      if (!B.guided) G.tip('defend', '#defend', 'Halka mavi kalkana değdiği AN dokun: hasar yarıya iner!', 4500);
      let T = 750 + Math.random() * 550;
      if (B.guided && !B.gDef) { B.gDef = true; T = 1800; G.coach('#defend', 'Rakip saldırıyor! Halka mavi düğmeye değdiği AN bas: hasar yarıya iner.', 3500); }
      const t0 = performance.now();
      const an = ring.animate([{ transform: 'scale(2.1)', opacity: 0.35 }, { transform: 'scale(1)', opacity: 1, offset: T / (T + 260) }, { transform: 'scale(0.8)', opacity: 0 }], { duration: T + 260, fill: 'forwards' });
      let done = false;
      const finish = (m, txt) => {
        if (done) return; done = true;
        an.cancel(); btn.onpointerdown = null; window.removeEventListener('keydown', key);
        el.querySelector('.def-wrap').appendChild(h('div', 'def-result', txt));
        if (m < 1) { Snd.star(1); window.FX.burstAt(btn, '#2e8cff', 18, 5); }
        setTimeout(() => { el.hidden = true; $('b-acts').hidden = false; res(m); }, 360);
      };
      const tap = () => { const dt = performance.now() - t0 - T; if (Math.abs(dt) <= 170) finish(0.5, 'BLOK!'); else finish(1, dt < 0 ? 'Erken!' : 'Geç!'); };
      const key = (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); tap(); } };
      btn.onpointerdown = (e) => { e.preventDefault(); tap(); };
      window.addEventListener('keydown', key);
      setTimeout(() => finish(1, 'Kaçırdın'), T + 280);
    });
  }

  // ---------- Bitiş ----------
  function end(wonA) {
    if (!B || B.over) return;
    if (B.guided) { G.guideHide(); endGuide(); }
    B.over = true;
    const res = { won: wonA, koA: B.A.list.filter(f => f.hp <= 0).length, sizeA: B.A.list.length, perfects: B.perfects.A, maxCombo: B.maxCombo, crowns: B.crowns, rounds: B.round };
    snap(wonA ? 'kazandı' : 'kaybetti');
    if (G.saveReplay && B.mode !== 'pvp') G.saveReplay({
      title: B.cfg.title || 'Savaş', nameA: B.A.name, nameB: B.B.name, won: wonA, ts: Date.now(), power: B.power,
      units: units().map(f => ({ u: f.uid, s: f.side, id: f.def.id, l: f.lvl, n: f.label, m: f.max, b: f.boss ? 1 : 0 })),
      frames: B.frames, rounds: B.round,
    });
    if (wonA || B.mode === 'pvp') setTimeout(() => window.FX.confetti(), 350);
    const cb = B.cfg.onEnd;
    setTimeout(() => {
      $('battle').hidden = true;
      B = null;
      (wonA ? Snd.win : Snd.lose)();
      cb && cb(res);
    }, 600);
  }

  // Tekrar izleme için her hamleden sonra tahtanın kısa bir kopyası
  function snap(tag) {
    if (!B || B.frames.length > 160) return;
    B.frames.push({ t: $('blog').textContent.slice(0, 90) || tag, s: B.turnSide, u: units().map(f => [f.uid, f.r, f.c, f.hp]) });
  }

  // ---------- Görünüm ----------
  function say(html) { $('blog').innerHTML = `<span>${html}</span>`; }
  const tokEl = (f) => $('bd').querySelector(`.tok[data-u="${f.uid}"]`);
  function anim(f, cls) {
    const el = tokEl(f);
    if (!el) return;
    el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), 400);
  }
  function floatNum(f, txt, heal, big) {
    const el = tokEl(f);
    if (!el) return;
    const x = h('span', 'float' + (heal ? ' heal' : '') + (big ? ' big' : ''), txt);
    el.appendChild(x); setTimeout(() => x.remove(), 900);
  }
  function showInfo(f) {
    const ty = D.TYPES[typeKey(f)], ro = ROLE[typeKey(f)], sk = D.SKILLS[f.def.skill];
    say(`<b>${esc(f.label)}</b> · ${ty.name} ${ro.name} (${ro.range}) · ${f.hp}/${f.max} can · Saldırı ${f.atk} · ${esc(sk.name)}`);
  }

  // Tahta: hücreler + kenar okları + küp taşları. Taşlar konum değişince kayarak gider.
  G.boardHTML = function () {
    let cells = '';
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) cells += `<button class="cell" data-r="${r}" data-c="${c}" style="--r:${r};--c:${c}" aria-label="Kare ${r + 1}-${c + 1}"></button>`;
    let rows = '';
    for (let r = 0; r < ROWS; r++) rows += `<span class="b-rowfx" data-r="${r}" style="--r:${r}"></span>
      <button class="b-arrow l" data-r="${r}" data-d="-1" style="--r:${r}" aria-label="${r + 1}. sırayı sola döndür">‹</button>
      <button class="b-arrow r" data-r="${r}" data-d="1" style="--r:${r}" aria-label="${r + 1}. sırayı sağa döndür">›</button>`;
    return `<div class="b-grid">${cells}${rows}</div>`;
  };
  G.tokenHTML = (f) => `<canvas></canvas><span class="t-hp"><i></i></span><span class="t-lv">${f.lvl}</span><span class="t-ty"></span>`;
  function buildBoard() {
    const bd = $('bd');
    bd.innerHTML = G.boardHTML();
    const grid = bd.querySelector('.b-grid');
    B.power.forEach(p => grid.querySelector(`.cell[data-r="${p.r}"][data-c="${p.c}"]`).classList.add('pw'));
    units().forEach(f => {
      const t = h('button', `tok ${f.side}${f.boss ? ' boss' : ''}${f.holo ? ' holo' : ''}`, G.tokenHTML(f));
      t.dataset.u = f.uid;
      t.setAttribute('aria-label', f.label);
      t.style.setProperty('--tc', D.TYPES[typeKey(f)].color);
      grid.appendChild(t);
      requestAnimationFrame(() => R.drawPuzzle(t.querySelector('canvas'), f.def));
    });
    grid.onclick = (e) => {
      const a = e.target.closest('.b-arrow');
      if (a) return tapRotate(+a.dataset.r, +a.dataset.d);
      const t = e.target.closest('.tok');
      if (t) { const f = units().find(x => x.uid === +t.dataset.u); if (f) return tapCell(f.r, f.c); }
      const c = e.target.closest('.cell');
      if (c) tapCell(+c.dataset.r, +c.dataset.c);
    };
    // takım şeritleri
    ['A', 'B'].forEach(s => {
      const T = B[s];
      $('b-' + s).innerHTML = `<span class="b-owner">${esc(T.name)}</span><span class="b-syn">${(T.syn || []).map(x => `<i title="${esc(x.desc)}">${esc(x.name)}</i>`).join('')}</span><span class="b-left"></span>`;
    });
  }
  function renderAll() {
    if (!B) return;
    const side = B.turnSide, T = B[side], human = isHuman(side) && !B.over && !!B.endTurn, sel = B.sel;
    const grid = $('bd').querySelector('.b-grid');
    if (!grid) return;
    const mv = human && sel && !B.aim ? moveCells(sel) : [];
    const tg = human && sel && (B.aim || (!sel.acted && T.ap >= 2)) ? targets(sel) : [];
    grid.querySelectorAll('.cell').forEach(c => {
      const r = +c.dataset.r, cc = +c.dataset.c;
      c.classList.toggle('mv', mv.some(p => p.r === r && p.c === cc));
      c.classList.toggle('pw', B.power.some(p => p.r === r && p.c === cc));
      c.classList.toggle('super', B.superRound === B.round && B.power.some(p => p.r === r && p.c === cc));
      c.classList.toggle('ice', iceAt(r, cc));
      c.classList.toggle('zone', !!sel && human && !B.aim && ROLE[typeKey(sel)].can(r - sel.r, cc - sel.c));
    });
    units().forEach(f => {
      const t = tokEl(f);
      if (!t) return;
      t.style.setProperty('--r', f.r); t.style.setProperty('--c', f.c);
      t.classList.toggle('ko', f.hp <= 0);
      t.classList.toggle('sel', f === sel);
      t.classList.toggle('tg', tg.includes(f));
      t.classList.toggle('stun', !!f.stun);
      t.classList.toggle('shield', f.shield > 0);
      t.classList.toggle('rage', !!f.rage);
      t.classList.toggle('done', f.side === side && human && f.acted && !(moveCells(f).length && T.ap));
      t.classList.toggle('can', f.side === side && human && canAct(f));
      const pct = Math.max(0, f.hp / f.max * 100);
      const bar = t.querySelector('.t-hp i'); bar.style.width = pct + '%'; bar.classList.toggle('low', pct < 30);
    });
    grid.querySelectorAll('.b-arrow').forEach(a => { a.disabled = !human || T.rot || T.ap < 1 || B.busy; });
    ['A', 'B'].forEach(s => {
      const el = $('b-' + s).querySelector('.b-left');
      if (el) el.innerHTML = B[s].list.map(f => `<i class="${f.hp <= 0 ? 'ko' : ''}" style="--p:${Math.max(0, f.hp / f.max * 100)}%"></i>`).join('');
      $('b-' + s).classList.toggle('turn', side === s && !B.over);
    });
    // hamle puanı
    const ap = T.ap || 0, max = Math.max(AP, ap);
    $('b-hp').innerHTML = `<span>${B.mode === 'pvp' ? esc(T.name) : side === 'A' ? 'Hamle puanın' : 'Rakibin puanı'}</span>` + Array.from({ length: max }, (_, i) => `<i class="${i < ap ? 'on' : ''}"></i>`).join('') + `<b>${ap}</b>`;
    $('b-hp').classList.toggle('enemy-turn', B.mode !== 'pvp' && side === 'B');
    // seçili küp ve yetenek
    const skb = $('act-skill');
    if (sel && human) {
      const sk = D.SKILLS[sel.def.skill], ty = D.TYPES[typeKey(sel)], ro = ROLE[typeKey(sel)];
      $('b-sel').innerHTML = `<b>${esc(sel.label)}</b><small>${ty.name} ${ro.name} · ${ro.range} · ${sel.hp}/${sel.max} can · Saldırı ${sel.atk}${onPower(sel) ? ' · ⚡' : ''}</small><small class="b-pass">${esc(ro.passive)}</small>`;
      skb.disabled = !skillReady(sel) || B.busy;
      skb.innerHTML = `<span class="cost-drop">${skillAP(sel)}</span>${esc(sk.name)}<small>${sel.cd ? `${sel.cd} tur sonra hazır` : sel.acted ? 'Bu tur hamlesini yaptı' : esc(sk.desc)}</small>`;
    } else {
      $('b-sel').innerHTML = human ? '<b>Bir küpüne dokun</b><small>Yürü 1 · Saldır 2 · Döndür 1 puan</small>' : `<b>${B.over ? '' : esc(T.name) + ' oynuyor…'}</b><small>${B.auto ? 'Otomatik savaş açık' : ''}</small>`;
      skb.disabled = true;
      skb.innerHTML = '<span class="cost-drop">–</span>Yetenek<small>Önce küp seç</small>';
    }
    $('act-end').disabled = !human || B.busy;
  }

  $('act-skill').onclick = () => { Snd.click(); useSkill(); };
  $('act-end').onclick = () => { if (B && B.endTurn && !B.busy) { Snd.click(); B.sel = null; B.aim = null; B.endTurn(); } };
  $('b-auto').onclick = () => {
    if (!B) return;
    B.auto = !B.auto; B.fast = B.auto;
    $('b-auto').textContent = B.auto ? 'Oto: Açık' : 'Oto: Kapalı';
    if (B.auto && B.endTurn && B.turnSide === 'A' && !B.busy) { const done = B.endTurn; B.endTurn = null; B.sel = null; renderAll(); aiTurn('A').then(() => done()); }
    renderAll();
  };
  $('b-quit').onclick = () => {
    if (!B) return;
    const pvp = B.mode === 'pvp';
    G.confirm(pvp ? 'Maçı bitir?' : 'Pes et?', pvp ? 'Maç berabere sayılmaz, kimse kazanmaz.' : 'Bu savaşı kaybetmiş sayılırsın.', pvp ? 'Bitir' : 'Pes et', () => {
      if (!B) return;
      if (pvp) { B.over = true; $('battle').hidden = true; B = null; return; }
      end(false);
    });
  };

  // ---------- İfadeler ----------
  function showEmote(side, i) {
    const wrap = $('b-' + side);
    if (!wrap) return;
    wrap.querySelectorAll('.emote').forEach(x => x.remove());
    const [ico, txt] = D.EMOTES[i];
    const el = h('div', 'emote', `<span>${ico}</span><b>${esc(txt)}</b>`);
    wrap.appendChild(el);
    Snd.click();
    setTimeout(() => el.remove(), 1800);
  }
  function botEmote(choices) {
    setTimeout(() => { if (B && !B.over) showEmote('B', G.pickOne(choices)); }, 500 + Math.random() * 700);
  }
  $('emote-pop').innerHTML = D.EMOTES.map(([ico, txt], i) => `<button data-e="${i}" aria-label="${txt}"><span>${ico}</span>${txt}</button>`).join('');
  $('b-emote').onclick = () => { $('emote-pop').hidden = !$('emote-pop').hidden; };
  $('emote-pop').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || !B) return;
    $('emote-pop').hidden = true;
    showEmote('A', +b.dataset.e);
    if (B.mode !== 'pvp' && Math.random() < 0.45) botEmote([0, 1, 2, 3, 4, 5]);
  });
})();
