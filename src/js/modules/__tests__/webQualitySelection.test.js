import { normalizeWebQualitySelection } from "../webQualitySelection.js";

describe("web quality selection", () => {
  it("keeps a valid paired format payload", () => {
    expect(
      normalizeWebQualitySelection({
        type: "pair",
        videoFormatId: "137",
        audioFormatId: "140",
      }),
    ).toMatchObject({
      type: "pair",
      videoFormatId: "137",
      audioFormatId: "140",
    });
  });

  it("rejects incompatible or unsafe selections", () => {
    expect(() =>
      normalizeWebQualitySelection({ type: "pair", videoFormatId: "137" }),
    ).toThrow("Invalid web quality selection");
    expect(() =>
      normalizeWebQualitySelection({
        type: "audio-only",
        audioFormatId: "140;rm",
      }),
    ).toThrow("Invalid web quality selection");
  });
});
