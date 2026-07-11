import { describe, expect, it, vi } from "vitest";
import app from "../src/index";

describe("sapimu raw manifest proxy", () => {
  it("rewrites media segments to the public Pages stream proxy", async () => {
    const oldFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => new Response("#EXTM3U\nhttps://cdn.example/video.ts\n")) as any;

    const res = await app.fetch(
      new Request("https://api.test/proxy/sapimu-stream?path=/dramaboxbaru/api/stream?bookId=1"),
      { PROVIDER_BASE_URL: "https://provider.test", PROVIDER_API_TOKEN: "token", CONSUMER_URL: "https://dramaplay.my.id" } as any,
      {} as any,
    );

    expect(await res.text()).toContain("https://dramaplay.my.id/stream?u=https%3A%2F%2Fcdn.example%2Fvideo.ts");
    globalThis.fetch = oldFetch;
  });
});
