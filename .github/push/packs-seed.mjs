/* Hazır özel paketleri Firebase'e yazar (packs/{id}); hesaplara atama yönetim panelinden yapılır.
   GitHub Actions "Hazır paketleri yaz" işi çalıştırır (bu dosya değişince).
   Kaynak: sitedeki tek el (sağ el) OLL/PLL algoritmaları — icerikler/algoritmalar/oh.json */
import admin from "firebase-admin";
import { readFileSync } from "node:fs";

const SA = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!SA) { console.log("FIREBASE_SERVICE_ACCOUNT yok"); process.exit(1); }
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(SA)) });
const db = admin.firestore();

const oh = JSON.parse(readFileSync(new URL("../../icerikler/algoritmalar/oh.json", import.meta.url), "utf8"));
const TR = { "Edges oriented": "Kenarlar yönlü", "Corners oriented": "Köşeler yönlü", "Dot": "Nokta", "Square": "Kare", "Line": "Çizgi", "Fish": "Balık",
    "Lightning": "Şimşek", "Knight": "At", "Awkward": "Garip", "P shape": "P şekli", "T shape": "T şekli", "C shape": "C şekli", "L shape": "L şekli", "W shape": "W şekli",
    "Adj corners": "Komşu köşeler", "Diag corners": "Çapraz köşeler", "G perm": "G perm", "Edge perm": "Kenar perm" };
function algs(id) {
    const s = oh.sets.find((x) => x.id === id);
    return s.groups.flatMap((g) => g.cases.map((c) => ({
        n: c.name, a: c.alg,
        note: [TR[g.subset] || g.subset, c.alts && c.alts[0] ? "Alternatif: " + c.alts[0] : ""].filter(Boolean).join(" · ").slice(0, 200)
    })));
}
const packs = [
    { id: "tek-el-oll-sag", name: "Tek El OLL (sağ el)", desc: "57 OLL, sağ elle rahat yapılan R, U, F, D hamleleriyle", data: { algs: algs("oll") } },
    { id: "tek-el-pll-sag", name: "Tek El PLL (sağ el)", desc: "21 PLL, sağ elle tek el çözüm için", data: { algs: algs("pll") } }
];
for (const p of packs) {
    await db.collection("packs").doc(p.id).set({ name: p.name, kind: "alg", desc: p.desc, data: JSON.stringify(p.data), ts: admin.firestore.Timestamp.now() });
    console.log("yazıldı:", p.id, p.data.algs.length, "algoritma");
}
