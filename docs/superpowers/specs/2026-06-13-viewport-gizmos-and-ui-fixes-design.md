# Viewport Gizmos & Inspector UI Fixes — Design

**Date:** 2026-06-13
**Status:** Approved (pending spec review)

## Overview

Five changes to URDF Studio, grouped as two small inspector UI fixes, two viewport
features (transform gizmo + nav gizmo with Unity-style navigation), and a root
architecture document.

1. Custom dropdown component (fixes white-on-white native `<select>`).
2. Full-precision value display when a number field is focused.
3. Unity-style transform gizmo on the selected link/joint.
4. Nav/axis gizmo + Unity-style viewport navigation controls.
5. `ARCHITECTURE.md` flow + file-description document in the repo root.

The app is React 19 + `@react-three/fiber` / `@react-three/drei`, with a Zustand
working-copy model (`robotStore`) that is the single source of truth for the 3D
scene. The Rust `urdf-core` crate and Tauri IPC are unaffected by this work.

---

## Feature 1 — Custom dropdown (`SelectField`)

**Problem.** `SelectField.tsx` renders a native `<select>`. The closed control is
styled via `.field > select`, but the open `<option>` popup is OS-rendered: on the
dark glass theme it shows as white background with near-white text, making options
unreadable.

**Solution.** Replace the native control with a custom dropdown that mimics the
`.num` glass-pill aesthetic, keeping the existing `Props` API unchanged so all call
sites (`GeometryEditor`, `MaterialEditor`, `JointForm`) work without edits.

- **Trigger:** a `button.select-trigger` styled like a `.num` pill — `var(--inset)`
  background, `var(--stroke)` border, `var(--radius-sm)`/`10px` radius, left-aligned
  current label, a `▾` chevron on the right. Reuses `--text` for the label color.
- **Menu:** rendered in a `createPortal` to `document.body` so the inspector's
  `overflow: auto` cannot clip it. Positioned with `position: fixed` from the
  trigger's `getBoundingClientRect()`. Background `var(--glass)` +
  `backdrop-filter: var(--blur)`, `1px solid var(--stroke)`, rounded. Each row:
  `padding: 6px 10px`, hover `var(--glass-hover)`, selected row `var(--glass-sel)`
  + `var(--text-bright)`, text `var(--text)`.
- **Interaction:** click trigger toggles open; click a row selects + closes;
  click-outside (capture-phase `pointerdown` listener) closes; keyboard: `ArrowUp`/
  `ArrowDown` move a highlight, `Enter` commits the highlight, `Escape` closes.
  `keydown` handlers call `stopPropagation()` so the global Ctrl+Z (undo) stays
  scoped away from the control, matching `NumberField`'s pattern.
- **State:** local `useState` for `open` and `highlightIndex`. No new store.

**Files:** rewrite `src/components/inspector/fields/SelectField.tsx`; add dropdown
styles to `src/styles/globals.css` (a `.select-trigger` / `.select-menu` block near
the existing `.field > select` rules; the old `.field > select` rule may stay for
any remaining native selects but no longer governs these dropdowns).

**Out of scope:** typeahead search, multi-select, grouped options.

---

## Feature 2 — Full-precision on focus (`NumberField`)

**Problem.** `NumberField` always renders `value.toFixed(precision)` (2 dp by
default) and, on click-to-edit, seeds the text input with that *rounded* string —
so the exact URDF value (e.g. a converted-from-degrees radian) is destroyed the
moment the user focuses the field.

**Solution.** Decouple the display string from the edit seed:

- **Blurred display:** unchanged — `value.toFixed(precision)`.
- **On `startEdit`:** seed the input with the full-precision value via `String(value)`
  (native JS shortest round-trippable representation, e.g.
  `0.017453292519943295`), not the rounded `display`. `inputRef.current.select()`
  (already present) highlights it for easy overwrite.
- **Commit:** unchanged (`parseFloat` + clamp).

