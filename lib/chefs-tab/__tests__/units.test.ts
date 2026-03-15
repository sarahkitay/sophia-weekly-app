import { describe, it, expect } from "vitest";
import { convertUnits, normalizeUnit, ingredientPortionCost } from "../units";

describe("normalizeUnit", () => {
  it("normalizes common units", () => {
    expect(normalizeUnit("lb")).toBe("lb");
    expect(normalizeUnit("LB")).toBe("lb");
    expect(normalizeUnit("pound")).toBe("lb");
    expect(normalizeUnit("oz")).toBe("oz");
    expect(normalizeUnit("g")).toBe("g");
    expect(normalizeUnit("each")).toBe("each");
    expect(normalizeUnit("")).toBeNull();
  });
});

describe("convertUnits", () => {
  it("converts weight to weight", () => {
    expect(convertUnits(1, "lb", "oz")).toBeCloseTo(16, 2);
    expect(convertUnits(16, "oz", "lb")).toBeCloseTo(1, 2);
    expect(convertUnits(1000, "g", "kg")).toBe(1);
  });
  it("converts volume to volume", () => {
    expect(convertUnits(1, "quart", "cup")).toBeCloseTo(4, 2);
    expect(convertUnits(4, "cup", "quart")).toBeCloseTo(1, 2);
  });
  it("returns null for incompatible units", () => {
    expect(convertUnits(1, "lb", "cup")).toBeNull();
    expect(convertUnits(1, "each", "oz")).toBeNull();
  });
});

describe("ingredientPortionCost", () => {
  it("calculates cost for same unit (each)", () => {
    const r = ingredientPortionCost(100, 10, "each", 2, "each");
    expect(r.compatible).toBe(true);
    if (r.compatible) expect(r.cost).toBe(20);
  });
  it("calculates cost for weight (20 lb potatoes -> 5 oz)", () => {
    const r = ingredientPortionCost(18, 20, "lb", 5, "oz");
    expect(r.compatible).toBe(true);
    if (r.compatible) expect(r.cost).toBeCloseTo(0.28125, 2); // 18/20 per lb, 5/16 lb
  });
  it("returns incompatible for weight vs volume", () => {
    const r = ingredientPortionCost(10, 1, "lb", 1, "cup");
    expect(r.compatible).toBe(false);
  });
});
