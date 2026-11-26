/* Rubik Academy — bildirim gönderici: tarayıcılar (Web Push) + Android uygulaması (Firebase Cloud Messaging) (GitHub Actions'ta birkaç dakikada bir çalışır)
   - broadcasts/{id}           pushed == false ve zamanı gelmiş (at || ts) → tüm abonelere
   - users/{uid}/notifications pushed == false ve zamanı gelmiş           → o kullanıcının cihazlarına
   Gönderilen belge pushed = true yapılır; süresi dolmuş abonelikler (404/410) silinir.
   Gizli anahtarlar: FIREBASE_SERVICE_ACCOUNT (JSON), VAPID_PRIVATE_KEY */
import admin from "firebase-admin";
import webpush from "web-push";

const VAPID_PUBLIC = "BMwVZRwQzVDgRKtUfF6J-WCwdXdLLT4rVXaatCqkbFDV2x147sPH99Kzp9PXktSjvYEs3Y-Vw0nU8wZrLogH1Q4";
const SA = process.env.FIREBASE_SERVICE_ACCOUNT, PRIV = process.env.VAPID_PRIVATE_KEY;
if (!SA) { console.log("FIREBASE_SERVICE_ACCOUNT tanımlı değil; atlanıyor."); process.exit(0); }
if (!PRIV) console.log("VAPID_PRIVATE_KEY yok: tarayıcı bildirimleri atlanır, yalnız Android uygulaması (FCM) gönderilir.");

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(SA)) });
if (PRIV) webpush.setVapidDetails("https://rubikacademy.fun", VAPID_PUBLIC, PRIV);
const db = admin.firestore();
const now = Date.now();
const ms = (t) => (t && t.toMillis ? t.toMillis() : 0);

// Okuma kotası: önce gönderilecek bir şey var mı bak (boş sorgu 1 okuma); aboneler yalnız gerekirse okunur
const pendB = (await db.collection("broadcasts").where("pushed", "==", false).get()).docs;
// tek sorgu için koleksiyon-grubu dizini gerekir; yoksa (null) abonelerin kutuları tek tek okunur
let pendN = null;
try { pendN = (await db.collectionGroup("notifications").where("pushed", "==", false).get()).docs; }
catch (e) { console.log("koleksiyon-grubu dizini yok, kişi kişi okunacak:", String(e.message || "").slice(0, 80)); }
const remRef = db.collection("config").doc("remind");
const rem = (await remRef.get()).data() || {};
const seen = new Set(rem.c || []);
const fresh = (await db.collection("comps").where("st", "==", "lobby").get()).docs
    .filter((d) => !seen.has(d.id) && now - ms(d.get("ts")) < 2 * 3600e3);
// Çekilişler: yaklaşan (çekiliş zamanı gelmemiş) olanlar — genelde 0-3 belge
const gwSeen = new Set(rem.g || []);
const gws = (await db.collection("giveaways").where("drawAt", ">", admin.firestore.Timestamp.fromMillis(now)).get()).docs
    .filter((d) => !d.get("test"));
// yeni açılan (son 3 saat): herkese bir kez
const gwNew = gws.filter((d) => !gwSeen.has("n:" + d.id) && now - ms(d.get("ts")) < 3 * 3600e3 && ms(d.get("closeAt")) > now);
// çekilişe 15-75 dk kaldı: katılanlara bir kez hatırlatma (saatlik çalışma bu aralığı bir kez yakalar)
const gwRem = gws.filter((d) => !gwSeen.has("r:" + d.id) && ms(d.get("drawAt")) - now > 15 * 60e3 && ms(d.get("drawAt")) - now <= 75 * 60e3);
const due = (d) => (ms(d.get("at")) || ms(d.get("ts"))) <= now;
if (!pendB.some(due) && pendN && !pendN.some(due) && !fresh.length && !gwNew.length && !gwRem.length) { console.log("gönderilecek bir şey yok"); process.exit(0); }
const subs = (await db.collection("pushsubs").get()).docs.map((d) => {
    let sub = null; try { sub = JSON.parse(d.get("sub") || "null"); } catch (e) {}
    return { ref: d.ref, sub, uid: d.get("uid") || "", rem: d.get("rem") || "" };
}).filter((s) => s.sub && s.sub.endpoint && (s.sub.fcm || PRIV));
console.log("abone:", subs.length);

const dead = new Set();
async function sendTo(list, payload) {
    let ok = 0;
    await Promise.all(list.map(async (s) => {
        if (dead.has(s.ref.path)) return;
        // Android uygulaması: Firebase Cloud Messaging (yalnız veri; bildirimi uygulama kurar)
        if (s.sub.fcm) {
            try {
                await admin.messaging().send({ token: s.sub.fcm, android: { priority: "high", ttl: 86400000 },
                    data: { title: String(payload.title || ""), body: String(payload.body || ""), url: String(payload.url || "/"), tag: String(payload.tag || "ra") } });
                ok++;
            } catch (e) {
                const c = (e && (e.code || (e.errorInfo && e.errorInfo.code))) || "";
                if (/registration-token-not-registered|invalid-registration-token|invalid-argument/.test(c)) { dead.add(s.ref.path); await s.ref.delete().catch(() => {}); }
                else console.log("fcm hata", c, String(e.message || "").slice(0, 120));
            }
            return;
        }
        try { await webpush.sendNotification(s.sub, JSON.stringify(payload), { TTL: 86400, urgency: "high" }); ok++; }
        catch (e) {
            if (e.statusCode === 404 || e.statusCode === 410) { dead.add(s.ref.path); await s.ref.delete().catch(() => {}); }
            else console.log("hata", e.statusCode || "", (e.body || e.message || "").toString().slice(0, 120));
        }
    }));
    return ok;
}

