// src/lib/scrub.ts — pure math for Unity-style drag-scrub number fields.

export function scrubMultiplier(mods: { shift: boolean; alt: boolean }): number {
  if (mods.shift) return 10;
  if (mods.alt) return 0.1;
  return 1;
}

/** value + movementX*step*multiplier, optionally clamped to [min,max]. */
export function applyScrub(
  value: number,
  movementX: number,
  step: number,
  multiplier: number,
  min = -Infinity,
  max = Infinity,
): number {
  const next = value + movementX * step * multiplier;
  return Math.min(max, Math.max(min, next));
}
