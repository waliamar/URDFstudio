import { describe, it, expect } from "vitest";
import { decimalsOf, displayValue, editSeed } from "./numberFormat";

describe("numberFormat", () => {
  it("decimalsOf derives precision from the step, clamped to [1,4]", () => {
    expect(decimalsOf(0.01)).toBe(2);
    expect(decimalsOf(1)).toBe(1);       // clamp floor
    expect(decimalsOf(0.000001)).toBe(4); // clamp ceil
    expect(decimalsOf(0.001)).toBe(3);
  });

  it("displayValue rounds to the given precision", () => {
    expect(displayValue(0.017453292519943295, 2)).toBe("0.02");
    expect(displayValue(1.5, 2)).toBe("1.50");
  });

  it("editSeed preserves the exact value as a round-trippable string", () => {
    const v = 0.017453292519943295;
    expect(editSeed(v)).toBe("0.017453292519943295");
    expect(parseFloat(editSeed(v))).toBe(v);
    expect(editSeed(2)).toBe("2");
  });
});
