/* Rubik Academy — CANLI bildirim gönderici (site kapalıyken de bildirim gider)
   GitHub Actions'ta ~5,5 saat açık kalır, Firestore'u anlık dinler (onSnapshot) ve yeni bildirimi
   saniyeler içinde gönderir; süresi bitmeden kendini yeniden başlatır (workflow_dispatch).
   - broadcasts (pushed == false)                 → tüm abonelere
   - users/{uid}/notifications (pushed == false)  → o kullanıcının cihazlarına (tarayıcı + Android)
   Aynı bildirim iki kez gitmesin diye "pushed" alanı işlemle (transaction) önce true yapılır, sonra gönderilir.
   Gizli anahtarlar: FIREBASE_SERVICE_ACCOUNT (JSON), VAPID_PRIVATE_KEY */
import admin from "firebase-admin";
import webpush from "web-push";

const VAPID_PUBLIC = "BMwVZRwQzVDgRKtUfF6J-WCwdXdLLT4rVXaatCqkbFDV2x147sPH99Kzp9PXktSjvYEs3Y-Vw0nU8wZrLogH1Q4";
const SA = process.env.FIREBASE_SERVICE_ACCOUNT, PRIV = process.env.VAPID_PRIVATE_KEY;
const RUN_MS = (Number(process.env.RUN_MIN) || 340) * 60000, END = Date.now() + RUN_MS;
if (!SA) { console.log("FIREBASE_SERVICE_ACCOUNT tanımlı değil; çıkılıyor."); process.exit(0); }
if (!PRIV) console.log("UYARI: VAPID_PRIVATE_KEY yok → tarayıcı bildirimleri gönderilemez (yalnız Android uygulaması).");

const sa = JSON.parse(SA);
const cred = admin.credential.cert(sa);
admin.initializeApp({ credential: cred });
if (PRIV) webpush.setVapidDetails("https://rubikacademy.fun", VAPID_PUBLIC, PRIV);
const db = admin.firestore();
const ms = (t) => (t && t.toMillis ? t.toMillis() : typeof t === "number" ? t : 0);
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

/* "notifications" alt koleksiyonlarının hepsini tek sorguyla dinlemek için koleksiyon-grubu dizini gerekir: yoksa açılır */
async function ensureIndex() {
    try {
        const { access_token } = await cred.getAccessToken();
        const base = `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/collectionGroups/notifications/fields/pushed`;
        const cur = await (await fetch(base, { headers: { Authorization: "Bearer " + access_token } })).json();
        const idx = (cur.indexConfig && cur.indexConfig.indexes) || [];
        if (idx.some((i) => i.queryScope === "COLLECTION_GROUP")) return true;
        const body = { indexConfig: { indexes: [
            { queryScope: "COLLECTION", fields: [{ fieldPath: "pushed", order: "ASCENDING" }] },
            { queryScope: "COLLECTION", fields: [{ fieldPath: "pushed", order: "DESCENDING" }] },
            { queryScope: "COLLECTION_GROUP", fields: [{ fieldPath: "pushed", order: "ASCENDING" }] }] } };
        const r = await fetch(base + "?updateMask=indexConfig", { method: "PATCH", headers: { Authorization: "Bearer " + access_token, "Content-Type": "application/json" }, body: JSON.stringify(body) });
        log("koleksiyon-grubu dizini istendi:", r.status, r.ok ? "(hazırlanması birkaç dakika sürebilir)" : (await r.text()).slice(0, 200));
        return false;
    } catch (e) { log("dizin kontrolü yapılamadı:", e.message); return false; }
}

/* ---------- aboneler (canlı) ---------- */
let subs = [];
db.collection("pushsubs").onSnapshot((snap) => {
    subs = snap.docs.map((d) => {
        let sub = null; try { sub = JSON.parse(d.get("sub") || "null"); } catch (e) {}
        return { ref: d.ref, sub, uid: d.get("uid") || "" };
    }).filter((s) => s.sub && s.sub.endpoint && (s.sub.fcm || PRIV));
    log("abone:", subs.length);
}, (e) => log("pushsubs dinlenemedi:", e.message));

