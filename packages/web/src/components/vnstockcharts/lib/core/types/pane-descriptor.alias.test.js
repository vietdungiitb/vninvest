import { describe, expect, test } from "@jest/globals";

import { normalizeSeriesTypeId } from "./pane-descriptor.js";

describe("normalizeSeriesTypeId", () => {
  test("maps the legacy BollingerBands alias to BollingerBand", () => {
    expect(normalizeSeriesTypeId("BollingerBands")).toBe("BollingerBand");
  });

  test("maps legacy strength aliases to canonical registry ids", () => {
    expect(normalizeSeriesTypeId("BuyStrength")).toBe("StrengthElder");
    expect(normalizeSeriesTypeId("InstitutionalStrength")).toBe("StrengthRelative");
  });

  test("keeps canonical series ids unchanged", () => {
    expect(normalizeSeriesTypeId("EMA")).toBe("EMA");
  });
});