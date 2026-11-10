// Öğretici: Küpi ekrandaki öğeleri parlatarak oyunu anlatır. Savaşta da kısa ipuçları verir.
(function () {
  const { $ } = G;
  const Snd = window.Sound;
  let steps = [], idx = 0, done = null;

  function placeHole(el) {
    const hole = $('tut-hole');
    if (!el) return;
    const r = el.getBoundingClientRect(), pad = 6;
    Object.assign(hole.style, { left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + pad * 2 + 'px', height: r.height + pad * 2 + 'px' });
  }
  function place() {
    if (guideEl) return placeOn(guideEl);
    const st = steps[idx];
    const hole = $('tut-hole'), bubble = $('tut-bubble');
    $('tut-title').textContent = st.title;
    $('tut-msg').textContent = st.text;
    $('tut-step').textContent = `${idx + 1}/${steps.length}`;
    $('tut-next').textContent = idx === steps.length - 1 ? (st.last || 'Başlayalım!') : 'İleri';
    const el = st.sel && document.querySelector(st.sel);
    if (!el) {
      hole.className = 'tut-hole none';
      bubble.style.top = '30%';
      return;
    }
    el.scrollIntoView({ block: 'nearest' });
    const r = el.getBoundingClientRect(), pad = 6;
    hole.className = 'tut-hole';
    Object.assign(hole.style, { left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + pad * 2 + 'px', height: r.height + pad * 2 + 'px' });
    // Balon, parlayan yerin altına sığarsa alta, sığmazsa üstüne
    const bh = bubble.offsetHeight || 150;
    const below = r.bottom + 16 + bh < innerHeight - 10;
    bubble.style.top = (below ? r.bottom + 16 : Math.max(10, r.top - 16 - bh)) + 'px';
  }
  function show() {
    const st = steps[idx];
    if (st.before) st.before();
    requestAnimationFrame(() => requestAnimationFrame(place));
    const b = $('tut-bubble');
    b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
  }
  G.tour = function (list, onDone) {
    steps = list; idx = 0; done = onDone || null;
    $('tut').classList.remove('guide');
    $('tut-skip').hidden = false; $('tut-next').hidden = false;
    $('tut').hidden = false;
    show();
  };
  // Parlayan çerçeve, hedef öğe hareket etse ya da sayfa kaysa da onu takip eder
  setInterval(() => {
    if ($('tut').hidden) return;
    if (guideEl) placeOn(guideEl); else if (steps[idx]) placeHole(steps[idx].sel && document.querySelector(steps[idx].sel));
  }, 250);
  function finish() {
    $('tut').hidden = true;
    const cb = done; done = null;
    if (cb) cb();
  }
  $('tut-next').onclick = () => { Snd.click(); if (guideEl) return finishGuide(); if (++idx >= steps.length) finish(); else show(); };
  $('tut-skip').onclick = () => { Snd.click(); finish(); };
  addEventListener('resize', () => { if (!$('tut').hidden) place(); });
  G.inTour = () => !$('tut').hidden && !guideEl;

  // ---------- Etkileşimli rehber: yalnız gösterilen yere dokunulabilir ----------
  let guideEl = null, guideSel = '', guideRes = null;
  function placeOn(el) {
    const hole = $('tut-hole'), bubble = $('tut-bubble');
    if (!el || !document.body.contains(el)) { el = document.querySelector(guideSel); if (!el) return; guideEl = el; }
    const r = el.getBoundingClientRect(), pad = 6;
    hole.className = 'tut-hole';
    Object.assign(hole.style, { left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + pad * 2 + 'px', height: r.height + pad * 2 + 'px' });
    const bh = bubble.offsetHeight || 130;
    const above = r.top - 16 - bh > 8;
    bubble.style.top = (above ? r.top - 16 - bh : Math.min(innerHeight - bh - 8, r.bottom + 16)) + 'px';
  }
  function filter(e) {
    if (!guideEl) return;
    const t = e.target;
    if ($('tut-bubble').contains(t)) return;
    const target = document.querySelector(guideSel);
    if (target && target.contains(t)) { if (e.type === 'pointerdown') finishGuide(); return; }
    e.stopPropagation(); e.preventDefault();
  }
  ['pointerdown', 'click', 'touchstart'].forEach(ev => document.addEventListener(ev, filter, { capture: true, passive: false }));
  function finishGuide() {
    if (!guideEl) return;
    guideEl = null; guideSel = '';
    $('tut').hidden = true; $('tut').classList.remove('guide');
    const r = guideRes; guideRes = null;
    if (r) r();
  }
  G.guideHide = finishGuide;
  // sel: dokunulacak yer. ok: true ise "Tamam" düğmesiyle geçilir (bilgi adımı).
  G.guide = function (sel, title, text, ok) {
    const el = document.querySelector(sel);
    if (!el) return Promise.resolve();
    if (guideEl) finishGuide();
    guideEl = el; guideSel = sel;
    $('tut-title').textContent = title;
    $('tut-msg').textContent = text;
    $('tut-step').textContent = '';
    $('tut-skip').hidden = true;
    $('tut-next').hidden = !ok;
    $('tut-next').textContent = 'Tamam';
    $('tut').classList.add('guide');
    $('tut').hidden = false;
    const b = $('tut-bubble'); b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
    requestAnimationFrame(() => placeOn(el));
    return new Promise(res => (guideRes = res));
  };

  // Ana ekran turu
  G.startTour = function (first) {
    G.show('home');
    G.tour([
      { title: 'Merhaba, ben Küpi!', text: 'Küp Arena’da küp toplar, savaşır ve 3B küp çözersin. Sana her şeyi kısaca göstereyim.' },
      { sel: '#showcase', title: 'Vitrin küpün', text: 'Bu senin küpün. Dokununca koleksiyonundaki diğer küpleri gösterir.' },
      { sel: '#home-play', title: 'OYNA', text: 'Macera buradan başlar: 6 dünya, 36 bölüm ve her dünyanın sonunda bir boss. Boss’u yenince nadir bir küp kazanırsın!' },
      { sel: '#tab-home .home-side', title: 'Günlük ödüller', text: 'Görevler, günlük giriş hediyesi ve Şans Çarkı burada. Her gün uğra, bedava ödül topla. Kırmızı nokta “ödül hazır” demek.' },
      { sel: '#chest-row', title: 'Küp kutuları', text: 'Her galibiyette bir küp kutusu kazanırsın: kartondan şeffaf vitrin kutusuna kadar. Açmaya başla, süre dolunca içinden küpler ve jetonlar çıksın. Aynı anda tek kutu açılır, beklemek istemezsen jetonla hemen açabilirsin.' },
      { sel: '#chest-home', title: 'Şampiyon Kutusu', text: 'Rakibin her küpünü yendiğinde 1 taç kazanırsın. Günde 10 taç topla, bedava Şampiyon Kutusu’nu aç!' },
      { sel: '#season-bar', title: 'Sezon Yolu', text: 'Oynadıkça XP kazanır, Sezon Yolu’nda ilerlersin. Sonunda Mitik bir küp seni bekliyor!' },
      { sel: '[data-tab=shop]', title: 'Mağaza', text: 'Paket açıp yeni küpler bulursun. Her 3 saatte bir bedava paket var.' },
      { sel: '[data-tab=inv]', title: 'Koleksiyon', text: 'En iyi 3 küpünü takıma koy ve jetonla güçlendir. Aynı küpten tekrar çıkarsa seviyesi kendiliğinden artar.' },
      { sel: '[data-tab=arena]', title: 'Arena', text: 'Kupa kazan, Bronz’dan Efsane’ye rütbe atla! Her 6 saatte bir mod değişir. Arkadaşınla aynı telefonda da oynayabilirsin.' },
      { sel: '[data-tab=base]', title: 'Atölye', text: 'Kendi atölyeni kur! Jeton Madeni sen yokken jeton biriktirir, Laboratuvar küplerini güçlendirir. Küp çözmeyi seviyorsan Küp Masası da burada.' },
      { sel: '#home-play', title: 'Hazırsın!', text: first ? 'Sana hoş geldin hediyesi olarak bir paket veriyorum. Açtıktan sonra OYNA’ya bas ve ilk savaşına gir!' : 'OYNA’ya bas ve maceraya devam et!', last: first ? 'Paketi aç' : 'Tamam' },
    ], () => {
      G.S.seenIntro = true; G.S.tut = G.S.tut || {}; G.S.tut.tour = true; G.save();
      if (first) G.openPack(G.D.PACKS[0]);
      else G.checkLogin();
    });
  };

  // Savaş ipuçları: her biri bir kez gösterilir, oyunu durdurmaz.
  let coachT = 0;
  G.coach = function (sel, text, ms = 3800) {
    const el = sel && document.querySelector(sel), c = $('coach');
    $('coach-msg').textContent = text;
    c.hidden = false;
    c.style.animation = 'none'; void c.offsetWidth; c.style.animation = '';
    const r = el ? el.getBoundingClientRect() : { top: innerHeight / 2 };
    c.style.top = Math.max(10, r.top - 70) + 'px';
    clearTimeout(coachT);
    coachT = setTimeout(() => (c.hidden = true), ms);
  };
  G.coachHide = () => { clearTimeout(coachT); $('coach').hidden = true; };
  G.tip = function (key, sel, text, ms) {
    const S = G.S;
    S.tut = S.tut || {};
    if (S.tut[key]) return;
    S.tut[key] = true; G.save();
    G.coach(sel, text, ms);
  };
})();