// pushed: false → true işlemle (canlı gönderici live.mjs ile aynı bildirimi iki kez göndermesin)
async function claim(ref) {
    try { return await db.runTransaction(async (t) => { const d = await t.get(ref); if (!d.exists || d.get("pushed") !== false) return false; t.update(ref, { pushed: true }); return true; }); }
    catch (e) { return false; }
}

// Herkese açık duyurular
for (const d of pendB) {
    const at = ms(d.get("at")) || ms(d.get("ts"));
    if (at > now) continue;   // planlı, zamanı gelmedi
    // comp-KOD: yeni ev yarışması duyurusu (oda sahibinin tarayıcısı yazar) → bildirim o yarışmayı açar
    if (!(await claim(d.ref))) continue;
    const isComp = /^comp-[A-Z0-9]{5}$/.test(d.id), code = isComp ? d.id.slice(5) : "";
    const n = await sendTo(subs, isComp ? { title: "Yeni ev yarışması 🏠", body: d.get("text") || "", tag: "c:" + code, url: "/icerikler/ev-yarismasi?ev=" + code }
        : { title: "Rubik Academy", body: d.get("text") || "", tag: "b:" + at, url: "/" });
    console.log("duyuru", d.id, "→", n);
}

// Kişisel bildirimler (yalnız aboneliği olan kullanıcılar)
const byUid = {};
subs.forEach((s) => { if (s.uid) (byUid[s.uid] = byUid[s.uid] || []).push(s); });
if (!pendN) {
    pendN = [];
    for (const uid of Object.keys(byUid)) pendN.push(...(await db.collection("users").doc(uid).collection("notifications").where("pushed", "==", false).get()).docs);
}
for (const d of pendN) {
    const uid = d.ref.parent.parent ? d.ref.parent.parent.id : "";
    {
        const at = ms(d.get("at")) || ms(d.get("ts"));
        if (at > now) continue;
        if (!(await claim(d.ref))) continue;
        // aboneliği olmayanın bildirimi de "gönderildi" sayılır: bekleyenler birikip her çalışmada yeniden okunmasın
        if (!uid || !byUid[uid]) continue;
        const m = /rubikacademy\.fun(\/[^\s]*)/.exec(String(d.get("text") || ""));
        const n = await sendTo(byUid[uid], { title: "Rubik Academy", body: d.get("text") || "", tag: "n:" + d.id, url: m ? m[1] : "/" });
        console.log("bildirim", uid, d.id, "→", n);
    }
}
// Yeni ev yarışması yedek duyurusu.
// Durum config/remind belgesinde tutulur: aynı hatırlatma iki kez gitmesin
const tr = new Date(now + 3 * 3600e3); // Türkiye saati (UTC+3)
const today = tr.toISOString().slice(0, 10);
const wants = (k) => subs.filter((s) => String(s.rem || "").split(",").includes(k));
// 2) Yeni ev yarışması (yedek): duyurusu yazılmamış, son 2 saatte açılmış odalar → herkese
for (const d of fresh) {
    seen.add(d.id);
    const bRef = db.collection("broadcasts").doc("comp-" + d.id);
    if ((await bRef.get()).exists) continue; // site zaten duyurdu (yukarıda gönderildi)
    const text = "🏠 Yeni ev yarışması: " + (d.get("name") || "Ev yarışması") + ". Katılmak için Ev Yarışması sayfasına gel, kod: " + d.id;
    const n = await sendTo(subs, { title: "Yeni ev yarışması 🏠", body: text, tag: "c:" + d.id, url: "/icerikler/ev-yarismasi?ev=" + d.id });
    await bRef.set({ text, ts: admin.firestore.Timestamp.now(), pushed: true });
    console.log("ev yarışması", d.id, "→", n);
}
// 3) Çekiliş: yeni çekiliş duyurusu (herkese) ve çekilişten ~1 saat önce katılanlara hatırlatma
for (const d of gwNew) {
    gwSeen.add("n:" + d.id);
    const t = d.get("title") || "Çekiliş", pr = d.get("prize") || "";
    const n = await sendTo(subs, { title: "Yeni çekiliş 🎁", body: t + (pr && pr !== t ? ": " + pr : "") + ". Katıl, kazanma şansı yakala!", tag: "g:" + d.id, url: "/icerikler/cekilis?id=" + d.id });
    console.log("yeni çekiliş", d.id, "→", n);
}
for (const d of gwRem) {
    gwSeen.add("r:" + d.id);
    const uids = new Set((await d.ref.collection("e").select().get()).docs.map((x) => x.id));
    const mine = subs.filter((x) => x.uid && uids.has(x.uid));
    const min = Math.max(5, Math.round((ms(d.get("drawAt")) - now) / 60e3 / 5) * 5);
    const n = mine.length ? await sendTo(mine, { title: "Çekiliş yaklaşıyor ⏰", body: "“" + (d.get("title") || "Çekiliş") + "” çekilişine yaklaşık " + min + " dakika kaldı. Kazanırsan 2 dakika içinde onaylaman gerekiyor, sayfada ol!", tag: "gr:" + d.id, url: "/icerikler/cekilis?id=" + d.id }) : 0;
    console.log("çekiliş hatırlatma", d.id, "katılan", uids.size, "→", n);
}
rem.g = Array.from(gwSeen).slice(-80);
rem.c = Array.from(seen).slice(-60);
await remRef.set(rem);
console.log("bitti; silinen abonelik:", dead.size);
