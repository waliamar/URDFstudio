# Viewport Gizmos & Inspector UI Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two inspector UI defects (invisible dropdowns, lost precision on focus) and add a Unity-style transform gizmo + nav gizmo + navigation controls to the 3D viewport, plus a root architecture doc.

**Architecture:** Pure helpers (number formatting, euler↔rpy, gizmo write-back) are unit-tested in Node/vitest. React/r3f components (custom dropdown, `TransformGizmo`, viewport controls) are verified via `tsc --noEmit` + `vite build` + manual check, since the test env is `node` with no DOM/WebGL test harness. The gizmo attaches drei `TransformControls` to a named scene group whose **local** transform equals the URDF joint origin, so dragging maps directly back to `joint.origin` (or `visual.origin` for root links).

**Tech Stack:** React 19, `@react-three/fiber` 9, `@react-three/drei` 10.7.7, `three` 0.176, Zustand 5 (+ zundo), vitest 3 (node env).

**Key facts for the implementer:**
- Tests run in **node** (`vite.config.ts` → `test: { environment: "node" }`). `three` math classes (`Euler`, `Vector3`, `Quaternion`) work headless. **Do not** write React-render tests — there is no `@testing-library` and no jsdom.
- `tsconfig.json` has `noUnusedLocals` + `noUnusedParameters` — no dead variables/params.
- Zustand v5: any selector returning a fresh array/object must be wrapped in `useShallow` (already the project convention). The new code selects primitives/stored refs, so no wrappers needed.
- Verification commands used throughout:
  - `npm test` (vitest run)
  - `npx tsc --noEmit`
  - `npm run build` (runs `tsc --noEmit && vite build`)
- `cargo`/`urdf-core` is untouched by this work.

---

### Task 1: Number-formatting helpers (full precision on focus)

**Files:**
- Create: `src/lib/numberFormat.ts`
- Test: `src/lib/numberFormat.test.ts`
- Modify: `src/components/inspector/fields/NumberField.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/lib/numberFormat.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- numberFormat`
Expected: FAIL — `Cannot find module './numberFormat'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/numberFormat.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- numberFormat`
Expected: PASS (3 tests).

- [ ] **Step 5: Refactor `NumberField` to use the helpers**

In `src/components/inspector/fields/NumberField.tsx`:

Replace the local `decimalsOf` function (lines ~19-23) — delete it — and update the import block at the top (after the existing imports) to add:

```ts
import { decimalsOf, displayValue, editSeed } from "../../../lib/numberFormat";
```

Change the precision/display lines (~36, ~42) so they read:

```ts
  const precision = decimalsOf(step);
```
```ts
  const display = displayValue(value, precision);
```

Change `startEdit` (~83) to seed the **exact** value:

```ts
  const startEdit = () => { if (disabled) return; setText(editSeed(value)); setEditing(true); };
```

(The blurred `<span className="val">{display}</span>` stays as-is, so unfocused fields still show 2 dp.)

- [ ] **Step 6: Verify types + tests**

Run: `npx tsc --noEmit && npm test`
Expected: tsc clean; all tests pass (incl. existing 29 + 3 new).

- [ ] **Step 7: Commit**

```bash
git add src/lib/numberFormat.ts src/lib/numberFormat.test.ts src/components/inspector/fields/NumberField.tsx
git commit -m "fix(inspector): show exact value when a number field is focused"
```

---

### Task 2: `eulerToRpy` inverse in transforms

**Files:**
- Modify: `src/lib/transforms.ts`
- Test: `src/lib/transforms.test.ts` (append)

- [ ] **Step 1: Write the failing test**

Append to `src/lib/transforms.test.ts`:

