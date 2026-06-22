// Deep probe of failing provider feeds — full structure dump.
const BASE = process.env.SAPIMU_BASE_URL!;
const TOKEN = process.env.SAPIMU_TOKEN!;
const H = { Authorization: `Bearer ${TOKEN}`, "User-Agent": "Mozilla/5.0" };

async function probe(label: string, path: string) {
  console.log(`\n===== ${label}: ${path} =====`);
  try {
    const r = await fetch(BASE + path, { headers: H });
    const t = await r.text();
    if (!r.ok) { console.log(`  HTTP ${r.status}: ${t.slice(0,200)}`); return; }
    const json = JSON.parse(t);
    console.log("  TOP:", Object.keys(json));
    // walk to find first array, print depth + keys
    let found = false;
    function walk(o: any, trail: string, d: number): void {
      if (found || d > 6) return;
      if (Array.isArray(o)) {
        if (!o.length) { console.log(`  ${trail} = []`); return; }
        const it = o[0];
        if (it && typeof it === "object") {
          console.log(`  ${trail} array[len=${o.length}], item keys: ${Object.keys(it).slice(0,20).join(",")}`);
          console.log(`     item0: ${JSON.stringify(it).slice(0,250)}`);
        } else {
          console.log(`  ${trail} array[len=${o.length}] of ${typeof it}`);
        }
        found = true;
        return;
      }
      if (!o || typeof o !== "object") return;
      for (const [k, v] of Object.entries(o)) walk(v, trail ? `${trail}.${k}` : k, d + 1);
    }
    walk(json, "", 0);
  } catch (e: any) { console.log("  ERR:", e.message); }
}

async function main() {
  await probe("pinedrama:center", "/pinedrama/api/drama/center?lang=id");
  await probe("pinedrama:search", "/pinedrama/api/drama/search?keyword=love&lang=id");
  await probe("reelshort:foryou", "/reelshort/api/v1/foryou");
  await probe("reelshort:new", "/reelshort/api/v1/new");
  await probe("melolo:bookmall", "/melolo/api/v1/bookmall?tab=0");
  await probe("dramaboxbaru:home", "/dramaboxbaru/api/home?lang=id");
  await probe("dramaboxbaru:rank", "/dramaboxbaru/api/rank?lang=id");
  await probe("dramawave:detail", "/dramawave/api/v1/dramas/uIVZZq9wl0?lang=id-ID");
}
main();