const dead = new Set();
async function sendTo(list, payload) {
    let ok = 0;
    await Promise.all(list.map(async (s) => {
        if (dead.has(s.ref.path)) return;
        if (s.sub.fcm) {
            try {
                await admin.messaging().send({ token: s.sub.fcm, android: { priority: "high", ttl: 86400000 },
                    data: { title: String(payload.title || ""), body: String(payload.body || ""), url: String(payload.url || "/"), tag: String(payload.tag || "ra") } });
                ok++;
            } catch (e) {
                const c = (e && (e.code || (e.errorInfo && e.errorInfo.code))) || "";
                if (/registration-token-not-registered|invalid-registration-token|invalid-argument/.test(c)) { dead.add(s.ref.path); await s.ref.delete().catch(() => {}); }
                else log("fcm hata", c, String(e.message || "").slice(0, 120));
            }
            return;
        }
        try { await webpush.sendNotification(s.sub, JSON.stringify(payload), { TTL: 86400, urgency: "high" }); ok++; }
        catch (e) {
            if (e.statusCode === 404 || e.statusCode === 410) { dead.add(s.ref.path); await s.ref.delete().catch(() => {}); }
            else log("hata", e.statusCode || "", (e.body || e.message || "").toString().slice(0, 120));
        }
    }));
    return ok;
}

// pushed: false → true (yalnız bir gönderici kazanır; cron'daki yedek gönderici ile çakışmaz)
async function claim(ref) {
    try {
        return await db.runTransaction(async (t) => {
            const d = await t.get(ref);
            if (!d.exists || d.get("pushed") !== false) return false;
            t.update(ref, { pushed: true });
            return true;
        });
    } catch (e) { log("claim hata", ref.path, e.message); return false; }
}
// bildirim metnindeki site bağlantısı dokununca açılsın (ör. çekiliş kazanma)
function urlOf(text) { const m = /rubikacademy\.fun(\/[^\s]*)/.exec(String(text || "")); return m ? m[1] : "/"; }

const timers = new Map();
function due(doc, fn) {
    const at = ms(doc.get("at")) || ms(doc.get("ts")), wait = at - Date.now();
    if (timers.has(doc.ref.path)) return;
    if (wait > 1000) {
        if (wait > RUN_MS) return; // bu çalışmada zamanı gelmeyecek; sonraki çalışma alır
        timers.set(doc.ref.path, setTimeout(() => { timers.delete(doc.ref.path); fn(); }, wait));
        log("planlandı", doc.ref.path, Math.round(wait / 1000) + " sn sonra");
    } else fn();
}

function onBroadcast(d) {
    due(d, async () => {
        if (!(await claim(d.ref))) return;
        const isComp = /^comp-[A-Z0-9]{5}$/.test(d.id), code = isComp ? d.id.slice(5) : "";
        const at = ms(d.get("at")) || ms(d.get("ts"));
        const n = await sendTo(subs, isComp ? { title: "Yeni ev yarışması 🏠", body: d.get("text") || "", tag: "c:" + code, url: "/icerikler/ev-yarismasi?ev=" + code }
            : { title: "Rubik Academy", body: d.get("text") || "", tag: "b:" + at, url: urlOf(d.get("text")) });
        log("duyuru", d.id, "→", n);
    });
}
function onNote(d) {
    due(d, async () => {
        if (!(await claim(d.ref))) return;
        const uid = d.ref.parent.parent.id, mine = subs.filter((s) => s.uid === uid), text = d.get("text") || "";
        const n = mine.length ? await sendTo(mine, { title: /çekiliş/i.test(text) ? "Çekiliş 🎉" : "Rubik Academy", body: text, tag: "n:" + d.id, url: urlOf(text) }) : 0;
        log("bildirim", uid.slice(0, 6) + "…", d.id, "→", n, mine.length ? "" : "(abonelik yok)");
    });
}

function listen(q, name, fn) {
    let unsub = null;
    const start = () => {
        unsub = q.onSnapshot((snap) => { snap.docChanges().forEach((c) => { if (c.type !== "removed") fn(c.doc); }); },
            (e) => { log(name, "dinleme hatası:", e.message, "→ 60 sn sonra yeniden"); setTimeout(start, 60000); });
    };
    start();
    return () => unsub && unsub();
}

await ensureIndex();
listen(db.collection("broadcasts").where("pushed", "==", false), "duyurular", onBroadcast);
listen(db.collectionGroup("notifications").where("pushed", "==", false), "bildirimler", onNote);
log("canlı gönderici çalışıyor; bitiş:", new Date(END).toISOString());

// süre dolunca kendini yeniden başlat (GITHUB_TOKEN ile workflow_dispatch yeni çalışma başlatabilir)
await new Promise((r) => setTimeout(r, RUN_MS));
if (process.env.GITHUB_TOKEN && process.env.GITHUB_REPOSITORY) {
    const r = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/actions/workflows/push-live.yml/dispatches`, {
        method: "POST", headers: { Authorization: "Bearer " + process.env.GITHUB_TOKEN, Accept: "application/vnd.github+json" }, body: JSON.stringify({ ref: "main" }) });
    log("yeniden başlatma isteği:", r.status);
}
await new Promise((r) => setTimeout(r, 8000)); // bekleyen gönderimler bitsin
process.exit(0);
