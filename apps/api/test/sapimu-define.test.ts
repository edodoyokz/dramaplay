import { describe, expect, it } from "vitest";
import { defineSapimuProvider } from "../src/providers/sapimu/core/define";
import type { SapimuProviderDef } from "../src/providers/sapimu/core/types";

const valid: SapimuProviderDef = {
  code: "x",
  endpoints: {
    trending: "/t",
    latest: "/l",
    foryou: "/f",
    search: "/s?q={q}",
    detail: "/d/{id}",
    play: "/p/{id}/{ep}",
  },
  fields: { id: ["id"], title: ["title"], poster: ["cover"] },
  subtitlePolicy: "external",
};

describe("defineSapimuProvider", () => {
  it("returns def when valid", () => {
    expect(defineSapimuProvider(valid).code).toBe("x");
  });
  it("throws on missing endpoint", () => {
    expect(() =>
      defineSapimuProvider({ ...valid, endpoints: { ...valid.endpoints, play: "" } as never }),
    ).toThrow();
  });
  it("accepts empty fields (global fallbacks apply)", () => {
    expect(defineSapimuProvider({ ...valid, fields: {} }).code).toBe("x");
  });
  it("throws on missing subtitlePolicy", () => {
    expect(() =>
      defineSapimuProvider({ ...valid, subtitlePolicy: undefined as never }),
    ).toThrow();
  });
});
