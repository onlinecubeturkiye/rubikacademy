/* Rubik Academy — Yönetici panelinden silinen hesapları tamamen kaldırır (GitHub Actions'ta çalışır)
   deletions/{uid} kuyruğundaki her kullanıcı için:
   - Firebase Authentication hesabı silinir
   - users/{uid} ve tüm alt koleksiyonları, days/{gün}/times/{uid}, pushsubs (uid) kayıtları silinir
   - roles/{uid} = "silindi" işareti bırakılır (cihazlar kendini temizler), kuyruk kaydı silinir
   Gizli anahtar: FIREBASE_SERVICE_ACCOUNT (JSON) */
import admin from "firebase-admin";

const SA = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!SA) { console.log("FIREBASE_SERVICE_ACCOUNT tanımlı değil; atlanıyor."); process.exit(0); }
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(SA)) });
const db = admin.firestore();

const queue = (await db.collection("deletions").get()).docs;
console.log("silinecek hesap:", queue.length);
if (!queue.length) process.exit(0);

const dayRefs = await db.collection("days").listDocuments(); // boş (yalnız alt koleksiyonlu) günler de gelir

for (const q of queue) {
    const uid = q.id;
    try {
        try { await admin.auth().deleteUser(uid); console.log(uid, "giriş hesabı silindi"); }
        catch (e) { if (e.code !== "auth/user-not-found") throw e; console.log(uid, "giriş hesabı zaten yok"); }
        await db.recursiveDelete(db.doc("users/" + uid));
        for (const d of dayRefs) await d.collection("times").doc(uid).delete();
        for (const s of (await db.collection("pushsubs").where("uid", "==", uid).get()).docs) await s.ref.delete();
        await db.doc("roles/" + uid).set({ role: "silindi" });
        await q.ref.delete();
        console.log(uid, "tamam");
    } catch (e) {
        console.log(uid, "hata:", e.code || "", (e.message || "").slice(0, 160));
    }
}
