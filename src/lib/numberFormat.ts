// src/lib/numberFormat.ts
// Display vs. edit representations for Unity-style number fields:
// blurred fields show a rounded value; focused fields show the exact value.

/** Decimal places implied by a step, clamped to [1, 4]. */
export function decimalsOf(step: number): number {
  const s = String(step);
  const d = s.includes(".") ? s.split(".")[1].length : 0;
  return Math.min(Math.max(d, 1), 4);
}

/** Rounded string shown when the field is not focused. */
export function displayValue(value: number, precision: number): string {
  return value.toFixed(precision);
}

/** Exact (shortest round-trippable) string seeded into the input on focus. */
export function editSeed(value: number): string {
  return String(value);
}
