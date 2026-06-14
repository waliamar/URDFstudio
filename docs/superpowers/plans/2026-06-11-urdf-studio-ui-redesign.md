# URDF Studio UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give URDF Studio a flat grayscale visionOS-style glass theme, resizable/collapsible/persisted panels, tighter tree rows, and Unity-style drag-scrub number inputs that stay contained in the inspector.

**Architecture:** Pure helpers (`resize.ts`, `scrub.ts`) hold the math and are unit-tested. The `uiStore` gains persisted panel-layout state. `App.tsx` is restructured from CSS-grid-areas to a flexbox shell with `ResizeHandle` dividers driving pixel sizes. `NumberField` is rewritten as a scrub-pill (pointer-lock drag + click-to-edit); a whole scrub coalesces into one undo step via two new `robotStore` actions (`beginInteraction`/`endInteraction`).

**Tech Stack:** React 19, TypeScript, Zustand + zundo, Vitest, plain CSS (no new deps).

---

## File Structure

**Create:**
- `src/lib/resize.ts` — pure `clampSize` + per-panel min/max constants.
- `src/lib/resize.test.ts` — tests for `clampSize`.
- `src/lib/scrub.ts` — pure `scrubMultiplier` + `applyScrub`.
- `src/lib/scrub.test.ts` — tests for scrub math.
- `src/components/layout/ResizeHandle.tsx` — draggable divider (drag = resize, dbl-click = collapse).

**Modify:**
- `src/styles/theme.css` — replace dark/light vars with one glass token set.
- `src/styles/globals.css` — flex shell, `.glass`, resize handles, tree density, number-pill + vector fields, scrollbars.
- `src/state/uiStore.ts` — add persisted `PanelLayout` state + actions; remove `theme`.
- `src/state/robotStore.ts` — add `beginInteraction` / `endInteraction`.
- `src/state/robotStore.test.ts` — test interaction coalescing.
- `src/App.tsx` — flexbox shell, always-docked inspector, resize handles, drop `data-theme` effect.
- `src/components/inspector/fields/NumberField.tsx` — rewrite as scrub-pill.
- `src/components/inspector/fields/Vector3Field.tsx` — `.vec` contained row.
- `src/components/inspector/Inspector.tsx` — empty state when nothing selected.
- `src/components/layout/Toolbar.tsx` — remove theme toggle button.
- `src/components/layout/StatusBar.tsx` — neutral frost styling (class only; markup unchanged).

---

## Task 1: Glass theme tokens + shell/glass CSS

**Files:**
- Modify: `src/styles/theme.css`
- Modify: `src/styles/globals.css`

No unit test (pure styling). Verified by `tsc`, `vite build`, and visual check.

- [ ] **Step 1: Replace `theme.css` with one glass token set**

Replace the entire contents of `src/styles/theme.css` with:

```css
/* src/styles/theme.css — single flat visionOS-style glass theme. */
:root {
  --scene-bg: radial-gradient(120% 90% at 60% 10%, #232529 0%, #15171a 45%, #0c0d0f 100%);

  --glass: rgba(255, 255, 255, 0.10);
  --glass-hover: rgba(255, 255, 255, 0.07);
  --glass-sel: rgba(255, 255, 255, 0.18);
  --inset: rgba(0, 0, 0, 0.24);

  --stroke: rgba(255, 255, 255, 0.18);
  --blur: blur(44px) saturate(125%);

  --text: #f1f3f6;
  --text-dim: #a7adb7;
  --text-bright: #ffffff;

  --error: #f0b3b3;
  --warning: #e7d29a;

  --radius: 22px;
  --radius-sm: 14px;

  --grid-cell: #404040;
  --grid-section: #606060;
}
```

> Note: `--error`/`--warning` are kept (used by the problems panel) but desaturated to fit grayscale. `--grid-cell`/`--grid-section` are read by the 3D viewport grid — keep them.

- [ ] **Step 2: Replace the shell + glass sections of `globals.css`**

In `src/styles/globals.css`, replace the entire block from `/* ── App shell grid ── */` through the end of the `.status-bar` rule (the original lines defining `.app-shell`, `.toolbar` grid-area, `.tree-panel`, `.viewport-panel`, `.inspector-panel`, `.bottom-panel`, `.status-bar` grid-area) with:

