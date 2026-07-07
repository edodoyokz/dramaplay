import { expect, it } from "vitest";
import { SapimuPresetAdapter } from "../src/providers/sapimu/core/adapter";
import { idrama } from "../src/providers/sapimu/providers/idrama";

it("defines idrama as a POST unlock provider", () => {
  expect(idrama.code).toBe("idrama");
  expect(idrama.playMethod).toBe("POST");
  expect(idrama.endpoints.play).toBe("/idrama/api/v1/unlock/{id}?episode={ep}&lang=id");
});

it("resolves idrama stream through POST unlock endpoint", async () => {
  const a = new SapimuPresetAdapter(idrama, "https://captain.sapimu.au", "tok");
  const calls: string[] = [];
  // @ts-expect-error override injected post for test (no network)
  a.post = async (p: string) => {
    calls.push(p);
    return { videoUrl: "https://cdn.example/idrama.m3u8" };
  };
  // @ts-expect-error GET must not be used for idrama play
  a.get = async () => {
    throw new Error("GET should not be called");
  };

  const out = await a.resolveStream("160000640162:1");

  expect(calls).toEqual(["/idrama/api/v1/unlock/160000640162?episode=1&lang=id"]);
  expect(out).toMatchObject({ streamUrl: "https://cdn.example/idrama.m3u8", streamType: "m3u8" });
});
