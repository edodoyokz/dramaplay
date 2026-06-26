import { describe, expect, it } from "vitest";
import { SapimuPresetAdapter } from "../src/providers/sapimu/core/adapter";
import { defineSapimuProvider } from "../src/providers/sapimu/core/define";

const def = defineSapimuProvider({
  code: "fake",
  endpoints: {
    trending: "/t",
    latest: "/l",
    foryou: "/f",
    search: "/s?q={q}",
    detail: "/d/{id}",
    play: "/p/{id}/{ep}",
  },
  fields: { id: ["id"], title: ["title"], poster: ["cover"], backdrop: ["backdrop"] },
  subtitlePolicy: "external",
});

function adapterWith(responses: Record<string, unknown>): SapimuPresetAdapter {
  const a = new SapimuPresetAdapter(def, "http://base", "tok");
  // @ts-expect-error override injected get for test (no network)
  a.get = async (p: string) => responses[p];
  return a;
}

describe("SapimuPresetAdapter", () => {
  it("maps trending list to summaries", async () => {
    const a = adapterWith({ "/t": [{ id: "1", title: "A", cover: "c", backdrop: "b" }] });
    const out = await a.fetchTrending();
    expect(out[0]).toMatchObject({ providerDramaId: "1", title: "A", posterUrl: "c", backdropUrl: "b" });
  });

  it("fetchForYou returns {items}", async () => {
    const a = adapterWith({ "/f": [{ id: "9", title: "N" }] });
    const out = await a.fetchForYou();
    expect(out.items[0].providerDramaId).toBe("9");
  });

  it("substitutes {id}/{ep} in play path and resolves stream", async () => {
    const a = adapterWith({ "/p/9/2": { url: "https://x/a.m3u8" } });
    const s = await a.resolveStream("9:2");
    expect(s).toMatchObject({ streamUrl: "https://x/a.m3u8", streamType: "m3u8" });
  });

  it("extracts subtitle url from play response", async () => {
    const a = adapterWith({
      "/p/1/1": { url: "https://x/a.mp4", subtitle_list: [{ vtt: "https://x/a.vtt" }] },
    });
    const s = await a.resolveStream("1:1");
    expect(s?.subtitleUrl).toBe("https://x/a.vtt");
  });

  it("returns null when no stream url found", async () => {
    const a = adapterWith({ "/p/1/1": { foo: "bar" } });
    expect(await a.resolveStream("1:1")).toBeNull();
  });

  it("override selectStreamPayload is used for stream extraction", async () => {
    const d = defineSapimuProvider({
      ...def,
      code: "ov",
      endpoints: { ...def.endpoints, play: "/m/{id}" },
      overrides: {
        selectStreamPayload(data, ctx) {
          return (data as { episodes: { index: number; stream_url: string }[] }).episodes.find(
            (e) => e.index === ctx.episodeNumber,
          );
        },
      },
    });
    const a = new SapimuPresetAdapter(d, "http://base", "tok");
    // @ts-expect-error override get for test
    a.get = async (p: string) =>
      p === "/m/5" ? { episodes: [{ index: 1, stream_url: "https://x/ep1.mp4" }, { index: 2, stream_url: "https://x/ep2.mp4" }] } : null;
    const s = await a.resolveStream("5:2");
    expect(s?.streamUrl).toBe("https://x/ep2.mp4");
  });
});
