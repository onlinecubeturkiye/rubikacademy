// Kulüpler ve takas. Rubik Academy'nin Firebase'i üzerinde çalışır (kaClubs, kaTrades).
// Kulüp: üyeler, sohbet, küp bağışı. Takas: kopyası olan bir küpü başka bir küple değiş.
(function () {
  const { $, h, esc, cubeById, D } = G;
  const R = window.Render, Snd = window.Sound;
  const MAX_MEMBERS = 30, NEED = 3;
  const BADGES = ['🧊', '🔥', '⚡', '🌟', '🐉', '👑', '🚀', '🎯', '🍀', '💎', '🦊', '🌈'];
  const fs = () => G.auth && G.auth.db;
  const me = () => G.auth && G.auth.user;
  const ts = () => firebase.firestore.FieldValue.serverTimestamp();
  const code6 = () => Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
  const myName = () => (G.S.name || 'Oyuncu').slice(0, 24);
  const clubRef = (c) => fs().collection('kaClubs').doc(c);
  const tradeCol = () => fs().collection('kaTrades');
  const baseCubes = () => D.CUBES.filter(c => c.rarity !== 'season');
  const dupes = () => D.CUBES.filter(c => (G.S.inv[c.id] || 0) >= 2);

  function errText(e) {
    const m = String((e && (e.code || e.message)) || e);
    if (/permission|PERMISSION/.test(m)) return 'Kulüp sunucusu henüz açılmadı. Biraz sonra tekrar dene.';
    if (/unavailable|network|offline/i.test(m)) return 'İnternet bağlantısı yok.';
    return 'Bir sorun oldu, tekrar dene.';
  }
  function needLogin() {
    if (!G.auth || !G.auth.enabled) { G.notify('Kulüp', '<p>Kulüpler şu an kullanılamıyor.</p>'); return true; }
    if (!me()) {
      G.modal('Kulüp', '<p>Kulüplere katılmak, sohbet etmek ve takas yapmak için RA ID ile giriş yapmalısın.</p>',
        [{ label: 'Vazgeç' }, { label: 'RA ID ile giriş yap', cls: 'btn-yellow', onClick: () => G.auth.openLogin('profile') }]);
      return true;
    }
    return false;
  }
  const loading = (t) => G.modal(t, '<p class="note">Yükleniyor…</p>', [{ label: 'Kapat' }], { replace: true, wide: true });
  const fail = (t, e) => G.modal(t, `<p>${esc(errText(e))}</p>`, [{ label: 'Kapat' }], { replace: true });

  // ---------- Giriş noktası ----------
  G.openClub = async function () {
    Snd.click();
    if (needLogin()) return;
    const c = G.S.club;
    if (c && c.code) return openMine('savas');
    loading('Kulüpler');
    try {
      const snap = await fs().collection('kaClubs').orderBy('ts', 'desc').limit(15).get();
      const list = snap.docs.map(d => Object.assign({ code: d.id }, d.data()));
      const body = G.modal('Kulüpler', `
        <p class="note">Bir kulübe katıl: arkadaşlarınla sohbet et, birbirinize küp bağışlayın ve takas yapın.</p>
        <div class="club-join"><input class="field" id="cl-code" maxlength="6" placeholder="Kulüp kodu" aria-label="Kulüp kodu"><button class="btn btn-small btn-blue" id="cl-join">Katıl</button></div>
        <div class="club-list">${list.length ? list.map(x => `<button class="club-row" data-c="${x.code}"><span class="cl-badge">${BADGES[x.badge] || '🧊'}</span><div><b>${esc(x.name)}</b><small>${esc(x.desc || '')}</small></div><span class="cl-code">${x.code}</span></button>`).join('') : '<p class="note">Henüz kulüp yok. İlkini sen kur!</p>'}</div>`,
        [{ label: 'Kapat' }, { label: 'Kulüp kur', cls: 'btn-yellow', keep: true, onClick: createForm }], { replace: true, wide: true });
      if (!body) return;
      $('cl-join').onclick = () => join(($('cl-code').value || '').trim().toUpperCase());
      body.querySelectorAll('.club-row').forEach(b => (b.onclick = () => join(b.dataset.c)));
    } catch (e) { fail('Kulüpler', e); }
  };

  function createForm() {
    let badge = 0;
    const body = G.modal('Kulüp kur', `
      <input class="field" id="cl-name" maxlength="24" placeholder="Kulüp adı" aria-label="Kulüp adı">
      <input class="field" id="cl-desc" maxlength="120" placeholder="Kısa açıklama (isteğe bağlı)" aria-label="Açıklama">
      <div class="badge-pick">${BADGES.map((b, i) => `<button data-b="${i}" class="${i ? '' : 'on'}">${b}</button>`).join('')}</div>
      <p class="note">Kulüp kurmak 200 jeton. Kulübe en fazla ${MAX_MEMBERS} kişi katılabilir.</p>`,
      [{ label: 'Geri', onClick: G.openClub }, { label: 'Kur (200)', cls: 'btn-yellow', keep: true, onClick: async () => {
        const name = ($('cl-name').value || '').trim();
        if (name.length < 2) return G.toast('Kulüp adı en az 2 harf');
        if (G.S.coins < 200) return G.toast('200 jeton gerekli');
        try {
          const code = code6();
          await clubRef(code).set({ name, desc: ($('cl-desc').value || '').trim().slice(0, 120), badge, owner: me().uid, oName: myName(), ts: ts() });
          G.S.coins -= 200; G.coinFloat(-200);
          await enter(code, name);
        } catch (e) { G.toast(errText(e)); }
      } }], { replace: true });
    if (!body) return;
    body.querySelectorAll('.badge-pick button').forEach(b => (b.onclick = () => { badge = +b.dataset.b; body.querySelectorAll('.badge-pick button').forEach(x => x.classList.toggle('on', x === b)); }));
  }
  async function join(code) {
    if (!/^[A-Z0-9]{6}$/.test(code)) return G.toast('Kod 6 harf/rakam olmalı');
    try {
      const d = await clubRef(code).get();
      if (!d.exists) return G.toast('Bu kodla kulüp bulunamadı');
      const n = (await clubRef(code).collection('m').limit(MAX_MEMBERS + 1).get()).size;
      if (n >= MAX_MEMBERS) return G.toast('Kulüp dolu');
      await enter(code, d.data().name);
    } catch (e) { G.toast(errText(e)); }
  }
  async function enter(code, name) {
    await writeMember(code);
    G.S.club = { code, name }; G.save();
    G.toast(`${name} kulübüne hoş geldin!`);
    openMine('savas');
  }
  const wk = () => Math.floor(G.dayIndex() / 7);
  const cwWins = () => (G.S.cw && G.S.cw.wk === wk() ? G.S.cw.w : 0);
  function writeMember(code) {
    const S = G.S;
    return clubRef(code).collection('m').doc(me().uid).set({ name: myName(), lvl: S.level, tr: S.trophies, title: G.myTitle().slice(0, 24), w: cwWins(), wk: wk(), ts: ts() });
  }
  // Kulüp savaşı: her galibiyet kulübün haftalık hedefine sayılır
  let cwT = 0;
  G.clubWin = function () {
    const S = G.S;
    if (!S.cw || S.cw.wk !== wk()) S.cw = { wk: wk(), w: 0 };
    S.cw.w++;
    if (S.club && S.club.code && me() && fs()) { clearTimeout(cwT); cwT = setTimeout(() => writeMember(S.club.code).catch(() => {}), 4000); }
  };

  // ---------- Kulübüm ----------
  let live = null;
  const stopLive = () => { if (live) { live(); live = null; } };
  async function openMine(tab) {
    stopLive();
    const c = G.S.club;
    loading(c.name);
    let club;
    try {
      const d = await clubRef(c.code).get();
      if (!d.exists) { G.S.club = null; G.save(); G.toast('Kulüp kapatılmış'); return G.openClub(); }
      club = d.data();
      writeMember(c.code).catch(() => {});
    } catch (e) { return fail(c.name, e); }
    const owner = club.owner === me().uid;
    const tabs = [['savas', 'Savaş'], ['uye', 'Üyeler'], ['sohbet', 'Sohbet'], ['bagis', 'Bağış'], ['takas', 'Takas']];
    const body = G.modal(club.name, `
      <div class="club-head"><span class="cl-badge big">${BADGES[club.badge] || '🧊'}</span><div><small>${esc(club.desc || '')}</small><span>Kod: <b>${c.code}</b> · Kurucu: ${esc(club.oName)}</span></div><button class="btn btn-small" id="cl-share">Davet et</button></div>
      <div class="seg club-tabs">${tabs.map(([k, n]) => `<button data-k="${k}" aria-pressed="${k === tab}">${n}</button>`).join('')}</div>
      <div class="club-pane" id="cl-pane"><p class="note">Yükleniyor…</p></div>`,
      [{ label: 'Kapat', onClick: stopLive }, { label: owner ? 'Kulübü kapat' : 'Ayrıl', keep: true, onClick: () => leave(owner) }],
      { replace: true, wide: true, onClose: stopLive });
    if (!body) return;
    $('cl-share').onclick = () => G.share(`Küp Arena'da "${club.name}" kulübüme gel! Kulüp kodu: ${c.code}`);
    body.querySelectorAll('.club-tabs button').forEach(b => (b.onclick = () => {
      body.querySelectorAll('.club-tabs button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      show(b.dataset.k, club, owner);
    }));
    show(tab, club, owner);
  }
  function show(k, club, owner) {
    stopLive();
    const pane = $('cl-pane');
    if (!pane) return;
    pane.innerHTML = '<p class="note">Yükleniyor…</p>';
    ({ savas: paneWar, uye: paneMembers, sohbet: paneChat, bagis: paneDonate, takas: paneTrade })[k](pane, club, owner).catch(e => { if ($('cl-pane')) pane.innerHTML = `<p>${esc(errText(e))}</p>`; });
  }

  async function paneWar(pane) {
    const code = G.S.club.code, w = wk();
    const snap = await clubRef(code).collection('m').limit(MAX_MEMBERS).get();
    const rows = snap.docs.map(d => Object.assign({ id: d.id }, d.data())).map(m => ({ name: m.name, w: m.wk === w ? (m.w || 0) : 0, me: m.id === me().uid }))
      .sort((a, b) => b.w - a.w);
    const total = rows.reduce((a, m) => a + m.w, 0), goal = Math.max(30, snap.size * 8);
    const left = 7 - (G.dayIndex() % 7), got = G.S.cwClaim === w, done = total >= goal;
    pane.innerHTML = `<div class="cw-head"><b>Kulüp Savaşı</b><small>Bu hafta kulüpçe ${goal} galibiyete ulaşın, herkes Kulüp Sandığı alsın! ${left} gün kaldı.</small>
      <span class="bar"><i style="width:${Math.min(100, total / goal * 100)}%"></i></span><span class="cw-num">${total}/${goal} galibiyet</span></div>
      <button class="btn ${done && !got ? 'btn-yellow' : ''}" id="cw-claim" ${done && !got ? '' : 'disabled'}>${got ? 'Sandığı aldın ✓' : done ? 'Kulüp Sandığını aç! (+400 jeton, Usta Paketi)' : 'Hedefe ulaşınca açılır'}</button>
      <h4>Katkılar</h4><div class="cl-mems">${rows.map((m, i) => `<div class="cl-mem${m.me ? ' me' : ''}"><span class="cl-rank">${i + 1}</span><div><b>${esc(m.name)}</b></div><span class="cl-tr">⚔ ${m.w}</span></div>`).join('')}</div>
      <p class="note">Macera, Kule, Arena ve bulmaca galibiyetlerin sayılır. Sayı birkaç saniye gecikebilir.</p>`;
    $('cw-claim').onclick = () => {
      if (G.S.cwClaim === w || !done) return;
      G.S.cwClaim = w; G.addCoins(400); G.S.packs.usta++; G.save();
      window.FX.confetti(140); G.toast('Kulüp Sandığı: +400 jeton ve Usta Paketi!');
      openMine('savas');
    };
  }

  async function paneMembers(pane, club, owner) {
    const code = G.S.club.code;
    const snap = await clubRef(code).collection('m').orderBy('tr', 'desc').limit(MAX_MEMBERS).get();
    const rows = snap.docs.map((d, i) => {
      const m = d.data(), self = d.id === me().uid;
      return `<div class="cl-mem${self ? ' me' : ''}"><span class="cl-rank">${i + 1}</span><div><b>${esc(m.name)}${d.id === club.owner ? ' 👑' : ''}</b><small>${esc(m.title || '')} · Sv ${m.lvl}</small></div><span class="cl-tr">🏆 ${m.tr}</span>${owner && !self ? `<button class="btn btn-small" data-kick="${d.id}">Çıkar</button>` : ''}</div>`;
    }).join('');
    pane.innerHTML = `<p class="note">${snap.size}/${MAX_MEMBERS} üye</p><div class="cl-mems">${rows}</div>`;
    pane.querySelectorAll('[data-kick]').forEach(b => (b.onclick = () => G.confirm('Üyeyi çıkar?', 'Bu oyuncu kulüpten çıkarılır.', 'Çıkar', async () => {
      try { await clubRef(code).collection('m').doc(b.dataset.kick).delete(); } catch (e) { G.toast(errText(e)); }
      openMine('uye');
    })));
  }

  async function paneChat(pane) {
    const code = G.S.club.code;
    pane.innerHTML = `<div class="cl-chat" id="cl-chat"></div><div class="cl-send"><input class="field" id="cl-msg" maxlength="200" placeholder="Mesaj yaz…" aria-label="Mesaj"><button class="btn btn-small btn-blue" id="cl-go">Gönder</button></div>
      <p class="note">Kibar ol. Kişisel bilgilerini (telefon, adres) paylaşma.</p>`;
    const draw = (docs) => {
      const box = $('cl-chat'); if (!box) return;
      box.innerHTML = docs.slice().reverse().map(d => { const m = d.data(); return `<div class="msg${m.u === me().uid ? ' me' : ''}"><b>${esc(m.n)}</b><span>${esc(m.x)}</span></div>`; }).join('') || '<p class="note">İlk mesajı sen yaz!</p>';
      box.scrollTop = box.scrollHeight;
    };
    live = clubRef(code).collection('c').orderBy('ts', 'desc').limit(40).onSnapshot(s => draw(s.docs), () => {});
    const send = async () => {
      const x = ($('cl-msg').value || '').trim().slice(0, 200);
      if (!x) return;
      $('cl-msg').value = '';
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      try { await clubRef(code).collection('c').doc(id).set({ u: me().uid, n: myName(), x, ts: ts() }); } catch (e) { G.toast(errText(e)); }
    };
    $('cl-go').onclick = send;
    $('cl-msg').onkeydown = (e) => { if (e.key === 'Enter') send(); };
  }

  async function paneDonate(pane) {
    const code = G.S.club.code, uid = me().uid;
    const snap = await clubRef(code).collection('r').limit(40).get();
    const mine = snap.docs.find(d => d.id === uid);
    const others = snap.docs.filter(d => d.id !== uid);
    let html = '<h4>Benim isteğim</h4>';
    if (mine) {
      const r = mine.data(), def = cubeById(r.cube);
      html += `<div class="don-row"><canvas data-cv="${r.cube}"></canvas><div><b>${esc(def.name)}</b><small>${r.got}/${r.need} kopya geldi</small><span class="bar"><i style="width:${r.got / r.need * 100}%"></i></span></div>
        <button class="btn btn-small ${r.got ? 'btn-green' : ''}" id="don-claim">${r.got ? `Al (${r.got})` : 'İptal'}</button></div>`;
    } else html += `<p class="note">Takımına bir küp seç, kulüp arkadaşların ${NEED} kopyaya kadar bağışlasın. Kopyalar küpünün seviyesini yükseltir.</p><button class="btn btn-small btn-yellow" id="don-new">Küp iste</button>`;
    html += '<h4>Arkadaşlarının istekleri</h4>';
    html += others.length ? others.map(d => {
      const r = d.data(), def = cubeById(r.cube); if (!def) return '';
      const have = G.S.inv[r.cube] || 0, given = r.gv && r.gv[uid], full = r.got >= r.need;
      return `<div class="don-row"><canvas data-cv="${r.cube}"></canvas><div><b>${esc(r.name)}</b><small>${esc(def.model)} · ${r.got}/${r.need}</small></div>
        <button class="btn btn-small btn-green" data-give="${d.id}" ${given || full || have < 2 ? 'disabled' : ''}>${given ? 'Verdin' : full ? 'Doldu' : have < 2 ? 'Kopyan yok' : 'Bağışla'}</button></div>`;
    }).join('') : '<p class="note">Şu an istek yok.</p>';
    html += '<p class="note">Bağış başına +25 jeton ve +15 XP kazanırsın. Yalnız fazla kopyalarını bağışlayabilirsin.</p>';
    pane.innerHTML = html;
    pane.querySelectorAll('[data-cv]').forEach(c => requestAnimationFrame(() => R.drawPuzzle(c, cubeById(c.dataset.cv))));
    if ($('don-new')) $('don-new').onclick = () => pickCube('Hangi küpü istiyorsun?', baseCubes().filter(c => G.S.inv[c.id]), async (def) => {
      try { await clubRef(code).collection('r').doc(uid).set({ cube: def.id, name: myName(), need: NEED, got: 0, gv: {}, ts: ts() }); } catch (e) { G.toast(errText(e)); }
      openMine('bagis');
    }, () => openMine('bagis'));
    if ($('don-claim')) $('don-claim').onclick = async () => {
      const r = mine.data();
      try {
        await clubRef(code).collection('r').doc(uid).delete();
        for (let i = 0; i < r.got; i++) G.addCube(r.cube);
        if (r.got) { G.toast(`${cubeById(r.cube).model}: +${r.got} kopya!`); window.FX.confetti(60); }
        G.save();
      } catch (e) { G.toast(errText(e)); }
      openMine('bagis');
    };
    pane.querySelectorAll('[data-give]').forEach(b => (b.onclick = async () => {
      const d = others.find(x => x.id === b.dataset.give), r = d.data();
      if ((G.S.inv[r.cube] || 0) < 2) return;
      b.disabled = true;
      try {
        await d.ref.update({ got: firebase.firestore.FieldValue.increment(1), ['gv.' + uid]: true });
        G.S.inv[r.cube]--; G.addCoins(25); G.addXP(15); G.bump('donated'); G.save();
        G.toast('Bağışladın: +25 jeton'); Snd.heal();
      } catch (e) { G.toast(errText(e)); }
      openMine('bagis');
    }));
  }

  // ---------- Takas ----------
  async function paneTrade(pane) {
    const code = G.S.club.code;
    const [open, mine] = await Promise.all([
      tradeCol().where('club', '==', code).where('st', '==', 'open').limit(30).get(),
      tradeCol().where('from', '==', me().uid).limit(20).get(),
    ]);
    pane.innerHTML = tradeHTML(open.docs, mine.docs);
    bindTrades(pane, open.docs, mine.docs, () => openMine('takas'));
  }
  function tradeRow(d, kind) {
    const t = d.data(), give = cubeById(t.give), want = cubeById(t.want);
    if (!give || !want) return '';
    let act = '';
    if (kind === 'mine') {
      if (t.st === 'open') act = `<button class="btn btn-small" data-cancel="${d.id}">İptal</button>`;
      else if (t.st === 'accepted') act = `<button class="btn btn-small btn-green" data-done="${d.id}">Al</button>`;
      else return '';
    } else {
      const ok = (G.S.inv[t.want] || 0) >= 2;
      act = `<button class="btn btn-small btn-green" data-acc="${d.id}" ${ok ? '' : 'disabled'}>${ok ? 'Takas et' : 'Kopyan yok'}</button>`;
    }
    return `<div class="tr-row"><div class="tr-pair"><span><canvas data-cv="${t.give}"></canvas><small>${esc(give.model)}</small></span><b>⇄</b><span><canvas data-cv="${t.want}"></canvas><small>${esc(want.model)}</small></span></div>
      <div class="tr-meta"><small>${kind === 'mine' ? (t.st === 'accepted' ? `${esc(t.bName)} kabul etti!` : `Kod: ${d.id}`) : esc(t.fName)}</small>${act}</div></div>`;
  }
  function tradeHTML(open, mine) {
    const uid = me().uid;
    const others = open.filter(d => d.data().from !== uid);
    const myRows = mine.map(d => tradeRow(d, 'mine')).join('');
    return `<div class="tr-tools"><button class="btn btn-small btn-yellow" id="tr-new">Takas teklifi ver</button><button class="btn btn-small" id="tr-code">Kodla takas</button></div>
      ${myRows ? `<h4>Tekliflerim</h4>${myRows}` : ''}
      <h4>Kulüpteki teklifler</h4>${others.length ? others.map(d => tradeRow(d, 'open')).join('') : '<p class="note">Şu an açık teklif yok.</p>'}
      <p class="note">Teklif verdiğin küpün 1 kopyası teklif kapanana kadar ayrılır. Son kopyanı takas edemezsin.</p>`;
  }
  function bindTrades(pane, open, mine, refresh) {
    pane.querySelectorAll('[data-cv]').forEach(c => requestAnimationFrame(() => R.drawPuzzle(c, cubeById(c.dataset.cv))));
    $('tr-new').onclick = () => newTrade(refresh);
    $('tr-code').onclick = () => codeTrade(refresh);
    pane.querySelectorAll('[data-acc]').forEach(b => (b.onclick = () => accept(open.find(d => d.id === b.dataset.acc), refresh)));
    pane.querySelectorAll('[data-cancel]').forEach(b => (b.onclick = async () => {
      const d = mine.find(x => x.id === b.dataset.cancel);
      try { await d.ref.update({ st: 'cancel' }); G.S.inv[d.data().give] = (G.S.inv[d.data().give] || 0) + 1; G.save(); G.toast('Teklif iptal edildi, küpün geri geldi'); } catch (e) { G.toast(errText(e)); }
      refresh();
    }));
    pane.querySelectorAll('[data-done]').forEach(b => (b.onclick = async () => {
      const d = mine.find(x => x.id === b.dataset.done);
      try { await finish(d); } catch (e) { G.toast(errText(e)); }
      refresh();
    }));
  }
  async function finish(d) {
    const t = d.data();
    await d.ref.update({ st: 'done' });
    G.addCube(t.want); G.bump('trades'); G.save();
    G.toast(`Takas tamam: ${cubeById(t.want).model} senin!`); window.FX.confetti(60);
  }
  function newTrade(refresh) {
    const give = dupes();
    if (!give.length) return G.toast('Takas için en az 2 kopyası olan bir küp gerekli');
    pickCube('Ne vereceksin? (kopyası olan küplerin)', give, (g) => {
      pickCube(`${g.model} karşılığında ne istiyorsun?`, baseCubes().filter(c => c.id !== g.id), async (w) => {
        if ((G.S.inv[g.id] || 0) < 2) return;
        try {
          const id = code6();
          await tradeCol().doc(id).set({ from: me().uid, fName: myName(), club: (G.S.club && G.S.club.code) || '', give: g.id, want: w.id, st: 'open', by: '', bName: '', ts: ts() });
          G.S.inv[g.id]--; G.save();
          G.modal('Teklif hazır', `<p>Kulüp arkadaşların teklifini görebilir. Kulüp dışından biriyle takas için bu kodu paylaş:</p><div class="big-num">${id}</div>`,
            [{ label: 'Tamam', onClick: refresh }, { label: 'Kodu paylaş', cls: 'btn-blue', keep: true, onClick: () => G.share(`Küp Arena takas teklifim: ${g.model} ⇄ ${w.model}. Takas kodu: ${id}`) }], { replace: true });
        } catch (e) { G.toast(errText(e)); refresh(); }
      }, refresh);
    }, refresh);
  }
  function codeTrade(refresh) {
    const body = G.modal('Kodla takas', '<input class="field" id="tr-in" maxlength="6" placeholder="Takas kodu" aria-label="Takas kodu">',
      [{ label: 'Geri', onClick: refresh }, { label: 'Bul', cls: 'btn-yellow', keep: true, onClick: async () => {
        const id = ($('tr-in').value || '').trim().toUpperCase();
        if (!/^[A-Z0-9]{6}$/.test(id)) return G.toast('Kod 6 harf/rakam olmalı');
        try {
          const d = await tradeCol().doc(id).get();
          if (!d.exists || d.data().st !== 'open') return G.toast('Açık bir takas bulunamadı');
          if (d.data().from === me().uid) return G.toast('Bu senin teklifin');
          accept(d, refresh);
        } catch (e) { G.toast(errText(e)); }
      } }], { replace: true });
    if (body) body.querySelector('input').focus();
  }
  function accept(d, refresh) {
    const t = d.data(), give = cubeById(t.give), want = cubeById(t.want);
    if ((G.S.inv[t.want] || 0) < 2) return G.toast(`${want.model} için en az 2 kopya gerekli`);
    G.confirm('Takas edilsin mi?', `${esc(t.fName)} sana ${give.model} verecek, sen ${want.model} vereceksin.`, 'Takas et', async () => {
      try {
        await d.ref.update({ st: 'accepted', by: me().uid, bName: myName() });
        G.S.inv[t.want]--; G.addCube(t.give); G.bump('trades'); G.save();
        G.toast(`${give.model} senin!`); window.FX.confetti(60);
      } catch (e) { G.toast(errText(e)); }
      refresh();
    });
  }
  // Kabul edilmiş tekliflerimi topla (giriş yapınca ve kulüp açılınca)
  G.checkTrades = async function () {
    if (!me() || !fs()) return;
    try {
      const s = await tradeCol().where('from', '==', me().uid).where('st', '==', 'accepted').limit(10).get();
      for (const d of s.docs) await finish(d);
    } catch (e) {}
  };

  function pickCube(title, list, done, back) {
    const body = G.modal(title, `<div class="draft-grid">${list.map(c => `<button class="draft" data-id="${c.id}" style="--rc:${D.RARITIES[c.rarity].color}"><canvas></canvas><span>${esc(c.model)}</span>${G.S.inv[c.id] ? `<i class="dr-n">×${G.S.inv[c.id]}</i>` : ''}</button>`).join('')}</div>`,
      [{ label: 'Geri', onClick: back }], { replace: true, wide: true });
    if (!body) return;
    body.querySelectorAll('.draft').forEach(b => {
      requestAnimationFrame(() => R.drawPuzzle(b.querySelector('canvas'), cubeById(b.dataset.id)));
      b.onclick = () => { G.closeModal(); done(cubeById(b.dataset.id)); };
    });
  }

  function leave(owner) {
    const c = G.S.club;
    G.confirm(owner ? 'Kulübü kapat?' : 'Kulüpten ayrıl?', owner ? 'Kulüp herkes için kapanır.' : 'İstediğin zaman başka bir kulübe katılabilirsin.', owner ? 'Kapat' : 'Ayrıl', async () => {
      stopLive();
      try {
        await clubRef(c.code).collection('m').doc(me().uid).delete();
        await clubRef(c.code).collection('r').doc(me().uid).delete().catch(() => {});
        if (owner) await clubRef(c.code).delete();
      } catch (e) {}
      G.S.club = null; G.save();
      G.toast(owner ? 'Kulüp kapatıldı' : 'Kulüpten ayrıldın');
    });
  }

  // Takas kısayolu (Koleksiyon) kulüp olmadan da çalışır: kodla takas ve kendi tekliflerim
  G.openTrade = async function () {
    Snd.click();
    if (needLogin()) return;
    if (G.S.club && G.S.club.code) return openMine('takas');
    loading('Takas');
    try {
      const mine = (await tradeCol().where('from', '==', me().uid).limit(20).get()).docs;
      const body = G.modal('Takas', tradeHTML([], mine) + '<p class="note">Bir kulübe katılırsan kulüpteki teklifleri de görürsün.</p>', [{ label: 'Kapat' }], { replace: true, wide: true });
      if (body) bindTrades(body, [], mine, G.openTrade);
    } catch (e) { fail('Takas', e); }
  };

  $('club-btn').onclick = G.openClub;
  $('trade-btn').onclick = G.openTrade;
})();
