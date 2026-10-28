import { describe, expect, it } from "vitest";
import { buildCsv, funnelConversion, heatmapIntensity } from "./reporting";

describe("reporting helpers", () => {
  it("builds escaped CSV and neutralizes spreadsheet formulas", () => {
    expect(
      buildCsv(
        ["Name", "Score"],
        [
          ["=SUM(A1)", 92],
          ['Asha "Ace" Rao', null],
        ],
      ),
    ).toBe('"Name","Score"\n"\'=SUM(A1)","92"\n"Asha ""Ace"" Rao",""');
  });

  it("returns null conversion for an empty funnel and rounds percentages", () => {
    expect(funnelConversion(5, 0)).toBeNull();
    expect(funnelConversion(1, 3)).toBe(33.3);
    expect(funnelConversion(3, 3)).toBe(100);
  });

  it("clamps heatmap intensity to a readable minimum and a max of one", () => {
    expect(heatmapIntensity(0, 10)).toBe(0);
    expect(heatmapIntensity(5, 0)).toBe(0);
    expect(heatmapIntensity(1, 100)).toBe(0.08);
    expect(heatmapIntensity(50, 100)).toBe(0.5);
    expect(heatmapIntensity(200, 100)).toBe(1);
  });
});
