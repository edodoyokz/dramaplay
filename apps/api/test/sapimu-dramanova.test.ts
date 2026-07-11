import { describe, expect, it } from "vitest";
import { dramanova } from "../src/providers/sapimu/providers/dramanova";

describe("dramanova stream", () => {
  it("marks video API URLs as mp4", () => {
    const stream = dramanova.overrides?.normalizeStream?.(
      { videos: [{ main_url: "http://sulao.montagehub.xyz/video?auth_key=x" }] },
      { code: "dramanova", get: async () => ({}), fields: {} },
    );

    expect(stream).toEqual({
      streamUrl: "http://sulao.montagehub.xyz/video?auth_key=x",
      streamType: "mp4",
    });
  });
});
