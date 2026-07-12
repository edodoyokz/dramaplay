import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  parseBootstrapArgs,
  shouldContinueBootstrap,
} from "../src/sync/bootstrap";

describe("parseBootstrapArgs", () => {
  it("defaults to both longform providers and a finite pass limit", () => {
    expect(parseBootstrapArgs([])).toEqual({
      providers: ["wetv", "moviebox"],
      maxPasses: 20,
      delayMs: 3000,
    });
  });

  it("accepts a provider and bounded overrides", () => {
    expect(parseBootstrapArgs(["wetv", "--passes", "3", "--delay-ms", "0"])).toEqual({
      providers: ["wetv"],
      maxPasses: 3,
      delayMs: 0,
    });
  });

  it("rejects providers outside the allowlist", () => {
    expect(() => parseBootstrapArgs(["shortmax"])).toThrow(
      "bootstrap only supports wetv and moviebox",
    );
  });
});

describe("shouldContinueBootstrap", () => {
  it("continues only when progress was made and passes remain", () => {
    expect(shouldContinueBootstrap({ episodeNew: 10, pass: 1, maxPasses: 3 })).toBe(true);
    expect(shouldContinueBootstrap({ episodeNew: 0, pass: 1, maxPasses: 3 })).toBe(false);
    expect(shouldContinueBootstrap({ episodeNew: 10, pass: 3, maxPasses: 3 })).toBe(false);
  });
});

describe("package script", () => {
  it("exposes the longform bootstrap runner", () => {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    expect(pkg.scripts["sync:longform:bootstrap"]).toBe(
      "node --import tsx scripts/bootstrap-longform.ts",
    );
  });
});
