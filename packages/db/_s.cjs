const postgres = require("postgres");
const sql = postgres(process.env.DATABASE_URL);
(async () => {
  const provs = await sql.unsafe("SELECT code, is_enabled FROM providers ORDER BY priority");
  const d = await sql.unsafe("SELECT p.code, COUNT(*) AS dramas FROM drama_providers dp JOIN providers p ON p.id=dp.provider_id GROUP BY p.code");
  const e = await sql.unsafe("SELECT p.code, COUNT(*) AS episodes FROM episode_providers ep JOIN providers p ON p.id=ep.provider_id GROUP BY p.code");
  const dmap = Object.fromEntries(d.map((r) => [r.code, Number(r.dramas)]));
  const emap = Object.fromEntries(e.map((r) => [r.code, Number(r.episodes)]));
  console.table(provs.map((p) => ({ code: p.code, enabled: p.is_enabled, dramas: dmap[p.code]||0, episodes: emap[p.code]||0 })));
  await sql.end();
})();