```ts
import { eulerToRpy } from "./transforms";
import * as THREE from "three";

describe("eulerToRpy", () => {
  const cases: [number, number, number][] = [
    [0, 0, 0],
    [0.1, -0.2, 0.3],
    [Math.PI / 4, Math.PI / 3, -Math.PI / 6],
    [2.0, -1.8, 2.5], // angles past ±π/2
  ];

  it("round-trips with rpyToEuler", () => {
    for (const rpy of cases) {
      const back = eulerToRpy(rpyToEuler(rpy));
      back.forEach((v, i) => expect(v).toBeCloseTo(rpy[i], 6));
    }
  });

  it("converts an arbitrary-order euler while preserving orientation", () => {
    const e = new THREE.Euler(0.3, -0.7, 1.1, "XYZ");
    const rpy = eulerToRpy(e);
    const q1 = new THREE.Quaternion().setFromEuler(e);
    const q2 = new THREE.Quaternion().setFromEuler(rpyToEuler(rpy));
    expect(q1.angleTo(q2)).toBeCloseTo(0, 6);
  });
});
```

Ensure `rpyToEuler` is imported at the top of the existing test file (it almost certainly already is; if not, add `import { rpyToEuler } from "./transforms";`).

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- transforms`
Expected: FAIL — `eulerToRpy is not a function` / not exported.

- [ ] **Step 3: Write minimal implementation**

Add to `src/lib/transforms.ts` (after `rpyToEuler`):

```ts
/** Inverse of rpyToEuler: a three.js Euler -> URDF rpy = [roll, pitch, yaw].
 *  Reorders to "ZYX" first so the components line up with URDF's fixed-axis
 *  X-Y-Z convention, preserving the orientation. */