**Files:** edit `src/components/inspector/fields/NumberField.tsx` (the `startEdit`
function, line ~83). `Vector3Field` inherits the behavior with no change.

**Test:** add `NumberField` unit test (`src/components/inspector/fields/`): a value
like `0.017453292519943295` rendered shows `0.02` when blurred, and the input
contains the full string when focused.

---

## Feature 3 — Transform gizmo (Unity-like)

**Goal.** A drei `TransformControls` gizmo that appears at the selected link/joint's
frame and lets the user translate/rotate it directly in the viewport, writing the
change back into the model as a single undo entry.

### Attachment

- In `RobotModel.tsx`, give each link's `<group>` a stable `name={`link:${name}`}`
  so the gizmo can find it via `scene.getObjectByName`.
- A new `TransformGizmo` component (rendered inside `<Canvas>`, as a sibling of the
  Z-up `<group>`) reads the current selection from `selectionStore`, resolves the
  target Object3D, and mounts `<TransformControls object={target} ...>` when a
  target exists. Renders nothing when there is no selection.

### Modes

- **W** → `mode="translate"`, **E** → `mode="rotate"`. No scale.
- **X** toggles `space` between `"local"` (default, Unity-style) and `"world"`.
- Hotkeys are handled by a `keydown` listener that ignores events whose target is an
  input/textarea (so typing in the inspector never switches gizmo mode). Stored in
  local component state.

### Write-back

The link group's **local** transform (relative to its parent group) equals the URDF
joint origin that places it, because `RobotModel` nests each child group at
`position={joint.origin.xyz} rotation={rpyToEuler(joint.origin.rpy)}`. The global
Z-up→Y-up wrapper is an ancestor and does not affect a node's *local* transform.
Therefore:

| Selection | Gizmo attaches to | Writes |
|---|---|---|
| link **with** a parent joint | the link's group | parent joint `origin.xyz` / `origin.rpy` |
| **root** link (no parent joint) | the link's visual subgroup | link `visual.origin.xyz` / `.rpy` |
| joint | the joint's child-link group | that joint `origin.xyz` / `.rpy` |

- On `mouseDown` (drag start): call `robotStore.beginInteraction()` (suspends undo
  history — reuses the scrub plumbing).
- On `objectChange` (during drag): read `object.position` (local) and
  `object.rotation` (a `THREE.Euler`; re-expressed in order `"ZYX"`), convert to a
  joint-origin patch, and `updateJoint`/`updateLink`. Because the patch re-renders
  the group from the model, the gizmo follows.
- On `mouseUp` (drag end): call `robotStore.endInteraction()` → the whole drag is
  one undo entry.
- While dragging, `OrbitControls` must not also pan/orbit. drei emits
  `dragging-changed` on `TransformControls`; the handler sets the shared
  `OrbitControls` `enabled` flag (via a ref) accordingly.

### Rotation conversion

Add `eulerToRpy(euler: THREE.Euler): [number, number, number]` to
`src/lib/transforms.ts`, the inverse of the existing `rpyToEuler`. It reorders the
euler to `"ZYX"` if needed and returns `[x, y, z]` = `[roll, pitch, yaw]`. Unit
test: `eulerToRpy(rpyToEuler(rpy))` round-trips for several rpy triples (within
floating-point tolerance), including angles past ±π/2.

### Write-back mapping as a pure function

Extract the "local transform → model patch" logic into a pure helper (e.g.
`src/lib/gizmo.ts` `originFromObject(position, euler)` → `{ xyz, rpy }`) so it can be
unit-tested without a live scene.

