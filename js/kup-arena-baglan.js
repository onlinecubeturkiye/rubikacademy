/* =========================================================
   KÜP ARENA'YA BAĞLAN (/kup-arena/baglan) — kup-arena-baglan.js
   Oyun (Android WebView) Google girişini kendi içinde yapamaz; bu sayfayı telefonun tarayıcısında
   ?donus=kuparena://baglan ile açar. Kullanıcı Google ile giriş yapar, Google'ın idToken'ı
   kuparena://baglan?gid=<idToken> adresiyle oyuna geri yollanır.
   - Yalnız "kuparena://baglan" ile başlayan dönüş adresi kabul edilir (açık yönlendirme yok)
   - Ayrı, bellekte tutulan bir Firebase örneği kullanılır: sitenin oturumu değişmez,
     belge hiçbir yerde saklanmaz ve loglanmaz
========================================================= */
import { initializeApp, initializeAuth, inMemoryPersistence, browserSessionPersistence, browserPopupRedirectResolver,
    setPersistence, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut }
    from "/js/vendor/firebase/firebase-auth.js?v=20261229";

const $ = (id) => document.getElementById(id);
const cfg = window.RA_FIREBASE || {};
const RX = /^kuparena:\/\/baglan(?:[/?#]|$)/;
const params = new URLSearchParams(location.search);
// Yönlendirme dönüşünde (signInWithRedirect) adres sessionStorage'da değil URL'de kalır
const donus = params.get("donus") || "";

function msg(t, kind) { const m = $("kbMsg"); m.textContent = t || ""; m.className = "kb-msg" + (kind ? " " + kind : ""); }
function errText(e) {
    const c = (e && e.code) || "";
    if (c === "auth/popup-closed-by-user" || c === "auth/cancelled-popup-request") return "Giriş penceresi kapatıldı.";
    if (c === "auth/network-request-failed") return "İnternet bağlantısı yok gibi görünüyor. Bağlantını kontrol et.";
    if (c === "auth/unauthorized-domain") return "Bu adresten Google girişine izin verilmiyor. Siteyi rubikacademy.fun adresinden aç.";
    if (c === "auth/user-disabled") return "Bu hesap devre dışı bırakılmış.";
    if (c === "auth/too-many-requests") return "Çok fazla deneme yapıldı. Biraz bekleyip tekrar dene.";
    return "Google ile giriş yapılamadı.";
}

if (!RX.test(donus)) {
    // Dönüş adresi yok ya da geçersiz: masaüstünden girildi → tanıtım
    $("kbSub").textContent = "Bu sayfa Küp Arena oyununun içinden açılır. Google ile giriş yapmak için oyundaki “Google ile devam et”e dokun.";
} else {
    $("kbGo").hidden = false;
    $("kbGame").href = donus; // hata olursa: oyuna (gid'siz) dön
    const app = initializeApp({ apiKey: cfg.apiKey, authDomain: cfg.authDomain, projectId: cfg.projectId, appId: cfg.appId }, "kuparena-baglan");
    const auth = initializeAuth(app, { persistence: inMemoryPersistence, popupRedirectResolver: browserPopupRedirectResolver });
    try { auth.languageCode = "tr"; } catch (e) {}
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    const back = (idToken) => {
        const url = donus + (donus.indexOf("?") < 0 ? "?" : "&") + "gid=" + encodeURIComponent(idToken);
        signOut(auth).catch(() => {}); // site tarafında oturum kalmasın
        $("kbGo").hidden = true; $("kbGame").hidden = true;
        const a = $("kbBack"); a.href = url; a.hidden = false;
        msg("Giriş yapıldı. Küp Arena açılıyor… Açılmazsa yukarıdaki düğmeye dokun.", "ok");
        location.href = url;
    };
    const fail = (e) => {
        $("kbGo").disabled = false; $("kbGame").hidden = false; // "Google ile giriş yap" tekrar denemek için açık kalır
        msg(errText(e), "bad");
    };
    const useResult = (r) => {
        const cred = r && GoogleAuthProvider.credentialFromResult(r);
        if (!cred || !cred.idToken) throw { code: "no-token" };
        back(cred.idToken);
    };

    // Açılır pencere engellendiyse yönlendirme ile giriş yapılmış olabilir: sonucu al
    if (sessionStorage.getItem("ka-redirect")) {
        sessionStorage.removeItem("ka-redirect");
        msg("Giriş tamamlanıyor…");
        setPersistence(auth, browserSessionPersistence)
            .then(() => getRedirectResult(auth))
            .then((r) => { if (r) useResult(r); else msg(""); })
            .catch(fail);
    }

    const go = () => {
        $("kbGo").disabled = true; $("kbGame").hidden = true; msg("Google penceresi açılıyor…");
        signInWithPopup(auth, provider).then(useResult).catch((e) => {
            const c = (e && e.code) || "";
            if (c === "auth/popup-blocked" || c === "auth/operation-not-supported-in-this-environment") {
                // Açılır pencere engellendi → aynı sekmede Google'a git, dönüşte sonucu al
                msg("Google'a yönlendiriliyor…");
                sessionStorage.setItem("ka-redirect", "1");
                setPersistence(auth, browserSessionPersistence).then(() => signInWithRedirect(auth, provider)).catch(fail);
                return;
            }
            fail(e);
        });
    };
    $("kbGo").onclick = go;
}