```css
/* ── App shell (flexbox, floating glass cards) ── */
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 10px;
  gap: 10px;
  background: var(--scene-bg);
}
.app-mid {
  flex: 1;
  display: flex;
  min-height: 0;
}

.glass {
  background: var(--glass);
  backdrop-filter: var(--blur);
  -webkit-backdrop-filter: var(--blur);
  border: 1px solid var(--stroke);
  border-radius: var(--radius);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
}

.tree-panel {
  overflow: auto;
  flex: none;
}
.viewport-panel {
  flex: 1;
  min-width: 0;
  position: relative;
  overflow: hidden;
}
.inspector-panel {
  overflow: auto;
  flex: none;
}
.bottom-panel {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  flex: none;
}

/* ── Resize handles ── */
.resize-handle {
  flex: none;
  position: relative;
  z-index: 5;
}
.resize-handle.vertical {
  width: 10px;
  cursor: col-resize;
}
.resize-handle.horizontal {
  height: 10px;
  cursor: row-resize;
}
.resize-handle::after {
  content: "";
  position: absolute;
  inset: 0;
  margin: auto;
  background: var(--text-dim);
  opacity: 0;
  border-radius: 3px;
  transition: opacity 0.12s;
}
.resize-handle.vertical::after { width: 3px; height: 40px; }
.resize-handle.horizontal::after { height: 3px; width: 40px; }
.resize-handle:hover::after,
.resize-handle.dragging::after { opacity: 0.6; }

/* ── Status bar (neutral frost) ── */
.status-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 5px 12px;
  color: var(--text-dim);
  font-size: 12px;
}
.status-bar .dirty-dot { color: var(--text-bright); }

/* thin translucent scrollbars */
* { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.18) transparent; }
*::-webkit-scrollbar { width: 9px; height: 9px; }
*::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.18); border-radius: 6px; }
*::-webkit-scrollbar-track { background: transparent; }
```

- [ ] **Step 3: Update the toolbar + tab-bar CSS to frost**

In `src/styles/globals.css`, change the `.toolbar` rule's `background`/`border-bottom` so it reads as a glass bar, and update buttons. Replace the `.toolbar { ... }` declarations block (the styling one, not the grid-area) with:

```css
.toolbar {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 10px;
  flex-wrap: wrap;
}
```

Replace the `button { ... }` and `button.active` / `button.primary` rules with:

```css
button {
  font: inherit;
  color: var(--text);
  background: var(--glass-hover);
  border: 1px solid var(--stroke);
  border-radius: 10px;
  padding: 5px 11px;
  cursor: pointer;
}
button:hover:not(:disabled) { background: var(--glass); }
button:disabled { opacity: 0.4; cursor: default; }
button.active,
button.primary {
  background: var(--glass-sel);
  border-color: var(--stroke);
  color: var(--text-bright);
}
```

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed (CSS-only change; no type errors).

- [ ] **Step 5: Commit**

```bash
git add src/styles/theme.css src/styles/globals.css
git commit -m "feat(ui): flat grayscale visionOS glass theme + flex shell base"
```

---

## Task 2: Pure resize helper (TDD)

**Files:**
- Create: `src/lib/resize.ts`
- Test: `src/lib/resize.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/resize.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/resize.test.ts`
Expected: FAIL — `Cannot find module './resize'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/resize.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/resize.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/resize.ts src/lib/resize.test.ts
git commit -m "feat(ui): add pure clampSize helper for panel resizing"
```

---

## Task 3: Persisted panel-layout state in uiStore

**Files:**
- Modify: `src/state/uiStore.ts`
- Test: `src/state/uiStore.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `src/state/uiStore.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { useUiStore } from "./uiStore";

