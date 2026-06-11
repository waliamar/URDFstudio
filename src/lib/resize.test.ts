import { describe, it, expect } from "vitest";
import { clampSize, PANEL_LIMITS } from "./resize";

describe("clampSize", () => {
  it("adds a positive delta to the start size", () => {
    expect(clampSize(200, 50, 100, 400)).toBe(250);
  });
  it("adds a negative delta", () => {
    expect(clampSize(200, -50, 100, 400)).toBe(150);
  });
  it("clamps to the minimum", () => {
    expect(clampSize(200, -300, 100, 400)).toBe(100);
  });
  it("clamps to the maximum", () => {
    expect(clampSize(200, 500, 100, 400)).toBe(400);
  });
  it("rounds to whole pixels", () => {
    expect(clampSize(200.4, 0.2, 100, 400)).toBe(201);
  });
});

describe("PANEL_LIMITS", () => {
  it("defines min/max for every panel", () => {
    for (const k of ["tree", "inspector", "bottom"] as const) {
      expect(PANEL_LIMITS[k].max).toBeGreaterThan(PANEL_LIMITS[k].min);
    }
  });
});
