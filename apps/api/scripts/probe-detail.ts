// Probe detail + play endpoints per provider using a real drama id from feed.
const BASE = process.env.SAPIMU_BASE_URL ?? "https://captain.sapimu.au";
const TOKEN = process.env.SAPIMU_TOKEN ?? "";
const H = { Authorization: `Bearer ${TOKEN}`, "User-Agent": "Mozilla/5.0" };

async function get(path: string): Promise<any> {
  const r = await fetch(BASE + path, { headers: H });
  const t = await r.text();
  if (!r.ok) return { __http: r.status, __body: t.slice(0, 200) };
  try { return JSON.parse(t); } catch { return { __http: r.status, __nonJson: t.slice(0, 200) }; }
}

// find first drama id + a non-array object row in a response
function findFirstId(json: any): { id: string; row: any } | null {
  function findArr(o: any, d=0): any[] | null {
    if (d > 6) return null;
    if (Array.isArray(o)) return o.length ? o : null;
    if (!o || typeof o !== "object") return null;
    for (const v of Object.values(o)) { const r = findArr(v, d+1); if (r && r.length) return r; }
    return null;
  }
  const arr = findArr(json);
  if (!arr) return null;
  for (const item of arr) {
    if (item && typeof item === "object") {
      const id = item.id ?? item.key ?? item._id ?? item.bookId ?? item.t_book_id ?? item.book_id;
      if (id) return { id: String(id), row: item };
    }
  }
  return null;
}

async function probeDetail(label: string, feedPath: string, detailPath: (id: string) => string) {
  console.log(`\n========== ${label} ==========`);
  const feed = await get(feedPath);
  const found = findFirstId(feed);
  if (!found) { console.log(`  feed ${feedPath}: no drama id found`); return; }
  const { id, row } = found;
  console.log(`  id=${id}  episode-count-fields: totalEpisodes=${row.totalEpisodes} episodes=${row.episodes} chapters=${row.chapters}`);
  // detail
  const dpath = detailPath(id);
  console.log(`  DETAIL ${dpath}`);
  const detail = await get(dpath);
  if (detail.__http) { console.log(`    -> ${detail.__http}: ${detail.__body}`); return; }
  console.log(`    top keys: ${Object.keys(detail)}`);
  // print the inner data object keys + any episode-like field
  function dump(o: any, prefix: string, d=0) {
    if (d > 2 || !o || typeof o !== "object") return;
    const keys = Object.keys(o);
    console.log(`    ${prefix}keys: ${keys.slice(0,25).join(",")}`);
  }
  const inner = detail.data ?? detail.row ?? detail.drama ?? detail.book ?? detail;
  dump(inner, "");
  // look for episode array or count inside inner
  for (const k of ["episodes","episodeList","chapters","chapterList","videoList","totalEpisodes","total_episodes","episode_count","episodeCount"]) {
    if (inner[k] !== undefined) {
      const v = inner[k];
      if (Array.isArray(v)) console.log(`    ${k}: array len=${v.length}, [0]=${JSON.stringify(v[0]).slice(0,200)}`);
      else console.log(`    ${k}: ${typeof v} = ${String(v).slice(0,60)}`);
    }
  }
}

async function main() {
  await probeDetail("dramaboxbaru", "/dramaboxbaru/api/rank?lang=id", (id) => `/dramaboxbaru/api/drama/${id}?lang=id`);
  await probeDetail("dramawave", "/dramawave/api/v1/feed/popular?lang=id-ID", (id) => `/dramawave/api/v1/dramas/${id}?lang=id-ID`);
  await probeDetail("pinedrama", "/pinedrama/api/drama/search?keyword=love&lang=id", (id) => `/pinedrama/api/drama/detail?dramaId=${id}&lang=id`);
  await probeDetail("reelshort", "/reelshort/api/v1/new", (id) => `/reelshort/api/v1/book/${id}`);
  await probeDetail("netshort", "/netshort/api/v1/feed/1", (id) => `/netshort/api/v1/detail/${id}`);
  await probeDetail("dramanova", "/dramanova/api/v1/dramas?lang=id", (id) => `/dramanova/api/v1/drama/${id}?lang=id`);
  await probeDetail("melolo", "/melolo/api/v1/bookmall?tab=0", (id) => `/melolo/api/v1/series?seriesId=${id}`);
}
main();