**Files:** new `src/components/viewport/TransformGizmo.tsx`; new `src/lib/gizmo.ts`
(+ test); edit `src/components/viewport/RobotModel.tsx` (group names, expose root
link's visual subgroup name), `src/lib/transforms.ts` (+ test), `src/components/viewport/Viewport.tsx` (mount gizmo, share OrbitControls ref).

**Out of scope:** multi-select transforms, snapping increments, scale.

---

## Feature 4 — Nav gizmo + Unity-style viewport navigation

### Nav/axis gizmo

drei `GizmoHelper` (alignment `bottom-right`, margin ~`[72, 72]`) wrapping
`GizmoViewport` — the Unity-style axis triad/cube. Clicking an axis animates the
camera to that orthographic-style view. It syncs with the default `OrbitControls`
automatically (`makeDefault`).

### Navigation scheme (Unity Scene-view subset)

Implemented by configuring `OrbitControls` and gating it on modifier keys; **no**
RMB-hold fly mode (explicitly out of scope per approval).

| Input | Action |
|---|---|
| **LMB** (no modifier) | select (unchanged — `onClick` on meshes, `onPointerMissed` clears) |
| **Alt + LMB drag** | orbit |
| **MMB drag** | pan |
| **Alt + RMB drag** | dolly (zoom) |
| **scroll wheel** | zoom |
| **F** | frame the selected link (move orbit target to it, fit distance) |

Implementation: `OrbitControls.mouseButtons` is set so LMB does not rotate by
default; a `keydown`/`keyup` pair tracks the Alt modifier and flips
`controls.mouseButtons.LEFT` between `undefined`/`THREE.MOUSE.ROTATE` (or toggles
`controls.enableRotate`) so Alt+LMB orbits while plain LMB is free for selection.
MMB → `PAN`, RMB → `DOLLY`. `F` reads the selected link's world position
(`getObjectByName('link:'+name)` → `getWorldPosition`) and sets
`controls.target` + camera distance, then `controls.update()`.

**Files:** edit `src/components/viewport/Viewport.tsx` (gizmo helper, mouseButtons,
modifier + F key handling). A small `useViewportControls` hook may encapsulate the
key/mouse wiring to keep `Viewport.tsx` readable.

**Out of scope:** RMB fly mode, WASD/QE flight, orthographic projection toggle,
configurable keybindings.

---

## Feature 5 — `ARCHITECTURE.md` (repo root)

A concise document describing the data-flow and per-file responsibilities:

- **Flow narrative:** Rust `urdf-core` (parse / serialize / validate) → Tauri IPC
  commands (`src-tauri`, wrapped by `src/api/commands.ts` with a browser mock) →
  Zustand stores (`robotStore` working copy + undo, `selectionStore`, `uiStore`,
  `issuesStore`) → consumed by the r3f `Viewport` (scene built from the model) and
  the `Inspector` forms → edits flow back into `robotStore`, optionally persisted to
  xacro source via `commitFieldToSource`.
- **File/dir index:** one-line description per significant file under `src/`,
  `urdf-core/`, `src-tauri/`, and the root config files.

It complements (does not replace) `NEXT_SESSION.md` (session log) and
`URDF_Studio_PRD.md` (product requirements).

---

## Testing strategy

| Area | Test |
|---|---|
| `NumberField` precision | unit: blurred shows 2 dp, focused input holds full precision |
| `eulerToRpy` | unit: round-trips with `rpyToEuler`, incl. angles past ±π/2 |
| gizmo write-back | unit: `originFromObject(pos, euler)` → expected `{xyz, rpy}` |
| dropdown | manual: open menu readable on dark theme, keyboard + click-outside |
| transform gizmo | manual: drag selected link → joint origin + inspector update, single undo |
| nav gizmo + controls | manual: axis click snaps view; Alt/MMB/scroll/F behave |

`tsc --noEmit`, `npm test`, and `vite build` must stay green. `cargo test -p
urdf-core` is unaffected but should remain green.

## Risks / notes

- `TransformControls` + `OrbitControls` contention is the classic r3f gotcha;
  resolved via the `dragging-changed` → `enabled` wiring.
- Native `<select>` keyboard semantics are reimplemented in the custom dropdown;
  keep it minimal (arrow/enter/escape) to limit surface area.
- The local-transform-equals-joint-origin invariant depends on `RobotModel`'s
  current group nesting; the `eulerToRpy` order ("ZYX") must mirror `rpyToEuler`.
