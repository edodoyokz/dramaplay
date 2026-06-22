// Probe live Sapimu provider endpoints to learn real response shapes.
// Usage: node --import tsx scripts/probe-sapimu.ts
const BASE = process.env.SAPIMU_BASE_URL ?? "https://captain.sapimu.au";
const TOKEN = process.env.SAPIMU_TOKEN ?? "";

async function probe(label: string, path: string) {
  try {
    const res = await fetch(BASE + path, {
      headers: { Authorization: `Bearer ${TOKEN}`, "User-Agent": "Mozilla/5.0" },
    });
    const text = await res.text();
    if (!res.ok) {
      console.log(`\n[${label}] ${path} -> HTTP ${res.status}: ${text.slice(0, 150)}`);
      return;
    }
    let json: any;
    try { json = JSON.parse(text); } catch { console.log(`\n[${label}] ${path} -> non-JSON: ${text.slice(0,100)}`); return; }
    console.log(`\n[${label}] ${path}`);
    console.log("  top keys:", Object.keys(json));
    // find first array
    function findArr(o: any, depth=0): any[] | null {
      if (depth > 5) return null;
      if (Array.isArray(o)) return o.length ? o : null;
      if (!o || typeof o !== "object") return null;
      for (const v of Object.values(o)) {
        const r = findArr(v, depth+1);
        if (r && r.length) return r;
      }
      return null;
    }
    const arr = findArr(json);
    if (arr && arr.length) {
      const item = arr[0];
      if (typeof item === "object" && item) {
        console.log("  first item keys:", Object.keys(item));
        console.log("  sample:", JSON.stringify(item).slice(0, 300));
      } else {
        console.log("  array[0] is", typeof item, ":", String(item).slice(0,100));
      }
    } else {
      console.log("  no array found. data preview:", JSON.stringify(json).slice(0, 300));
    }
  } catch (e: any) {
    console.log(`\n[${label}] ${path} -> ERROR: ${e.message}`);
  }
}

async function main() {
  // dramaboxbaru
  await probe("dramaboxbaru:home", "/dramaboxbaru/api/home?lang=id");
  await probe("dramaboxbaru:rank", "/dramaboxbaru/api/rank?lang=id");
  await probe("dramaboxbaru:search", "/dramaboxbaru/api/search?keyword=love&lang=id");

  // dramawave
  await probe("dramawave:popular", "/dramawave/api/v1/feed/popular?lang=id-ID");
  await probe("dramawave:new", "/dramawave/api/v1/feed/new?lang=id-ID");

  // pinedrama
  await probe("pinedrama:center", "/pinedrama/api/drama/center?lang=id");
  await probe("pinedrama:search", "/pinedrama/api/drama/search?keyword=love&lang=id");

  // reelshort
  await probe("reelshort:foryou", "/reelshort/api/v1/foryou");
  await probe("reelshort:new", "/reelshort/api/v1/new");
  await probe("reelshort:search", "/reelshort/api/v1/search?q=love");

  // netshort
  await probe("netshort:feed", "/netshort/api/v1/feed/1");
  await probe("netshort:new", "/netshort/api/v1/new/1");
  await probe("netshort:search", "/netshort/api/v1/search/love/1");

  // dramanova
  await probe("dramanova:dramas", "/dramanova/api/v1/dramas?lang=id");
  await probe("dramanova:recommend", "/dramanova/api/v1/recommend?lang=id");
  await probe("dramanova:search", "/dramanova/api/v1/search?q=love&lang=id");

  // melolo
  await probe("melolo:bookmall", "/melolo/api/v1/bookmall?tab=0");
  await probe("melolo:search", "/melolo/api/v1/search?keyword=love");
}

main();
