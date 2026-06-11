import { describe, it, expect } from "vitest";
import { scrubMultiplier, applyScrub } from "./scrub";

describe("scrubMultiplier", () => {
  it("is 1 with no modifiers", () => {
    expect(scrubMultiplier({ shift: false, alt: false })).toBe(1);
  });
  it("is 10 with shift", () => {
    expect(scrubMultiplier({ shift: true, alt: false })).toBe(10);
  });
  it("is 0.1 with alt", () => {
    expect(scrubMultiplier({ shift: false, alt: true })).toBe(0.1);
  });
  it("shift wins over alt", () => {
    expect(scrubMultiplier({ shift: true, alt: true })).toBe(10);
  });
});

describe("applyScrub", () => {
  it("adds movementX * step * multiplier", () => {
    expect(applyScrub(0, 5, 0.01, 1)).toBeCloseTo(0.05);
  });
  it("applies the multiplier", () => {
    expect(applyScrub(0, 5, 0.01, 10)).toBeCloseTo(0.5);
  });
  it("clamps to min", () => {
    expect(applyScrub(0.02, -10, 0.01, 1, 0)).toBe(0);
  });
  it("clamps to max", () => {
    expect(applyScrub(0, 100, 0.01, 1, undefined, 0.5)).toBe(0.5);
  });
});