export function eulerToRpy(euler: THREE.Euler): [number, number, number] {
  const e = euler.clone();
  if (e.order !== "ZYX") e.reorder("ZYX");
  return [e.x, e.y, e.z];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- transforms`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/transforms.ts src/lib/transforms.test.ts
git commit -m "feat(transforms): add eulerToRpy inverse for gizmo write-back"
```

---

### Task 3: Gizmo write-back helper

**Files:**
- Create: `src/lib/gizmo.ts`
- Test: `src/lib/gizmo.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/gizmo.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { originFromLocal } from "./gizmo";
import { rpyToEuler } from "./transforms";

describe("originFromLocal", () => {
  it("reads a local position + rotation into a URDF origin", () => {
    const pos = new THREE.Vector3(0.1, -0.2, 0.3);
    const rot = rpyToEuler([0.2, 0.4, -0.1]);
    const origin = originFromLocal(pos, rot);
    expect(origin.xyz[0]).toBeCloseTo(0.1, 6);
    expect(origin.xyz[1]).toBeCloseTo(-0.2, 6);
    expect(origin.xyz[2]).toBeCloseTo(0.3, 6);
    origin.rpy.forEach((v, i) => expect(v).toBeCloseTo([0.2, 0.4, -0.1][i], 6));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- gizmo`
Expected: FAIL — `Cannot find module './gizmo'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/gizmo.ts`:

```ts
// src/lib/gizmo.ts
// Maps a dragged scene object's LOCAL transform onto a URDF origin. The link's
// local transform (relative to its parent group) equals the joint origin that
// places it, so this is a direct read-back.
import * as THREE from "three";
import { eulerToRpy } from "./transforms";

export interface Origin {
  xyz: [number, number, number];
  rpy: [number, number, number];
}

export function originFromLocal(position: THREE.Vector3, rotation: THREE.Euler): Origin {
  return {
    xyz: [position.x, position.y, position.z],
    rpy: eulerToRpy(rotation),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- gizmo`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/gizmo.ts src/lib/gizmo.test.ts
git commit -m "feat(gizmo): add originFromLocal write-back helper"
```

---

### Task 4: Name link frames in the scene graph

The gizmo and frame-selected need to locate a link's frame by name. The **joint-positioned wrapper group** for each child link has a local transform equal to that joint's origin — name it `link:<childName>`. Each root link gets its own named wrapper at identity. The visual subgroup (for root-link editing) is named `linkvisual:<name>`.

**Files:**
- Modify: `src/components/viewport/RobotModel.tsx`
- Modify: `src/components/viewport/LinkMesh.tsx`

- [ ] **Step 1: Name the link wrappers in `RobotModel.tsx`**

Replace the whole file body of `src/components/viewport/RobotModel.tsx` with:

```tsx
// src/components/viewport/RobotModel.tsx
import { useRobotStore } from "../../state/robotStore";
import { buildTree, type LinkNode } from "../../lib/kinematics";
import { rpyToEuler } from "../../lib/transforms";
import { LinkMesh } from "./LinkMesh";

function NodeGroup({ node }: { node: LinkNode }) {
  return (
    <group>
      <LinkMesh link={node.link} />
      {node.children.map(({ joint, node: childNode }) => (
        // This wrapper's LOCAL transform == joint.origin, so the transform
        // gizmo can read it straight back. Named for getObjectByName lookup.
        <group
          key={joint.name}
          name={`link:${childNode.link.name}`}
          position={joint.origin.xyz}
          rotation={rpyToEuler(joint.origin.rpy)}
        >
          <NodeGroup node={childNode} />
        </group>
      ))}
    </group>
  );
}

export function RobotModel() {
  const robot = useRobotStore((s) => s.robot);
  if (!robot) return null;
  const { roots } = buildTree(robot);
  return (
    <>
      {roots.map((node) => (
        <group key={node.link.name} name={`link:${node.link.name}`}>
          <NodeGroup node={node} />
        </group>
      ))}
    </>
  );
}
```

- [ ] **Step 2: Name the visual subgroup in `LinkMesh.tsx`**

In `src/components/viewport/LinkMesh.tsx`, the visual group (~line 226) currently starts:

```tsx
      <group
        key="visual"
        position={link.visual.origin.xyz}
```

Add a `name` so root-link gizmo edits can target it:

```tsx
      <group
        key="visual"
        name={`linkvisual:${link.name}`}
        position={link.visual.origin.xyz}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm run build`
Expected: clean compile + successful build. (No behavior change yet; this just labels groups.)

- [ ] **Step 4: Commit**

```bash
git add src/components/viewport/RobotModel.tsx src/components/viewport/LinkMesh.tsx
git commit -m "refactor(viewport): name link frames for gizmo lookup"
```

---

### Task 5: Custom dropdown component (`SelectField`)

Replace the native `<select>` with a glass-pill dropdown + portaled menu so options are readable on the dark theme. Same `Props` API — no call-site changes.

**Files:**
- Modify (rewrite): `src/components/inspector/fields/SelectField.tsx`
- Modify: `src/styles/globals.css` (append a dropdown block)

- [ ] **Step 1: Rewrite `SelectField.tsx`**

Replace the entire file with:

```tsx
// src/components/inspector/fields/SelectField.tsx
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface Option {
  value: string;
  label?: string;
}

interface Props {
  label?: string;
  value: string;
  options: (string | Option)[];
  onChange: (value: string) => void;
}

/** Glass-pill dropdown that mimics the Unity-style xyz number fields. The open
 *  menu is portaled to <body> so the scrolling inspector cannot clip it, and is
 *  fully theme-styled (native <option> popups render white-on-white here). */
export function SelectField({ label, value, options, onChange }: Props) {
  const opts = options.map((o) =>
    typeof o === "string" ? { value: o, label: o } : { value: o.value, label: o.label ?? o.value },
  );
  const current = opts.find((o) => o.value === value);

  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const openMenu = () => {
    setHighlight(Math.max(0, opts.findIndex((o) => o.value === value)));
    setRect(triggerRef.current?.getBoundingClientRect() ?? null);
    setOpen(true);
  };
  const close = () => setOpen(false);
  const pick = (v: string) => { onChange(v); close(); };

  // Close on any outside pointerdown (capture phase, so it fires before clicks).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if ((t as HTMLElement).closest?.(".select-menu")) return;
      close();
    };
    window.addEventListener("pointerdown", onDown, true);
    return () => window.removeEventListener("pointerdown", onDown, true);
  }, [open]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation(); // keep global Ctrl+Z scoped away from the control
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") { e.preventDefault(); openMenu(); }
      return;
    }
    if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((h) => Math.min(opts.length - 1, h + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => Math.max(0, h - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); pick(opts[highlight].value); }
  };

  return (
    <div className="field">
      {label !== undefined && <label>{label}</label>}
      <button
        ref={triggerRef}
        type="button"
        className={`select-trigger${open ? " open" : ""}`}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={onKeyDown}
      >
        <span className="select-value">{current?.label ?? value}</span>
        <span className="select-chevron">▾</span>
      </button>
      {open && rect &&
        createPortal(
          <div
            className="select-menu"
            style={{ position: "fixed", top: rect.bottom + 4, left: rect.left, minWidth: rect.width }}
          >
            {opts.map((o, i) => (
              <div
                key={o.value}
                className={`select-option${o.value === value ? " selected" : ""}${i === highlight ? " active" : ""}`}
                onPointerEnter={() => setHighlight(i)}
                onClick={() => pick(o.value)}
              >
                {o.label}
              </div>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
```

- [ ] **Step 2: Append dropdown styles to `globals.css`**

Add to the end of `src/styles/globals.css`:

```css
/* ── Custom dropdown (mimics the xyz number pills) ── */
.select-trigger {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  font: inherit;
  color: var(--text);
  background: var(--inset);
  border: 1px solid var(--stroke);
  border-radius: 10px;
  padding: 4px 9px;
  cursor: pointer;
  text-align: left;
}
.select-trigger:hover { background: var(--glass-hover); }
.select-trigger.open { border-color: var(--text-dim); }
.select-trigger .select-value {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.select-trigger .select-chevron {
  flex: 0 0 auto;
  color: var(--text-dim);
  font-size: 10px;
}
.select-menu {
  z-index: 1000;
  max-height: 240px;
  overflow: auto;
  padding: 4px;
  background: var(--glass);
  backdrop-filter: var(--blur);
  -webkit-backdrop-filter: var(--blur);
  border: 1px solid var(--stroke);
  border-radius: var(--radius-sm);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.55);
}
.select-option {
  padding: 6px 10px;
  border-radius: 8px;
  color: var(--text);
  white-space: nowrap;
  cursor: pointer;
}
.select-option.active { background: var(--glass-hover); }
.select-option.selected { background: var(--glass-sel); color: var(--text-bright); }
```

- [ ] **Step 3: Verify types + build**

Run: `npx tsc --noEmit && npm run build`
Expected: clean compile + build.

- [ ] **Step 4: Manual verification**

Run `npm run dev`, open the inspector for a link. Confirm: the **shape**, **material**, and **joint type** dropdowns show a dark glass pill; opening one shows a readable dark menu (no white-on-white); selected row is highlighted; arrow keys + Enter + click + click-outside all work; the menu is not clipped by the inspector scroll area.

- [ ] **Step 5: Commit**

```bash
git add src/components/inspector/fields/SelectField.tsx src/styles/globals.css
git commit -m "fix(inspector): custom themed dropdown (fixes invisible options)"
```

---

### Task 6: Transform gizmo

Attach drei `TransformControls` to the selected link/joint's named group; W = translate, E = rotate, X = local/world; write drags back to `joint.origin` (or root link's `visual.origin`) as a single undo entry.

**Files:**
- Create: `src/components/viewport/TransformGizmo.tsx`
- Modify: `src/components/viewport/Viewport.tsx`

- [ ] **Step 1: Create `TransformGizmo.tsx`**

```tsx
// src/components/viewport/TransformGizmo.tsx
import { useEffect, useState } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { TransformControls } from "@react-three/drei";
import { useSelectionStore } from "../../state/selectionStore";
import { useRobotStore } from "../../state/robotStore";
import { originFromLocal } from "../../lib/gizmo";

type Mode = "translate" | "rotate";

type Commit = (xyz: [number, number, number], rpy: [number, number, number]) => void;

/** Resolve which named scene group the gizmo drives and how to persist a drag. */
function useGizmoTarget(): { target: THREE.Object3D | null; commit: Commit | null } {
  const scene = useThree((s) => s.scene);
  const selected = useSelectionStore((s) => s.selected);
  const robot = useRobotStore((s) => s.robot);
  const [target, setTarget] = useState<THREE.Object3D | null>(null);

  let objectName: string | null = null;
  let commit: Commit | null = null;

  if (selected && robot) {
    if (selected.kind === "joint") {
      const joint = robot.joints.find((j) => j.name === selected.name);
      if (joint) {
        objectName = `link:${joint.child}`;
        commit = (xyz, rpy) =>
          useRobotStore.getState().updateJoint(joint.name, { origin: { xyz, rpy } });
      }
    } else {
      const parent = robot.joints.find((j) => j.child === selected.name);
      if (parent) {
        objectName = `link:${selected.name}`;
        commit = (xyz, rpy) =>
          useRobotStore.getState().updateJoint(parent.name, { origin: { xyz, rpy } });
      } else {
        const link = robot.links.find((l) => l.name === selected.name);
        if (link?.visual) {
          const visual = link.visual;
          objectName = `linkvisual:${selected.name}`;
          commit = (xyz, rpy) =>
            useRobotStore.getState().updateLink(selected.name, {
              visual: { ...visual, origin: { xyz, rpy } },
            });
        }
      }
    }
  }

  // Resolve the Object3D once the scene reflects the current selection/model.
  useEffect(() => {
    setTarget(objectName ? scene.getObjectByName(objectName) ?? null : null);
  }, [scene, objectName, robot]);

  return { target, commit };
}

/** Unity-style transform gizmo on the selected link/joint. W=move, E=rotate,
 *  X=toggle local/world. Drags commit as one undo entry. */
export function TransformGizmo() {
  const { target, commit } = useGizmoTarget();
  const [mode, setMode] = useState<Mode>("translate");
  const [space, setSpace] = useState<"local" | "world">("local");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === "w" || e.key === "W") setMode("translate");
      else if (e.key === "e" || e.key === "E") setMode("rotate");
      else if (e.key === "x" || e.key === "X") setSpace((s) => (s === "local" ? "world" : "local"));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!target || !commit) return null;

  const onObjectChange = () => {
    const { xyz, rpy } = originFromLocal(target.position, target.rotation);
    commit(xyz, rpy);
  };

  return (
    <TransformControls
      object={target}
      mode={mode}
      space={space}
      onMouseDown={() => useRobotStore.getState().beginInteraction()}
      onMouseUp={() => useRobotStore.getState().endInteraction()}
      onObjectChange={onObjectChange}
    />
  );
}
```

> Note: drei's `TransformControls` automatically disables the `makeDefault`
> `OrbitControls` while dragging, so orbit/pan won't fight the gizmo.

- [ ] **Step 2: Mount it in `Viewport.tsx`**

In `src/components/viewport/Viewport.tsx`, add the import:

```tsx
import { TransformGizmo } from "./TransformGizmo";
```

and render it as a sibling **after** the Z-up `<group>` (so it lives in world space and reads the target's full parent chain), just before `<OrbitControls ...>`:

```tsx
      {/* Map URDF Z-up into three.js Y-up. */}
      <group rotation={[-Math.PI / 2, 0, 0]}>
        <RobotModel />
      </group>

      <TransformGizmo />

      <OrbitControls makeDefault enableDamping />
```

- [ ] **Step 3: Verify types + build**

Run: `npx tsc --noEmit && npm run build`
Expected: clean compile + build.

- [ ] **Step 4: Manual verification**

Run `npm run dev`. Select a non-root link: a translate gizmo appears at its frame. Drag an axis → the link (and its subtree) moves, the inspector's joint `origin.xyz` updates live, and a **single** Ctrl+Z reverts the whole drag. Press `E` → rotate handles; dragging updates `origin.rpy`. Press `X` → handles switch between local/world. Select the root link → gizmo edits its `visual.origin`. Confirm orbit (Alt+LMB, after Task 7) does not fire while dragging a handle.

- [ ] **Step 5: Commit**

```bash
git add src/components/viewport/TransformGizmo.tsx src/components/viewport/Viewport.tsx
git commit -m "feat(viewport): Unity-style transform gizmo on selected link/joint"
```

---

### Task 7: Nav gizmo + Unity-style navigation controls

Add the corner axis gizmo and remap navigation: Alt+LMB orbit, MMB pan, RMB/scroll zoom, plain LMB select, F to frame the selected link.

**Files:**
- Create: `src/components/viewport/useViewportControls.ts`
- Modify: `src/components/viewport/Viewport.tsx`

- [ ] **Step 1: Create the controls hook**

```ts
// src/components/viewport/useViewportControls.ts
import { useEffect } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useSelectionStore } from "../../state/selectionStore";

/** Unity Scene-view navigation: plain LMB stays free for selection; Alt+LMB
 *  orbits; MMB pans; RMB/scroll zoom; F frames the selected link. */
export function useViewportControls(
  controls: React.RefObject<OrbitControlsImpl | null>,
) {
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);

  useEffect(() => {
    const c = controls.current;
    if (c) c.enableRotate = false; // orbit only while Alt is held

    const frameSelected = () => {
      const sel = useSelectionStore.getState().selected;
      const cc = controls.current;
      if (!sel || !cc) return;
      const obj = scene.getObjectByName(`link:${sel.name}`);
      if (!obj) return;
      const pos = new THREE.Vector3();
      obj.getWorldPosition(pos);
      const offset = camera.position.clone().sub(cc.target);
      cc.target.copy(pos);
      camera.position.copy(pos.clone().add(offset));
      cc.update();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Alt") {
        e.preventDefault(); // don't focus the browser menu bar
        const cc = controls.current;
        if (cc) cc.enableRotate = true;
        return;
      }
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if (!typing && (e.key === "f" || e.key === "F")) frameSelected();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Alt") {
        const cc = controls.current;
        if (cc) cc.enableRotate = false;
      }
    };
    const onBlur = () => {
      const cc = controls.current;
      if (cc) cc.enableRotate = false;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [scene, camera, controls]);
}
```

- [ ] **Step 2: Rewrite `Viewport.tsx` to wire controls + gizmos**

Replace the entire `src/components/viewport/Viewport.tsx` with:

```tsx
// src/components/viewport/Viewport.tsx
import { useRef } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, GizmoHelper, GizmoViewport } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useSelectionStore } from "../../state/selectionStore";
import { RobotModel } from "./RobotModel";
import { TransformGizmo } from "./TransformGizmo";
import { useViewportControls } from "./useViewportControls";