describe("uiStore panel layout", () => {
  beforeEach(() => {
    localStorage.clear();
    useUiStore.setState({
      layout: {
        treeW: 232, inspectorW: 296, bottomH: 180,
        treeCollapsed: false, inspectorCollapsed: false, bottomCollapsed: false,
      },
    });
  });

  it("setPanelSize clamps to the panel limits", () => {
    useUiStore.getState().setPanelSize("tree", 9999);
    expect(useUiStore.getState().layout.treeW).toBe(480); // tree max
    useUiStore.getState().setPanelSize("tree", 0);
    expect(useUiStore.getState().layout.treeW).toBe(160); // tree min
  });

  it("toggleCollapsed flips and restores the flag", () => {
    useUiStore.getState().toggleCollapsed("inspector");
    expect(useUiStore.getState().layout.inspectorCollapsed).toBe(true);
    useUiStore.getState().toggleCollapsed("inspector");
    expect(useUiStore.getState().layout.inspectorCollapsed).toBe(false);
  });

  it("persists layout to localStorage", () => {
    useUiStore.getState().setPanelSize("bottom", 200);
    expect(localStorage.getItem("urdf-studio:layout")).toContain("200");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/state/uiStore.test.ts`
Expected: FAIL — `setPanelSize is not a function` (and `layout` undefined).

- [ ] **Step 3: Rewrite `uiStore.ts`**

Replace the entire contents of `src/state/uiStore.ts` with:

```ts
// src/state/uiStore.ts
import { create } from "zustand";
import { clampSize, PANEL_LIMITS, type PanelKey } from "../lib/resize";

export type BottomTab = "problems" | "xml";

export interface Layers {
  visual: boolean;
  collision: boolean;
  inertial: boolean;
}

export interface PanelLayout {
  treeW: number;
  inspectorW: number;
  bottomH: number;
  treeCollapsed: boolean;
  inspectorCollapsed: boolean;
  bottomCollapsed: boolean;
}

interface UiState {
  layers: Layers;
  bottomTab: BottomTab;
  layout: PanelLayout;

  toggleLayer: (layer: keyof Layers) => void;
  setBottomTab: (tab: BottomTab) => void;
  setPanelSize: (panel: PanelKey, px: number) => void;
  toggleCollapsed: (panel: PanelKey) => void;
}

const LAYOUT_KEY = "urdf-studio:layout";

const DEFAULT_LAYOUT: PanelLayout = {
  treeW: 232,
  inspectorW: 296,
  bottomH: 180,
  treeCollapsed: false,
  inspectorCollapsed: false,
  bottomCollapsed: false,
};

function loadLayout(): PanelLayout {
  if (typeof localStorage === "undefined") return DEFAULT_LAYOUT;
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    if (!raw) return DEFAULT_LAYOUT;
    return { ...DEFAULT_LAYOUT, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_LAYOUT;
  }
}

function persistLayout(layout: PanelLayout): void {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
  }
}

const SIZE_FIELD: Record<PanelKey, keyof PanelLayout> = {
  tree: "treeW",
  inspector: "inspectorW",
  bottom: "bottomH",
};
const COLLAPSE_FIELD: Record<PanelKey, keyof PanelLayout> = {
  tree: "treeCollapsed",
  inspector: "inspectorCollapsed",
  bottom: "bottomCollapsed",
};

export const useUiStore = create<UiState>((set) => ({
  layers: { visual: true, collision: false, inertial: false },
  bottomTab: "problems",
  layout: loadLayout(),

  toggleLayer: (layer) =>
    set((s) => ({ layers: { ...s.layers, [layer]: !s.layers[layer] } })),

  setBottomTab: (tab) => set({ bottomTab: tab }),

  setPanelSize: (panel, px) =>
    set((s) => {
      const { min, max } = PANEL_LIMITS[panel];
      const layout = { ...s.layout, [SIZE_FIELD[panel]]: clampSize(px, 0, min, max) };
      persistLayout(layout);
      return { layout };
    }),

  toggleCollapsed: (panel) =>
    set((s) => {
      const field = COLLAPSE_FIELD[panel];
      const layout = { ...s.layout, [field]: !s.layout[field] };
      persistLayout(layout);
      return { layout };
    }),
}));
```

> `setPanelSize` clamps via `clampSize(px, 0, min, max)` (delta 0 = just clamp + round).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/state/uiStore.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/state/uiStore.ts src/state/uiStore.test.ts
git commit -m "feat(ui): persisted resizable/collapsible panel layout in uiStore"
```

---

## Task 4: ResizeHandle component + flexbox App shell

**Files:**
- Create: `src/components/layout/ResizeHandle.tsx`
- Modify: `src/App.tsx`

No unit test (DOM drag integration). Verified by `tsc`, build, and manual drag. The pure math it relies on is already tested in Task 2.

- [ ] **Step 1: Create `ResizeHandle.tsx`**

```tsx
// src/components/layout/ResizeHandle.tsx
import { useRef, useState } from "react";
import { useUiStore } from "../../state/uiStore";
import { clampSize, PANEL_LIMITS, type PanelKey } from "../../lib/resize";

interface Props {
  panel: PanelKey;
  orientation: "vertical" | "horizontal";
  /** +1 if dragging toward larger coords grows the panel, -1 if it shrinks it. */
  direction: 1 | -1;
}

/** Draggable divider: drag to resize the panel, double-click to collapse/restore. */
export function ResizeHandle({ panel, orientation, direction }: Props) {
  const setPanelSize = useUiStore((s) => s.setPanelSize);
  const toggleCollapsed = useUiStore((s) => s.toggleCollapsed);
  const [dragging, setDragging] = useState(false);
  const start = useRef({ coord: 0, size: 0 });

  const sizeField = panel === "tree" ? "treeW" : panel === "inspector" ? "inspectorW" : "bottomH";

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    start.current = {
      coord: orientation === "vertical" ? e.clientX : e.clientY,
      size: useUiStore.getState().layout[sizeField] as number,
    };
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const cur = orientation === "vertical" ? e.clientX : e.clientY;
    const delta = (cur - start.current.coord) * direction;
    const { min, max } = PANEL_LIMITS[panel];
    setPanelSize(panel, clampSize(start.current.size, delta, min, max));
  };

  const onPointerUp = (e: React.PointerEvent) => {
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    setDragging(false);
  };

  return (
    <div
      className={`resize-handle ${orientation}${dragging ? " dragging" : ""}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onDoubleClick={() => toggleCollapsed(panel)}
    />
  );
}
```

- [ ] **Step 2: Rewrite `App.tsx` as a flex shell**

Replace the entire contents of `src/App.tsx` with:

```tsx
// src/App.tsx
import { Toolbar } from "./components/layout/Toolbar";
import { StatusBar } from "./components/layout/StatusBar";
import { ResizeHandle } from "./components/layout/ResizeHandle";
import { RobotTree } from "./components/tree/RobotTree";
import { Viewport } from "./components/viewport/Viewport";
import { Inspector } from "./components/inspector/Inspector";
import { XmlPreview } from "./components/xml/XmlPreview";
import { ProblemsPanel } from "./components/problems/ProblemsPanel";
import { useUiStore } from "./state/uiStore";
import { useIssuesStore } from "./state/issuesStore";
import { useUndoRedo } from "./hooks/useUndoRedo";
import { useValidation } from "./hooks/useValidation";

export default function App() {
  const bottomTab = useUiStore((s) => s.bottomTab);
  const setBottomTab = useUiStore((s) => s.setBottomTab);
  const layout = useUiStore((s) => s.layout);
  const issueCount = useIssuesStore((s) => s.issues.length);

  useUndoRedo();
  useValidation();

  return (
    <div className="app-shell">
      <Toolbar />

      <div className="app-mid">
        <div
          className="tree-panel glass"
          style={{ flexBasis: layout.treeCollapsed ? 0 : layout.treeW, display: layout.treeCollapsed ? "none" : undefined }}
        >
          <RobotTree />
        </div>
        <ResizeHandle panel="tree" orientation="vertical" direction={1} />

        <div className="viewport-panel glass">
          <Viewport />
        </div>

        <ResizeHandle panel="inspector" orientation="vertical" direction={-1} />
        <div
          className="inspector-panel glass"
          style={{ flexBasis: layout.inspectorCollapsed ? 0 : layout.inspectorW, display: layout.inspectorCollapsed ? "none" : undefined }}
        >
          <Inspector />
        </div>
      </div>

      <ResizeHandle panel="bottom" orientation="horizontal" direction={-1} />
      <div
        className="bottom-panel glass"
        style={{ height: layout.bottomCollapsed ? undefined : layout.bottomH }}
      >
        <div className="tab-bar">
          <button
            className={bottomTab === "problems" ? "active" : ""}
            onClick={() => setBottomTab("problems")}
          >
            Problems{issueCount > 0 ? ` (${issueCount})` : ""}
          </button>
          <button
            className={bottomTab === "xml" ? "active" : ""}
            onClick={() => setBottomTab("xml")}
          >
            XML Preview
          </button>
        </div>
        {!layout.bottomCollapsed && (
          <div className="tab-content">
            {bottomTab === "problems" ? <ProblemsPanel /> : <XmlPreview />}
          </div>
        )}
      </div>

      <StatusBar />
    </div>
  );
}
```

> The inspector is now always rendered (its empty state is added in Task 8). The old `data-theme` effect and `no-inspector` class are gone. Double-clicking the bottom handle collapses it to just its tab bar.

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit && npm run build`
Expected: success. (Toolbar still references the removed `theme` — it is fixed in Task 7; if running tasks strictly in order, expect a tsc error here on `theme`/`toggleTheme` and proceed to Task 7 before building. To keep this task self-contained, do Step 4 of Task 7 conceptually now, or run Tasks 4 and 7 together.)

> **Ordering note:** Task 7 removes the `theme` usage in `Toolbar.tsx`. `tsc` will not be clean until both Task 4 and Task 7 are applied. Run them back-to-back, then build.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/ResizeHandle.tsx src/App.tsx
git commit -m "feat(ui): flexbox shell with draggable/collapsible panel dividers"
```

---

## Task 5: Scrub math helper (TDD)

**Files:**
- Create: `src/lib/scrub.ts`
- Test: `src/lib/scrub.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/scrub.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/scrub.test.ts`
Expected: FAIL — `Cannot find module './scrub'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/scrub.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/scrub.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/scrub.ts src/lib/scrub.test.ts
git commit -m "feat(ui): add pure drag-scrub math helpers"
```

---

## Task 6: Undo coalescing in robotStore (TDD)

**Files:**
- Modify: `src/state/robotStore.ts`
- Modify: `src/state/robotStore.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/state/robotStore.test.ts` (inside the existing top-level `describe`, or a new one — imports `useRobotStore` already exist there):

```ts
describe("interaction coalescing", () => {
  const sample = {
    name: "r",
    links: [{ name: "a" }],
    joints: [],
    materials: [],
  };

  it("collapses many updates between begin/endInteraction into one undo entry", () => {
    const s = useRobotStore.getState();
    s.setRobot(structuredClone(sample)); // clears history
    const temporal = useRobotStore.temporal.getState();
    expect(temporal.pastStates.length).toBe(0);

    s.beginInteraction();
    s.updateLink("a", { name: "a" }); // no-op-shaped but new object
    useRobotStore.getState().updateLink("a", { name: "a" });
    useRobotStore.getState().updateLink("a", { name: "a" });
    useRobotStore.getState().endInteraction();

    expect(useRobotStore.temporal.getState().pastStates.length).toBe(1);
  });

  it("adds no history entry if nothing changed during the interaction", () => {
    const s = useRobotStore.getState();
    s.setRobot(structuredClone(sample));
    s.beginInteraction();
    s.endInteraction();
    expect(useRobotStore.temporal.getState().pastStates.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/state/robotStore.test.ts`
Expected: FAIL — `beginInteraction is not a function`.

- [ ] **Step 3: Implement begin/endInteraction**

In `src/state/robotStore.ts`:

Add to the `RobotState` interface (after `markSaved`):

```ts
  /** Begin a continuous gesture (e.g. scrub): suspends undo history. */
  beginInteraction: () => void;
  /** End the gesture: records the whole change as ONE undo entry. */
  endInteraction: () => void;
```

Add a module-level snapshot variable just above `export const useRobotStore`:

```ts
let interactionSnapshot: Robot | null = null;
```

Add these two actions inside the store object (e.g. right after `markSaved`):

```ts
      beginInteraction: () => {
        interactionSnapshot = get().robot;
        useRobotStore.temporal.getState().pause();
      },

      endInteraction: () => {
        const temporal = useRobotStore.temporal.getState();
        const final = get().robot;
        if (interactionSnapshot && final && interactionSnapshot !== final) {
          // Restore the pre-gesture state while still paused (unrecorded),
          // resume, then re-apply the final value as a single tracked change.
          set({ robot: interactionSnapshot });
          temporal.resume();
          set({ robot: final, dirty: true });
        } else {
          temporal.resume();
        }
        interactionSnapshot = null;
      },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/state/robotStore.test.ts`
Expected: PASS (existing 13 tests + 2 new).

- [ ] **Step 5: Commit**

```bash
git add src/state/robotStore.ts src/state/robotStore.test.ts
git commit -m "feat(state): coalesce a drag gesture into one undo entry"
```

---

## Task 7: Rewrite NumberField as a Unity scrub-pill + Vector3 layout

**Files:**
- Modify: `src/components/inspector/fields/NumberField.tsx`
- Modify: `src/components/inspector/fields/Vector3Field.tsx`
- Modify: `src/components/layout/Toolbar.tsx` (remove theme toggle)
- Modify: `src/styles/globals.css` (field/pill styles)

- [ ] **Step 1: Rewrite `NumberField.tsx`**

Replace the entire contents of `src/components/inspector/fields/NumberField.tsx` with:

```tsx
// src/components/inspector/fields/NumberField.tsx
import { useEffect, useRef, useState } from "react";
import { useRobotStore } from "../../../state/robotStore";
import { scrubMultiplier, applyScrub } from "../../../lib/scrub";

interface Props {
  label?: string;
  value: number;
  step?: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
}

function decimalsOf(step: number): number {
  const s = String(step);
  const d = s.includes(".") ? s.split(".")[1].length : 0;
  return Math.min(Math.max(d, 1), 4);
}

/** Unity-style number field: drag the label to scrub, click the value to type. */
export function NumberField({ label, value, step = 0.01, min, max, onChange }: Props) {
  const precision = decimalsOf(step);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const scrubbing = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const display = value.toFixed(precision);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  // ── scrub (drag the label) ──
  const onLabelPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    scrubbing.current = true;
    useRobotStore.getState().beginInteraction();
    const el = e.currentTarget as HTMLElement;
    if (el.requestPointerLock) el.requestPointerLock();
    else el.setPointerCapture(e.pointerId);
  };
  const onLabelPointerMove = (e: React.PointerEvent) => {
    if (!scrubbing.current) return;
    const mult = scrubMultiplier({ shift: e.shiftKey, alt: e.altKey });
    onChange(applyScrub(value, e.movementX, step, mult, min, max));
  };
  const endScrub = () => {
    if (!scrubbing.current) return;
    scrubbing.current = false;
    if (document.pointerLockElement) document.exitPointerLock();
    useRobotStore.getState().endInteraction();
  };

  // ── click to edit ──
  const startEdit = () => { setText(display); setEditing(true); };
  const commit = (ok: boolean) => {
    if (ok) {
      const n = parseFloat(text);
      if (!Number.isNaN(n)) {
        const clamped = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));
        onChange(clamped);
      }
    }
    setEditing(false);
  };

  return (
    <div className={`num${scrubbing.current ? " scrubbing" : ""}${editing ? " editing" : ""}`}>
      {label !== undefined && (
        <span
          className="lab"
          onPointerDown={onLabelPointerDown}
          onPointerMove={onLabelPointerMove}
          onPointerUp={endScrub}
          onLostPointerCapture={endScrub}
        >
          {label}
        </span>
      )}
      {editing ? (
        <input
          ref={inputRef}
          className="val-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation(); // keep Ctrl+Z scoped to the text field
            if (e.key === "Enter") commit(true);
            if (e.key === "Escape") commit(false);
          }}
          onBlur={() => commit(true)}
        />
      ) : (
        <span className="val" onClick={startEdit}>{display}</span>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Rewrite `Vector3Field.tsx`**

Replace the entire contents of `src/components/inspector/fields/Vector3Field.tsx` with:

```tsx
// src/components/inspector/fields/Vector3Field.tsx
import { NumberField } from "./NumberField";

type Vec3 = [number, number, number];

interface Props {
  label?: string;
  value: Vec3;
  labels?: [string, string, string];
  step?: number;
  min?: number;
  max?: number;
  onChange: (value: Vec3) => void;
}

export function Vector3Field({
  label,
  value,
  labels = ["X", "Y", "Z"],
  step,
  min,
  max,
  onChange,
}: Props) {
  const set = (i: number, v: number) => {
    const next: Vec3 = [...value];
    next[i] = v;
    onChange(next);
  };
  return (
    <div className="field">
      {label !== undefined && <label>{label}</label>}
      <div className="vec">
        {value.map((v, i) => (
          <NumberField
            key={i}
            label={labels[i]}
            value={v}
            step={step}
            min={min}
            max={max}
            onChange={(n) => set(i, n)}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Remove the theme toggle from `Toolbar.tsx`**

In `src/components/layout/Toolbar.tsx`:
- Delete the two lines reading `const theme = useUiStore((s) => s.theme);` and `const toggleTheme = useUiStore((s) => s.toggleTheme);`.
- Delete the trailing theme `<button>` block:

```tsx
      <span className="spacer" />
      <button onClick={toggleTheme} title="Toggle theme">
        {theme === "dark" ? "☾ Dark" : "☀ Light"}
      </button>
```

Replace it with just:

```tsx
      <span className="spacer" />
```

- [ ] **Step 4: Add field/pill styles to `globals.css`**

In `src/styles/globals.css`, replace the existing `.field input, .field select { ... }`, `.field input:focus,...`, `.vector3 ...` rules (the inspector form-field block) with:

```css
.field {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.field > label {
  flex: 0 0 64px;
  color: var(--text-dim);
}
/* generic text/select inputs (name fields, dropdowns) */
.field > input,
.field > select {
  flex: 1;
  min-width: 0;
  font: inherit;
  color: var(--text);
  background: var(--inset);
  border: 1px solid var(--stroke);
  border-radius: 9px;
  padding: 4px 8px;
}
.field > input:focus,
.field > select:focus {
  outline: none;
  border-color: var(--text-dim);
}

/* Unity scrub-pill number field */
.num {
  flex: 1;
  display: flex;
  align-items: center;
  min-width: 0;
  background: var(--inset);
  border: 1px solid var(--stroke);
  border-radius: 10px;
  overflow: hidden;
  transition: border-color 0.12s;
}
.num.scrubbing,
.num.editing { border-color: var(--text-dim); }
.num .lab {
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 700;
  color: var(--text-dim);
  background: var(--glass-hover);
  cursor: ew-resize;
  user-select: none;
  touch-action: none;
}
.num .lab:hover { background: var(--glass); }
.num .val {
  flex: 1;
  min-width: 0;
  padding: 4px 9px;
  text-align: right;
  font-variant-numeric: tabular-nums;
  cursor: text;
  white-space: nowrap;
  overflow: hidden;
}
.num .val-input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--text-bright);
  font: inherit;
  text-align: right;
  font-variant-numeric: tabular-nums;
  padding: 4px 9px;
}

/* vector row: three pills that shrink to fit the panel */
.vec {
  display: flex;
  gap: 6px;
  flex: 1;
  min-width: 0;
}
.vec .num { flex: 1; }
```

- [ ] **Step 5: Verify build + tests**

Run: `npx tsc --noEmit && npm run build && npx vitest run`
Expected: tsc clean (theme refs now removed), build succeeds, all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/inspector/fields/NumberField.tsx src/components/inspector/fields/Vector3Field.tsx src/components/layout/Toolbar.tsx src/styles/globals.css
git commit -m "feat(ui): Unity-style drag-scrub number fields, contained vectors; drop theme toggle"
```

---

## Task 8: Tree density, inspector empty state, final styling polish

**Files:**
- Modify: `src/styles/globals.css` (tree + form-section + tab-bar frost)
- Modify: `src/components/inspector/Inspector.tsx` (empty state)

- [ ] **Step 1: Tighten tree rows + frost form sections in `globals.css`**

Replace the `.tree-row { ... }` block and `.tree-children { ... }` rule with:

```css
.tree-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 6px;
  cursor: pointer;
  white-space: nowrap;
  border-radius: 7px;
}
.tree-row:hover { background: var(--glass-hover); }
.tree-row.selected { background: var(--glass-sel); color: var(--text-bright); }
.tree-children {
  margin-left: 12px;
  border-left: 1px solid var(--stroke);
  padding-left: 4px;
}
```

Replace the `.form-section`, `.form-section > header`, and `.form-section > .body` rules with:

```css
.form-section {
  border: 1px solid var(--stroke);
  border-radius: var(--radius-sm);
  margin: 0 0 10px;
  background: var(--glass-hover);
  overflow: hidden;
}
.form-section > header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 11px;
  background: var(--glass-hover);
  cursor: pointer;
  user-select: none;
  font-size: 10.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-dim);
}
.form-section > .body { padding: 10px 11px; }
```

Replace the `.tab-bar { ... }`, `.tab-bar button`, and `.tab-bar button.active` rules with:

```css
.tab-bar {
  display: flex;
  gap: 5px;
  padding: 6px 8px 0;
}
.tab-bar button {
  border: none;
  background: transparent;
  border-radius: 8px 8px 0 0;
  padding: 5px 13px;
  color: var(--text-dim);
}
.tab-bar button.active {
  color: var(--text-bright);
  background: var(--glass-hover);
  border-bottom: 2px solid var(--text-dim);
}
```

- [ ] **Step 2: Add an inspector empty state**

Replace the entire contents of `src/components/inspector/Inspector.tsx` with:

```tsx
// src/components/inspector/Inspector.tsx
import { useRobotStore } from "../../state/robotStore";
import { useSelectionStore } from "../../state/selectionStore";
import { LinkForm } from "./LinkForm";
import { JointForm } from "./JointForm";

export function Inspector() {
  const selected = useSelectionStore((s) => s.selected);
  const robot = useRobotStore((s) => s.robot);

  if (!selected || !robot) {
    return <div className="panel-empty">Select a link or joint to edit its properties.</div>;
  }

  if (selected.kind === "link") {
    const link = robot.links.find((l) => l.name === selected.name);
    return link ? <LinkForm link={link} /> : null;
  }
  const joint = robot.joints.find((j) => j.name === selected.name);
  return joint ? <JointForm joint={joint} /> : null;
}
```

> `.panel-empty` already exists in `globals.css` (used by the problems panel).

- [ ] **Step 3: Verify everything**

Run: `npx tsc --noEmit && npm run build && npx vitest run`
Expected: tsc clean, build succeeds, all frontend tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/styles/globals.css src/components/inspector/Inspector.tsx
git commit -m "feat(ui): tighter tree rows, frosted sections, inspector empty state"
```

---

## Task 9: Full verification + manual smoke

**Files:** none (verification only).

- [ ] **Step 1: Run the whole test + build matrix**

Run:
```bash
npx vitest run
npx tsc --noEmit
npm run build
. ~/.cargo/env && cargo test -p urdf-core
```
Expected: frontend tests pass (29 existing + 6 resize + 8 scrub + 3 uiStore + 2 robotStore = 48), tsc clean, build OK, 40 Rust tests pass (unchanged).

- [ ] **Step 2: Manual smoke in the native app**

Run: `npm run tauri dev`, then verify:
- Drag the tree↔viewport, viewport↔inspector, and bottom dividers — panels resize and clamp.
- Double-click each divider — panel collapses; double-click again restores.
- Reload / relaunch — panel sizes and collapsed flags persisted.
- Select a link → inspector shows forms; deselect → empty-state message (panel width does not jump).
- In a Position field: drag the `X` label → value scrubs and the 3D model moves; hold Shift (faster), Alt (finer).
- Pointer-lock engages during scrub (cursor hidden); releasing restores it.
- One Ctrl+Z reverts the entire scrub (not pixel-by-pixel).
- Click a value → type a number → Enter commits, Esc cancels; Ctrl+Z while the field is focused edits the text, not the model.
- Vector3 pills stay inside the inspector even at minimum inspector width.
- Theme reads as flat grayscale frost with no color and no gradient.

- [ ] **Step 3: Final commit (if any stray changes)**

```bash
git add -A && git commit -m "chore(ui): redesign verification" || true
```

---

## Self-Review

**Spec coverage:**
- Resizable tree/inspector/bottom → Tasks 2, 3, 4. ✓
- Collapsible + persisted → Task 3 (`toggleCollapsed`, `persistLayout`) + Task 4 (App wiring). ✓
- Inspector always docked + empty state → Task 4 + Task 8. ✓
- Tighter tree rows → Task 8. ✓
- Contained Unity inputs (scrub + click-edit, Shift/Alt, pointer-lock) → Tasks 5, 7. ✓
- One-undo-per-scrub + Ctrl+Z text scoping → Task 6 + Task 7 (`stopPropagation`). ✓
- Flat grayscale visionOS glass, no gradient/sheen, single theme → Tasks 1, 7, 8; theme field removed in Task 3/7. ✓

**Placeholder scan:** None — every code/CSS/command step is concrete.

**Type consistency:** `PanelKey` ("tree"|"inspector"|"bottom") and `PANEL_LIMITS`/`clampSize` are defined in Task 2 and used identically in Tasks 3, 4. `scrubMultiplier`/`applyScrub` signatures defined in Task 5 match their use in Task 7. `beginInteraction`/`endInteraction` defined in Task 6 match the calls in Task 7. `PanelLayout` field names (`treeW`/`inspectorW`/`bottomH`/`*Collapsed`) are consistent across Tasks 3 and 4. ✓

**Known cross-task ordering:** Tasks 4 and 7 must both land before `tsc` is clean (Task 7 removes the `theme` usage that Task 4's new `App.tsx` no longer provides). Noted in Task 4 Step 3.
