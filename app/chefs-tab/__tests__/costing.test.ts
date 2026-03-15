import { describe, it, expect } from "vitest";
import {
  suggestedPrice,
  actualFoodCostPercent,
  grossProfit,
  scenarioPrices,
  costingStatus,
  getDefaultTargetFoodCostPercent,
} from "../costing";

describe("suggestedPrice", () => {
  it("divides plate cost by target percent", () => {
    expect(suggestedPrice(6, 24)).toBeCloseTo(25, 2);
    expect(suggestedPrice(12, 24)).toBeCloseTo(50, 2);
    expect(suggestedPrice(5, 25)).toBe(20);
  });
});

describe("actualFoodCostPercent", () => {
  it("returns plate cost / menu price * 100", () => {
    expect(actualFoodCostPercent(6, 25)).toBe(24);
    expect(actualFoodCostPercent(5, 20)).toBe(25);
  });
  it("returns null for zero menu price", () => {
    expect(actualFoodCostPercent(5, 0)).toBeNull();
  });
});

describe("grossProfit", () => {
  it("returns price minus plate cost", () => {
    expect(grossProfit(25, 6)).toBe(19);
    expect(grossProfit(20, 5)).toBe(15);
  });
});

describe("scenarioPrices", () => {
  it("returns prices at 22, 24, 26, 28%", () => {
    const s = scenarioPrices(6);
    expect(s[22]).toBeCloseTo(27.27, 1);
    expect(s[24]).toBeCloseTo(25, 1);
    expect(s[26]).toBeCloseTo(23.08, 1);
    expect(s[28]).toBeCloseTo(21.43, 1);
  });
});

describe("costingStatus", () => {
  it("returns missing when plate cost is 0", () => {
    expect(costingStatus(0, 25, 24)).toBe("missing");
  });
  it("returns partial when no menu price", () => {
    expect(costingStatus(6, null, 24)).toBe("partial");
  });
  it("returns on_target when within 1%", () => {
    expect(costingStatus(6, 25, 24)).toBe("on_target");
  });
  it("returns underpriced when actual % is high", () => {
    expect(costingStatus(10, 25, 24)).toBe("underpriced");
  });
});

describe("getDefaultTargetFoodCostPercent", () => {
  it("returns 24", () => {
    expect(getDefaultTargetFoodCostPercent()).toBe(24);
  });
});