/** OrbitControls remapped to a Unity Scene-view subset, plus the corner axis
 *  gizmo. Lives inside <Canvas> so it can use the r3f hooks. */
function ViewportControls() {
  const controls = useRef<OrbitControlsImpl>(null);
  useViewportControls(controls);
  return (
    <>
      <OrbitControls
        ref={controls}
        makeDefault
        enableDamping
        mouseButtons={{
          LEFT: THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.PAN,
          RIGHT: THREE.MOUSE.DOLLY,
        }}
      />
      <GizmoHelper alignment="bottom-right" margin={[72, 72]}>
        <GizmoViewport
          axisColors={["#e0566a", "#7bd47b", "#5a8bf0"]}
          labelColor="#15171a"
        />
      </GizmoHelper>
    </>
  );
}

export function Viewport() {
  const clear = useSelectionStore((s) => s.clear);

  return (
    <Canvas
      camera={{ position: [1.2, 1.2, 1.2], fov: 50, near: 0.01, far: 100 }}
      onPointerMissed={() => clear()}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 5, 2]} intensity={1.1} />
      <directionalLight position={[-3, 2, -2]} intensity={0.4} />

      <Grid
        infiniteGrid
        cellSize={0.1}
        sectionSize={1}
        fadeDistance={20}
        cellColor="#404040"
        sectionColor="#606060"
      />

      {/* Map URDF Z-up into three.js Y-up. */}
      <group rotation={[-Math.PI / 2, 0, 0]}>
        <RobotModel />
      </group>

      <TransformGizmo />
      <ViewportControls />
    </Canvas>
  );
}
```

> `LEFT: THREE.MOUSE.ROTATE` is mapped but `enableRotate` starts `false`, so
> plain LMB does nothing in OrbitControls and remains free for mesh selection;
> the hook flips `enableRotate` true only while Alt is held.

- [ ] **Step 3: Verify types + build**

Run: `npx tsc --noEmit && npm run build`
Expected: clean compile + build. If TS rejects the `mouseButtons` object literal, the values are `THREE.MOUSE` enum members and the prop is the three `OrbitControls.mouseButtons` shape — confirm the import of `* as THREE` is present.

- [ ] **Step 4: Manual verification**

Run `npm run dev`. Confirm: the corner axis gizmo renders bottom-right and clicking an axis snaps the camera to that view. Plain LMB click still selects/clears. **Alt+LMB** drag orbits. **MMB** drag pans. **RMB** drag / **scroll** zoom. With a link selected, **F** recenters the camera on it. Releasing Alt stops orbit.

- [ ] **Step 5: Commit**

```bash
git add src/components/viewport/useViewportControls.ts src/components/viewport/Viewport.tsx
git commit -m "feat(viewport): nav gizmo + Unity-style navigation controls"
```

---

### Task 8: Root `ARCHITECTURE.md`

**Files:**
- Create: `ARCHITECTURE.md` (repo root)

- [ ] **Step 1: Write the document**

Create `ARCHITECTURE.md` at the repo root. It must contain, accurately reflecting the current tree:

1. **One-paragraph overview** — URDF/xacro editor; Rust core + Tauri shell + React/r3f UI; the in-memory Zustand model is the single source of truth for the 3D scene.
2. **Data-flow narrative** (a numbered list or simple diagram): file on disk → `urdf-core` (Rust: parse / serialize / validate) → Tauri commands in `src-tauri` → `src/api/commands.ts` IPC wrappers (with `src/api/mock.ts` browser fallback) → Zustand stores (`robotStore` working copy + zundo undo/redo, `selectionStore`, `uiStore`, `issuesStore`) → consumed by the r3f `Viewport` (scene rebuilt from the model each render) and the `Inspector` forms → edits flow back into `robotStore`; xacro docs persist field edits to source via `commitFieldToSource`.
3. **File/dir index** — a table or bulleted list with a one-line responsibility for each significant entry. Derive entries from the actual tree (run `find src urdf-core src-tauri -maxdepth 2 -type f` and describe each), and cover root config files (`Cargo.toml`, `vite.config.ts`, `tsconfig.json`, `package.json`, `index.html`). Include the new files from this work: `src/lib/numberFormat.ts`, `src/lib/gizmo.ts`, `src/components/viewport/TransformGizmo.tsx`, `src/components/viewport/useViewportControls.ts`.
4. **"Where to look" pointers** — note that `NEXT_SESSION.md` is the running session log and `URDF_Studio_PRD.md` is the product spec, and that `docs/superpowers/` holds design specs + plans.

Keep it concise (one screen of narrative + the index). Use real, verified paths only — open files if unsure; do not invent modules.

- [ ] **Step 2: Verify accuracy**

Run: `find src urdf-core src-tauri -maxdepth 2 -type f | sort` and cross-check every path mentioned in the index exists. Fix any drift.

- [ ] **Step 3: Commit**

```bash
git add ARCHITECTURE.md
git commit -m "docs: add root ARCHITECTURE.md (flow + file index)"
```

---

## Final verification

- [ ] Run the full suite once more: `npx tsc --noEmit && npm test && npm run build` — all green.
- [ ] Manual smoke pass over the four user-facing features (dropdowns readable; number field shows exact value on focus; transform gizmo moves the selected link and undoes as one step; nav gizmo + Alt/MMB/scroll/F navigation work).

## Self-review notes (for the implementer)

- **Spec coverage:** Feature 1 → Task 5; Feature 2 → Task 1; Feature 3 → Tasks 2,3,4,6; Feature 4 → Tasks 4,7; Feature 5 → Task 8.
- **Type consistency:** `originFromLocal(position, rotation)` (Task 3) is called with `target.position`/`target.rotation` (Task 6). `eulerToRpy(euler)` (Task 2) is consumed by `originFromLocal` (Task 3). Group names `link:<name>` / `linkvisual:<name>` (Task 4) are the exact strings looked up in Tasks 6 & 7. `useViewportControls(controls)` (Task 7) takes the `OrbitControlsImpl` ref created in `Viewport.tsx` (Task 7).
- **Ordering:** Tasks 1–3 are independent pure-helper tasks. Task 4 must precede Tasks 6 & 7 (provides the named groups). Task 6 depends on Tasks 2,3,4. Task 7 depends on Task 4 (and edits the same `Viewport.tsx` Task 6 touched — do them in order).
