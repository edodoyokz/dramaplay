import { describe, expect, it } from "vitest";
import { resolveContentKind } from "@dramaplay/shared";

describe("resolveContentKind", () => {
  it("defaults shortform", () => {
    expect(resolveContentKind({})).toEqual({ contentType: "shortform" });
  });

  it("prefers item metadata over provider config", () => {
    expect(
      resolveContentKind({
        contentType: "longform",
        mediaType: "movie",
        providerContentType: "shortform",
      }),
    ).toEqual({ contentType: "longform", mediaType: "movie" });
  });

  it("infers series/movie from episode count for longform", () => {
    expect(resolveContentKind({ contentType: "longform", episodeCount: 12 })).toEqual({
      contentType: "longform",
      mediaType: "series",
    });
    expect(resolveContentKind({ contentType: "longform", episodeCount: 1 })).toEqual({
      contentType: "longform",
      mediaType: "movie",
    });
  });
});
