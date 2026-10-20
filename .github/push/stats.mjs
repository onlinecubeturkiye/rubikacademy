/* Rubik Academy — ana sayfadaki kullanıcı sayısı (GitHub Actions'ta çalışır)
   Üye sayısı (users) + hesapsız ziyaretçi cihazları (anon) sayılır ve herkese açık
   config/site belgesine yazılır: { members, visitors }. Sayım sorgusu kullanılır (ucuz).
   Gizli anahtar: FIREBASE_SERVICE_ACCOUNT (JSON) */
import admin from "firebase-admin";

const SA = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!SA) { console.log("FIREBASE_SERVICE_ACCOUNT tanımlı değil; atlanıyor."); process.exit(0); }
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(SA)) });
const db = admin.firestore();

const ref = db.doc("config/site");
const cur = (await ref.get()).data() || {};
// Saatte bir yeter
if (cur.statsAt && Date.now() - cur.statsAt < 55 * 60 * 1000) { console.log("istatistik güncel"); process.exit(0); }
const members = (await db.collection("users").count().get()).data().count;
const visitors = (await db.collection("anon").count().get()).data().count;
await ref.set({ members, visitors, statsAt: Date.now() }, { merge: true });
console.log("üye:", members, "hesapsız cihaz:", visitors);
