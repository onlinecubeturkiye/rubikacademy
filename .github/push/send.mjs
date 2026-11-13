/* Rubik Academy — Web Push gönderici (GitHub Actions'ta birkaç dakikada bir çalışır)
   - broadcasts/{id}           pushed == false ve zamanı gelmiş (at || ts) → tüm abonelere
   - users/{uid}/notifications pushed == false ve zamanı gelmiş           → o kullanıcının cihazlarına
   Gönderilen belge pushed = true yapılır; süresi dolmuş abonelikler (404/410) silinir.
   Gizli anahtarlar: FIREBASE_SERVICE_ACCOUNT (JSON), VAPID_PRIVATE_KEY */
import admin from "firebase-admin";
import webpush from "web-push";

const VAPID_PUBLIC = "BMwVZRwQzVDgRKtUfF6J-WCwdXdLLT4rVXaatCqkbFDV2x147sPH99Kzp9PXktSjvYEs3Y-Vw0nU8wZrLogH1Q4";
const SA = process.env.FIREBASE_SERVICE_ACCOUNT, PRIV = process.env.VAPID_PRIVATE_KEY;
if (!SA || !PRIV) { console.log("Gizli anahtarlar (FIREBASE_SERVICE_ACCOUNT / VAPID_PRIVATE_KEY) tanımlı değil; atlanıyor."); process.exit(0); }

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(SA)) });
webpush.setVapidDetails("https://rubikacademy.fun", VAPID_PUBLIC, PRIV);
const db = admin.firestore();
const now = Date.now();
const ms = (t) => (t && t.toMillis ? t.toMillis() : 0);

const subs = (await db.collection("pushsubs").get()).docs.map((d) => {
    let sub = null; try { sub = JSON.parse(d.get("sub") || "null"); } catch (e) {}
    return { ref: d.ref, sub, uid: d.get("uid") || "", rem: d.get("rem") || "" };
}).filter((s) => s.sub && s.sub.endpoint);
console.log("abone:", subs.length);

const dead = new Set();
async function sendTo(list, payload) {
    let ok = 0;
    await Promise.all(list.map(async (s) => {
        if (dead.has(s.ref.path)) return;
        try { await webpush.sendNotification(s.sub, JSON.stringify(payload), { TTL: 86400, urgency: "high" }); ok++; }
        catch (e) {
            if (e.statusCode === 404 || e.statusCode === 410) { dead.add(s.ref.path); await s.ref.delete().catch(() => {}); }
            else console.log("hata", e.statusCode || "", (e.body || e.message || "").toString().slice(0, 120));
        }
    }));
    return ok;
}

// Herkese açık duyurular
for (const d of (await db.collection("broadcasts").where("pushed", "==", false).get()).docs) {
    const at = ms(d.get("at")) || ms(d.get("ts"));
    if (at > now) continue;   // planlı, zamanı gelmedi
    // comp-KOD: yeni ev yarışması duyurusu (oda sahibinin tarayıcısı yazar) → bildirim o yarışmayı açar
    const isComp = /^comp-[A-Z0-9]{5}$/.test(d.id), code = isComp ? d.id.slice(5) : "";
    const n = await sendTo(subs, isComp ? { title: "Yeni ev yarışması 🏠", body: d.get("text") || "", tag: "c:" + code, url: "/icerikler/ev-yarismasi?ev=" + code }
        : { title: "Rubik Academy", body: d.get("text") || "", tag: "b:" + at, url: "/" });
    await d.ref.update({ pushed: true });
    console.log("duyuru", d.id, "→", n);
}

// Kişisel bildirimler (yalnız aboneliği olan kullanıcılar)
const byUid = {};
subs.forEach((s) => { if (s.uid) (byUid[s.uid] = byUid[s.uid] || []).push(s); });
for (const uid of Object.keys(byUid)) {
    for (const d of (await db.collection("users").doc(uid).collection("notifications").where("pushed", "==", false).get()).docs) {
        const at = ms(d.get("at")) || ms(d.get("ts"));
        if (at > now) continue;
        const n = await sendTo(byUid[uid], { title: "Rubik Academy", body: d.get("text") || "", tag: "n:" + d.id, url: "/" });
        await d.ref.update({ pushed: true });
        console.log("bildirim", uid, d.id, "→", n);
    }
}
// Hatırlatıcılar (abonelikte rem: "d" = günün karıştırması). Yeni ev yarışması artık tüm abonelere gider.
// Durum config/remind belgesinde tutulur: aynı hatırlatma iki kez gitmesin
const remRef = db.collection("config").doc("remind");
const rem = (await remRef.get()).data() || {};
const tr = new Date(now + 3 * 3600e3); // Türkiye saati (UTC+3)
const today = tr.toISOString().slice(0, 10);
const wants = (k) => subs.filter((s) => String(s.rem || "").split(",").includes(k));
// 1) Günün karıştırması: 19:00'dan sonra, bugün henüz çözmeyen üyelere
if (tr.getUTCHours() >= 19 && rem.d !== today) {
    const dn = String(Math.floor(Date.UTC(tr.getUTCFullYear(), tr.getUTCMonth(), tr.getUTCDate()) / 86400000));
    const list = wants("d").filter((s) => s.uid), byU = {};
    list.forEach((s) => { (byU[s.uid] = byU[s.uid] || []).push(s); });
    let n = 0;
    for (const uid of Object.keys(byU)) {
        const done = (await db.collection("days").doc(dn).collection("times").doc(uid).get()).exists;
        if (!done) n += await sendTo(byU[uid], { title: "Günün karıştırması 📅", body: "Bugünkü karıştırmayı henüz çözmedin. Sıralamada yerini al!", tag: "d:" + today, url: "/icerikler/gunluk" });
    }
    rem.d = today;
    console.log("günlük hatırlatma →", n);
}
// 2) Yeni ev yarışması (yedek): duyurusu yazılmamış, son 2 saatte açılmış odalar → herkese
const seen = new Set(rem.c || []);
const fresh = (await db.collection("comps").where("st", "==", "lobby").get()).docs
    .filter((d) => !seen.has(d.id) && now - ms(d.get("ts")) < 2 * 3600e3);
for (const d of fresh) {
    seen.add(d.id);
    const bRef = db.collection("broadcasts").doc("comp-" + d.id);
    if ((await bRef.get()).exists) continue; // site zaten duyurdu (yukarıda gönderildi)
    const text = "🏠 Yeni ev yarışması: " + (d.get("name") || "Ev yarışması") + ". Katılmak için Ev Yarışması sayfasına gel, kod: " + d.id;
    const n = await sendTo(subs, { title: "Yeni ev yarışması 🏠", body: text, tag: "c:" + d.id, url: "/icerikler/ev-yarismasi?ev=" + d.id });
    await bRef.set({ text, ts: admin.firestore.Timestamp.now(), pushed: true });
    console.log("ev yarışması", d.id, "→", n);
}
rem.c = Array.from(seen).slice(-60);
await remRef.set(rem);
console.log("bitti; silinen abonelik:", dead.size);
