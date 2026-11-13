/* firestore.rules dosyasını Firebase'e yayınlar (Firebase Rules API).
   GitHub Actions'taki "Firebase kurallarını yayınla" işi çalıştırır; firestore.rules değişince otomatik.
   Gizli anahtar: FIREBASE_SERVICE_ACCOUNT (JSON). Hizmet hesabının "Firebase Rules Admin" (ya da Firebase Admin) yetkisi olmalı. */
import admin from "firebase-admin";
import { readFileSync } from "node:fs";

const SA = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!SA) { console.log("FIREBASE_SERVICE_ACCOUNT tanımlı değil; atlanıyor."); process.exit(1); }
const sa = JSON.parse(SA), project = sa.project_id;
const src = readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8");
const { access_token } = await admin.credential.cert(sa).getAccessToken();
const H = { Authorization: "Bearer " + access_token, "Content-Type": "application/json" };
const base = "https://firebaserules.googleapis.com/v1/projects/" + project;

// 1) Yeni kural seti (sözdizimi burada denetlenir; hatalıysa yayınlanmaz)
let r = await fetch(base + "/rulesets", { method: "POST", headers: H, body: JSON.stringify({ source: { files: [{ name: "firestore.rules", content: src }] } }) });
let j = await r.json();
if (!r.ok) { console.error("Kural seti oluşturulamadı:", JSON.stringify(j, null, 1)); process.exit(1); }
console.log("Kural seti:", j.name);

// 2) Firestore'un kullandığı sürümü yeni kural setine bağla
const rel = "projects/" + project + "/releases/cloud.firestore";
r = await fetch("https://firebaserules.googleapis.com/v1/" + rel, { method: "PATCH", headers: H, body: JSON.stringify({ release: { name: rel, rulesetName: j.name } }) });
const k = await r.json();
if (!r.ok) { console.error("Yayınlanamadı:", JSON.stringify(k, null, 1)); process.exit(1); }
console.log("Yayınlandı ✓", k.name, k.updateTime);
