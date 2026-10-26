/* =========================================================
   ANİMASYONLU ALGORİTMA OYNATICI (alg-player.js)
   Algoritma sayfalarındaki case kartlarına "▶ İzle" butonu ekler.
   Tıklanınca cubing.js (TwistyPlayer, MPL-2.0, /js/vendor/cubing/) ilk kez
   yüklenir ve case 3B küpte adım adım oynatılır. Sarı üstte, yeşil önde.
========================================================= */
(function () {
    var V = "20261180";
    var PUZ = {
        oll: "3x3x3", pll: "3x3x3", twolook_algos: "3x3x3", coll: "3x3x3", wv: "3x3x3", roux_algos: "3x3x3",
        cll: "2x2x2", eg1: "2x2x2", eg2: "2x2x2", "ortega-oll": "2x2x2", "ortega-pbl": "2x2x2",
        alg4: "4x4x4", alg5: "5x5x5", bld: "3x3x3", oh_algos: "3x3x3", zbll: "3x3x3", megaminx_algos: "megaminx", sq1_algos: "square1"
    };
    // Küpün başlangıç yönü: site sarı üstte çalışır; göz bağlı (3BLD) standart olarak beyaz üstte
    var SETUP = { bld: "", megaminx_algos: "", sq1_algos: "" };
    var TXT = {
        tr: { btn: "İzle", title: "Algoritmayı izle", close: "Kapat", load: "Yükleniyor…", err: "Oynatıcı yüklenemedi.", hint: "Oynat, durdur veya adım adım ilerle. Küpü sürükleyerek döndürebilirsin." },
        en: { btn: "Watch", title: "Watch the algorithm", close: "Close", load: "Loading…", err: "The player could not be loaded.", hint: "Play, pause or step through. Drag the cube to rotate it." },
        fr: { btn: "Voir", title: "Voir l'algorithme", close: "Fermer", load: "Chargement…", err: "Impossible de charger le lecteur.", hint: "Lis, mets en pause ou avance pas à pas. Fais glisser le cube pour le tourner." },
        ru: { btn: "Смотреть", title: "Смотреть алгоритм", close: "Закрыть", load: "Загрузка…", err: "Не удалось загрузить плеер.", hint: "Запусти, поставь на паузу или иди по шагам. Перетащи кубик, чтобы повернуть его." },
        de: { btn: "Ansehen", title: "Algorithmus ansehen", close: "Schließen", load: "Wird geladen…", err: "Der Player konnte nicht geladen werden.", hint: "Abspielen, pausieren oder Schritt für Schritt. Zieh am Würfel, um ihn zu drehen." },
        ar: { btn: "شاهد", title: "شاهد الخوارزمية", close: "إغلاق", load: "جارٍ التحميل…", err: "تعذّر تحميل المشغّل.", hint: "شغّل أو أوقف أو تقدّم خطوة بخطوة. اسحب المكعب لتدويره." }
    };
    function t(k) { var l = "tr"; try { l = localStorage.getItem("site-lang") || "tr"; } catch (e) {} return (TXT[l] || TXT.tr)[k]; }
    function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
    var page = window.PAGE_ID || "", puzzle = PUZ[page];
    if (!puzzle) return;

    var lib = null;
    function loadLib() {
        if (!lib) lib = import("/js/vendor/cubing/twisty.js?v=" + V).catch(function (e) { lib = null; throw e; });
        return lib;
    }
    // Site notasyonundaki parantezler, ’ gibi işaretler ve "↔" temizlenir
    function clean(a) {
        a = String(a).replace(/[’‘`´]/g, "'").replace(/[↔+]/g, " ");
        // Square-1: cubing.js "(1, 0) / (3, 3) /" biçimini ister
        if (puzzle === "square1") a = a.replace(/\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)/g, " ($1, $2) ").replace(/\//g, " / ");
        return a.replace(/\s+/g, " ").trim();
    }

    var modal = null, player = null;
    function close() {
        if (!modal) return;
        modal.classList.remove("open");
        if (player) { try { player.pause(); } catch (e) {} }
        document.removeEventListener("keydown", onKey);
        if (modal._ret) { try { modal._ret.focus(); } catch (e) {} }
    }
    function onKey(e) { if (e.key === "Escape") close(); }
    function build() {
        modal = document.createElement("div");
        modal.className = "ap-modal";
        modal.innerHTML = '<div class="ap-box" role="dialog" aria-modal="true" aria-labelledby="apTitle">' +
            '<button type="button" class="ap-close" aria-label="' + esc(t("close")) + '">✕</button>' +
            '<h3 id="apTitle"></h3><div class="ap-stage"><p class="ap-msg"></p></div>' +
            '<code class="ap-alg" dir="ltr"></code><p class="ap-hint"></p></div>';
        document.body.appendChild(modal);
        modal.addEventListener("click", function (e) { if (e.target === modal || e.target.closest(".ap-close")) close(); });
    }
    function open(card, btn) {
        if (!modal) build();
        modal._ret = btn;
        var name = String(card.getAttribute("data-case") || "").split("::").pop();
        var algEl = card.querySelector(".case-alg");
        var alg = clean(algEl ? algEl.textContent : "");
        modal.querySelector("#apTitle").textContent = name;
        modal.querySelector(".ap-alg").textContent = alg;
        modal.querySelector(".ap-hint").textContent = t("hint");
        modal.querySelector(".ap-close").setAttribute("aria-label", t("close"));
        var msg = modal.querySelector(".ap-msg");
        msg.textContent = t("load"); msg.hidden = false;
        modal.classList.add("open");
        document.addEventListener("keydown", onKey);
        modal.querySelector(".ap-close").focus();
        loadLib().then(function (m) {
            if (!player) {
                player = new m.TwistyPlayer({
                    puzzle: puzzle, background: "none", controlPanel: "bottom-row", hintFacelets: "none",
                    experimentalSetupAnchor: "end", experimentalSetupAlg: page in SETUP ? SETUP[page] : "z2", tempoScale: 1.4
                });
                player.className = "ap-player";
                modal.querySelector(".ap-stage").appendChild(player);
            }
            msg.hidden = true;
            player.alg = alg;
            player.timestamp = 0;
            setTimeout(function () { try { player.play(); } catch (e) {} }, 350);
        }).catch(function () { msg.textContent = t("err"); });
    }

    function decorate(root) {
        Array.prototype.forEach.call(root.querySelectorAll(".case-card"), function (card) {
            if (card.getAttribute("data-ap") === "1" || !card.querySelector(".case-alg")) return;
            card.setAttribute("data-ap", "1");
            var b = document.createElement("button");
            b.type = "button";
            b.className = "alg-play-btn";
            b.title = t("title");
            b.setAttribute("aria-label", t("title"));
            b.textContent = "▶ " + t("btn");
            var edit = card.querySelector(".alg-edit-btn");
            if (edit) edit.parentNode.insertBefore(b, edit);
            else (card.querySelector(".case-body") || card).appendChild(b);
        });
    }
    function relabel() {
        Array.prototype.forEach.call(document.querySelectorAll(".alg-play-btn"), function (b) {
            b.textContent = "▶ " + t("btn"); b.title = t("title"); b.setAttribute("aria-label", t("title"));
        });
    }
    function init() {
        var wrap = document.getElementById("subsetsWrap");
        if (!wrap) return;
        wrap.addEventListener("click", function (e) {
            var b = e.target.closest(".alg-play-btn");
            if (b) { e.stopPropagation(); e.preventDefault(); open(b.closest(".case-card"), b); }
        }, true);
        wrap.addEventListener("keydown", function (e) {
            var b = e.target.closest(".alg-play-btn");
            if (b && (e.key === "Enter" || e.key === " ")) { e.stopPropagation(); e.preventDefault(); open(b.closest(".case-card"), b); }
        }, true);
        decorate(wrap);
        new MutationObserver(function () { decorate(wrap); }).observe(wrap, { childList: true, subtree: true });
        window.addEventListener("storage", relabel);
        document.addEventListener("site-lang-change", relabel);
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
})();
