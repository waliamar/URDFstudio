// src/lib/resize.ts — pure geometry for draggable panel dividers.

export type PanelKey = "tree" | "inspector" | "bottom";

export const PANEL_LIMITS: Record<PanelKey, { min: number; max: number }> = {
  tree: { min: 160, max: 480 },
  inspector: { min: 220, max: 520 },
  bottom: { min: 120, max: 480 },
};

/** start + delta, clamped to [min,max], rounded to whole pixels. */
export function clampSize(
  start: number,
  delta: number,
  min: number,
  max: number,
): number {
  return Math.round(Math.min(max, Math.max(min, start + delta)));
}
