/* =========================================================
   DERSLER (lessons.js) — /icerikler/dersler
   Başlangıç yönteminden CFOP'a adım adım dersler: açıklama, 3B örnek (cubing.js),
   ipucu, "uygula" bağlantıları ve "Dersi tamamladım". İlerleme: localStorage "lessons-v1"
   (kişisel veri: hesapla senkronlanır, hesapsızken sayfa yenilenince sıfırlanır).
========================================================= */
(function () {
    var KEY = "lessons-v1", V = "20261194";
    var A = "/icerikler/algoritmalar/";
    // demo: { alg, setup: "z2" (sarı üst) | "" (beyaz üst), end: true = case başta görünür, sonda çözülür }
    var COURSE = [
        { t: "Başlangıç yöntemi", d: "Küpü ilk kez çözmek için 8 ders. Hiç algoritma bilmeden başla.", lessons: [
            { id: "b1", t: "Küpü tanı ve notasyon", min: 10,
              learn: ["Merkez, kenar ve köşe parçaları", "R, L, U, D, F, B hamleleri", "' (ters) ve 2 (çift) işaretleri"],
              body: ["Küpte 6 merkez, 12 kenar ve 8 köşe vardır. <b>Merkezler hiç yer değiştirmez</b>: beyaz merkezin olduğu yüz her zaman beyaz yüzdür.",
                     "Hamleler yüzün baş harfiyle yazılır: <b>R</b> sağ, <b>L</b> sol, <b>U</b> üst, <b>D</b> alt, <b>F</b> ön, <b>B</b> arka. Harf tek başına o yüzü, yüze bakarken <b>saat yönünde</b> çevir demektir.",
                     "<b>R'</b> ters (saat yönünün tersi), <b>R2</b> iki kez çevir demektir. Aşağıdaki örnekte en çok kullanılan dörtlü hamleyi izle."],
              demo: { alg: "R U R' U'", setup: "", end: false }, tip: "R U R' U' hamlesini 6 kez arka arkaya yaparsan küp başladığı yere döner. Dene!",
              go: [["📘 Başlangıç rehberi: notasyon", "/icerikler/baslangic#notasyon"], ["🧊 Sanal küpte dene", "/icerikler/sanal-kup"]] },
            { id: "b2", t: "Beyaz artı", min: 15,
              learn: ["Beyaz kenarları beyaz merkezin etrafına toplamak", "Kenarın yan rengini merkezle eşleştirmek"],
              body: ["İlk hedef üst yüzde <b>beyaz bir artı</b> yapmak. Önce beyaz kenarları beyaz merkezin etrafına getir.",
                     "Artının her kenarının diğer rengi, yanındaki merkezin rengiyle aynı olmalı. Değilse o kenarı aşağı indir, alt katmanı doğru merkezin altına çevir ve tekrar yukarı al.",
                     "Bu adımda algoritma ezberlemen gerekmez; hamleleri deneyerek parçaların nasıl hareket ettiğini öğrenirsin."],
              tip: "Acele etme: artıyı yaparken önceki kenarları bozmamaya çalış. Zamanla 8 hamlenin altında yapabilirsin.",
              go: [["📘 Rehber: beyaz artı", "/icerikler/baslangic#adim1"], ["✚ Cross antrenörü", A + "antrenor?set=cross"]] },
            { id: "b3", t: "Beyaz köşeler", min: 15,
              learn: ["Köşeyi doğru yuvanın altına getirmek", "R U R' U' ile köşeyi yerine oturtmak"],
              body: ["Beyaz artıyı alta çevir. Beyaz rengi olan bir köşeyi, gideceği yuvanın tam altına (sağ ön) getir.",
                     "Sonra <b>R U R' U'</b> hamlesini köşe yerine doğru oturana kadar tekrarla (en fazla 5 kez).",
                     "4 köşeyi de bitirince ilk katman tamamlanır."],
              demo: { alg: "R U R' U' R U R' U' R U R' U'", setup: "z2", end: true }, tip: "Köşe yukarıda yanlış yerdeyse önce R U R' U' ile aşağı indir.",
              go: [["📘 Rehber: beyaz köşeler", "/icerikler/baslangic#adim2"]] },
            { id: "b4", t: "Orta katman", min: 20,
              learn: ["Kenarı sağa ya da sola yerleştiren iki algoritma"],
              body: ["Üst katmanda sarı olmayan bir kenar bul, ön yüzdeki rengi ön merkezle eşleşecek şekilde çevir.",
                     "Kenar <b>sağa</b> gidecekse: <code>U R U' R' U' F' U F</code>, <b>sola</b> gidecekse: <code>U' L' U L U F U' F'</code>.",
                     "4 kenar yerleşince ilk iki katman bitmiş olur."],
              demo: { alg: "U R U' R' U' F' U F", setup: "z2", end: true }, tip: "Kenar orta katmanda ters duruyorsa, aynı algoritmayla önce üste çıkar.",
              go: [["📘 Rehber: orta katman", "/icerikler/baslangic#adim3"]] },
            { id: "b5", t: "Sarı artı", min: 10,
              learn: ["Nokta, L ve çizgi durumları", "F R U R' U' F'"],
              body: ["Üstte sarı kenarlara bak: nokta, L şekli ya da çizgi görürsün.",
                     "Çizgiyi yatay, L'yi sol arkaya bakacak şekilde tut ve <code>F R U R' U' F'</code> yap. Artı oluşana kadar tekrarla."],
              demo: { alg: "F R U R' U' F'", setup: "z2", end: true },
              go: [["📘 Rehber: sarı artı", "/icerikler/baslangic#adim4"]] },
            { id: "b6", t: "Sarı kenarları eşleştir", min: 10,
              learn: ["Kenarları yan merkezlerle eşleştirmek"],
              body: ["Üstü çevirerek en az iki kenarın yan rengini merkezlerle eşleştir.",
                     "Eşleşen iki kenar arka ve sağdaysa <code>R U R' U R U2 R' U</code> yap; gerekirse tekrarla."],
              demo: { alg: "R U R' U R U2 R' U", setup: "z2", end: true },
              go: [["📘 Rehber", "/icerikler/baslangic"]] },
            { id: "b7", t: "Sarı köşeleri yerleştir", min: 10,
              learn: ["Köşeleri doğru yerlerine taşımak"],
              body: ["Doğru yerde olan bir köşe bul (renkleri yönü yanlış olsa da o yuvaya ait). Onu sağ öne al.",
                     "<code>U R U' L' U R' U' L</code> ile diğer üç köşeyi döndür; hepsi yerine gelene kadar tekrarla."],
              demo: { alg: "U R U' L' U R' U' L", setup: "z2", end: true },
              go: [["📘 Rehber", "/icerikler/baslangic"]] },
            { id: "b8", t: "Sarı köşeleri çevir — küp çözüldü!", min: 15,
              learn: ["R' D' R D ile köşe çevirmek", "Küpü baştan sona çözmek"],
              body: ["Küpü ters çevir, sarı yüz altta kalsın. Sağ alt öndeki köşe sarı alta bakana kadar <code>R' D' R D</code> yap.",
                     "Sonra <b>yalnız alt katmanı</b> çevirerek sıradaki köşeyi aynı yere getir ve tekrarla. Küp ara aşamada bozuk görünür, merak etme; son köşede her şey yerine oturur. 🎉"],
              demo: { alg: "R' D' R D R' D' R D", setup: "", end: true }, tip: "Bu adımda küpü döndürme; sadece alt katmanı çevir.",
              go: [["📅 Günün karıştırmasını çöz", "/icerikler/gunluk"]] }
        ] },
        { t: "Hızlanma: CFOP", d: "Başlangıç yöntemini bitirdiysen, 1 dakikanın altına ve ötesine.", lessons: [
            { id: "c1", t: "Daha iyi cross", min: 15,
              learn: ["Artıyı altta yapmak", "İncelemede planlamak"],
              body: ["Hızlı çözücüler artıyı <b>altta</b> yapar; böylece sonraki adımları görmek kolaylaşır.",
                     "15 saniyelik incelemede artının tamamını planlamaya çalış. Çoğu artı 8 hamlede çözülebilir."],
              tip: "Cross antrenörü her karıştırmanın en kısa çözümünü gösterir; kendi çözümünle karşılaştır.",
              go: [["✚ Cross antrenörü", A + "antrenor?set=cross"], ["✚ X-Cross antrenörü", A + "antrenor?set=xcross"]] },
            { id: "c2", t: "Sezgisel F2L", min: 30,
              learn: ["Köşe + kenar çiftini birlikte yerleştirmek", "Temel 3 hamlelik eklemeler"],
              body: ["F2L'de beyaz köşeyi ve ona ait orta katman kenarını <b>çift</b> yapıp tek seferde yerleştirirsin.",
                     "En temel ekleme: çift hazırsa <code>U R U' R'</code> ya da <code>R U R'</code>. Diğer durumlar bunlara indirgenir."],
              demo: { alg: "U R U' R'", setup: "z2", end: true },
              go: [["🧩 Sezgisel F2L rehberi", "/icerikler/f2l"], ["⏱️ F2L antrenörü", A + "antrenor?set=f2l"]] },
            { id: "c3", t: "2-Look OLL", min: 30,
              learn: ["Önce sarı artı, sonra 7 durumla sarı yüz"],
              body: ["Tam OLL 57 algoritmadır; başlarken iki adıma bölünür: sarı artı (3 durum) + köşeler (7 durum).",
                     "En çok kullanılan köşe algoritması <b>Sune</b>: <code>R U R' U R U2 R'</code>."],
              demo: { alg: "R U R' U R U2 R'", setup: "z2", end: true },
              go: [["🟨 2-Look OLL", A + "2look-oll"], ["🎯 Antrenörde çalış", A + "antrenor?set=2look-2lo"]] },
            { id: "c4", t: "2-Look PLL", min: 30,
              learn: ["Önce köşeler, sonra kenarlar"],
              body: ["Son katmanın parçalarını iki adımda yerleştir: köşeler (2 algoritma), kenarlar (4 algoritma).",
                     "Köşe değişimi için T perm: <code>R U R' U' R' F R2 U' R' U' R U R' F'</code>."],
              demo: { alg: "R U R' U' R' F R2 U' R' U' R U R' F'", setup: "z2", end: true },
              go: [["🔄 2-Look PLL", A + "2look-pll"], ["🎯 Antrenörde çalış", A + "antrenor?set=2look-2lp"]] },
            { id: "c5", t: "Tam PLL (21)", min: 60,
              learn: ["21 PLL'i tanımak ve çözmek"],
              body: ["Tam PLL ile son adım tek algoritmaya iner. Önce sık çıkanları (Ua, Ub, T, Aa, Ab) öğren.",
                     "Tanıma çok önemli: yan yüzlerdeki <b>far</b> ve <b>blok</b>lara bakarak durumu 1 saniyenin altında tanımaya çalış."],
              go: [["📋 PLL algoritmaları", A + "pll"], ["🎯 PLL antrenörü", A + "antrenor?set=pll"]] },
            { id: "c6", t: "Tam OLL (57)", min: 120,
              learn: ["57 OLL'i gruplar halinde öğrenmek"],
              body: ["Tam OLL'ü gruplar halinde öğren: önce artı olan 7 durum (zaten biliyorsun), sonra benzer şekilliler.",
                     "Günde 2-3 yeni OLL yeterli; antrenör zorlandıklarını daha sık sorar."],
              go: [["📋 OLL algoritmaları", A + "oll"], ["🎯 OLL antrenörü", A + "antrenor?set=oll"]] },
            { id: "c7", t: "Yarışmaya hazırsın", min: 10,
              learn: ["Ortalama (Ao5) mantığı", "Günlük pratik ve yarışmalar"],
              body: ["Yarışmalarda 5 çözüm yapılır, en iyi ve en kötü atılır, kalan üçün ortalaması (<b>Ao5</b>) alınır.",
                     "Her gün <b>Günün karıştırması</b>nı çöz, ev yarışmalarına katıl, rekorlarını profilinde biriktir."],
              go: [["📅 Günün karıştırması", "/icerikler/gunluk"], ["🏠 Ev yarışması", "/icerikler/ev-yarismasi"], ["🥇 Rekor tablosu", "/icerikler/rekorlar"]] }
        ] }
    ];
    var ALL = []; COURSE.forEach(function (c, ci) { c.lessons.forEach(function (l) { l.ci = ci; ALL.push(l); }); });

    function $(id) { return document.getElementById(id); }
    function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"); }
    function load() { try { return JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { return {}; } }
    function save(o) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} }
    function member() { return !!(window.Account && Account.user && Account.user()); }

    var lib = null, player = null;
    function twisty() { if (!lib) lib = import("/js/vendor/cubing/twisty.js?v=" + V).catch(function (e) { lib = null; throw e; }); return lib; }

    function current() { var m = /#(\w+)/.exec(location.hash); var id = m && m[1]; return ALL.filter(function (l) { return l.id === id; })[0] || null; }

    function renderList() {
        var done = load(), n = ALL.filter(function (l) { return done[l.id]; }).length, pct = Math.round(n / ALL.length * 100);
        var cur = current();
        $("lsProg").innerHTML = '<div class="ls-pb"><i style="width:' + pct + '%"></i></div><span>' + n + ' / ' + ALL.length + ' ders · %' + pct + '</span>' +
            (member() ? "" : '<small>İlerlemenin kaydedilmesi için <a href="#" id="lsLogin">giriş yap</a>.</small>');
        var lg = $("lsLogin"); if (lg) lg.onclick = function (e) { e.preventDefault(); Account.openLogin && Account.openLogin(); };
        $("lsList").innerHTML = COURSE.map(function (c, ci) {
            return '<div class="ls-sec"><h2>' + esc(c.t) + '</h2><p>' + esc(c.d) + '</p>' + c.lessons.map(function (l, i) {
                return '<a class="ls-item' + (done[l.id] ? " done" : "") + (cur && cur.id === l.id ? " cur" : "") + '" href="#' + l.id + '"><span class="ls-no">' + (done[l.id] ? "✓" : (i + 1)) + '</span><span class="ls-t">' + esc(l.t) + '<small>~' + l.min + ' dk</small></span><span class="ls-go">→</span></a>';
            }).join("") + '</div>';
        }).join("");
    }
    function renderLesson() {
        var l = current(), box = $("lsLesson");
        document.body.classList.toggle("ls-reading", !!l);
        if (!l) { box.hidden = true; if (player) try { player.pause(); } catch (e) {} renderList(); return; }
        var done = load(), i = ALL.indexOf(l), prev = ALL[i - 1], next = ALL[i + 1];
        box.hidden = false;
        box.innerHTML = '<a class="ls-back" href="#">← Tüm dersler</a>' +
            '<div class="ls-kicker">' + esc(COURSE[l.ci].t) + ' · Ders ' + (i + 1) + ' / ' + ALL.length + ' · ~' + l.min + ' dk</div>' +
            '<h2>' + esc(l.t) + '</h2>' +
            '<div class="ls-learn"><b>Bu derste</b><ul>' + l.learn.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + '</ul></div>' +
            l.body.map(function (p) { return "<p>" + p + "</p>"; }).join("") +
            (l.demo ? '<div class="ls-demo"><div class="ls-stage" id="lsStage"><span>3B örnek yükleniyor…</span></div><code dir="ltr">' + esc(l.demo.alg) + '</code></div>' : "") +
            (l.tip ? '<div class="ls-tip">💡 ' + esc(l.tip) + '</div>' : "") +
            '<div class="ls-go-row">' + l.go.map(function (g) { return '<a class="ls-btn" href="' + esc(g[1]) + '">' + esc(g[0]) + '</a>'; }).join("") + '</div>' +
            '<div class="ls-nav">' + (prev ? '<a class="ls-btn ghost" href="#' + prev.id + '">← ' + esc(prev.t) + '</a>' : '<span></span>') +
            '<button type="button" class="ls-btn ' + (done[l.id] ? "ghost" : "main") + '" id="lsDone">' + (done[l.id] ? "✓ Tamamlandı" : "Dersi tamamladım ✓") + '</button>' +
            (next ? '<a class="ls-btn ghost" href="#' + next.id + '">' + esc(next.t) + ' →</a>' : '<span></span>') + '</div>';
        $("lsDone").onclick = function () {
            var o = load();
            if (o[l.id]) delete o[l.id]; else o[l.id] = Date.now();
            save(o);
            if (o[l.id] && next) location.hash = next.id; else renderLesson();
        };
        renderList();
        window.scrollTo({ top: box.getBoundingClientRect().top + window.scrollY - 80, behavior: "smooth" });
        if (l.demo) twisty().then(function (m) {
            var st = $("lsStage"); if (!st || current() !== l) return;
            // Her derste yeni oynatıcı: aynı oynatıcıyı başka kaba taşımak küpü iki kez çizdiriyor
            if (player) { try { player.pause(); } catch (e) {} if (player.parentNode) player.parentNode.removeChild(player); }
            player = new m.TwistyPlayer({ puzzle: "3x3x3", background: "none", controlPanel: "bottom-row", hintFacelets: "none", tempoScale: 1.2,
                experimentalSetupAnchor: l.demo.end ? "end" : "start", experimentalSetupAlg: l.demo.setup || "", alg: l.demo.alg });
            player.className = "ls-player";
            st.innerHTML = ""; st.appendChild(player);
            setTimeout(function () { try { player.play(); } catch (e) {} }, 400);
        }).catch(function () { var st = $("lsStage"); if (st) st.innerHTML = "<span>3B örnek yüklenemedi.</span>"; });
    }
    function init() {
        renderList(); renderLesson();
        window.addEventListener("hashchange", renderLesson);
        if (window.Account && Account.onChange) Account.onChange(function () { renderList(); });
        document.addEventListener("account-synced", function () { renderList(); if (current()) renderLesson(); });
    }
    window.RA_LESSONS = { count: ALL.length, ids: ALL.map(function (l) { return l.id; }) };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
