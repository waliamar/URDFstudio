# URDF Studio — UI Redesign: visionOS glass, resizable panels, Unity inputs

**Date:** 2026-06-11
**Status:** Design — pending user approval

## Problem

The current UI has three usability gaps the user hit while running the built app:

1. **Panels are fixed-size.** The left tree, the right inspector, and the bottom preview are hard-coded grid tracks (`240px / 1fr / 300px`, bottom `180px`). None can be resized.
2. **Inspector inputs overflow the panel.** Vector3 fields render three native `<input type="number">` (each with its own label + spinner arrows) inside a 300px column, so they push past the panel edge.
3. **The look is generic VS-Code dark.** The user wants a modern, Unity-like editor feel with Apple Vision Pro–style glassmorphism.

Tree rows are also looser than the user wants.

## Goals

- Tree, inspector, and bottom panels are **resizable** by dragging the dividers, **collapsible** (double-click divider), with sizes **persisted** across sessions.
- Inspector number inputs are **Unity-style**: drag the label to scrub (pointer-lock infinite drag), click the value to type. Fully **contained** within the panel — no native spinners.
- A single **flat, grayscale, visionOS-style frosted-glass theme**.
- **Tighter** tree row density.

## Non-goals (explicitly out of scope)

- No new runtime dependencies — resize and scrub are hand-rolled (consistent with the project's existing minimal-deps choices).
- Drop the light/dark theme toggle. There is now **one** glass theme. (The `theme` field + toggle button are removed.)
- No changes to URDF parsing, validation, IPC, or the data model. This is purely presentation + input interaction.
- Not addressing the separate backlog items (DAE rendering, generated-types switch, native close guard, Ctrl-Z scoping) — those remain in `NEXT_SESSION.md`. **Exception:** the Ctrl-Z-in-textfield bug is naturally fixed here because scrub/edit commits are coalesced and the edit `<input>` stops propagation (see Undo Integration).

## Visual design (approved via mockups)

The approved look (`theme-v4.html`):

- **Flat frosted material** — a single uniform translucent fill per panel. **No** top-to-bottom gradient, **no** specular sheen.
  - `background: rgba(255,255,255,.10)`
  - `backdrop-filter: blur(44px) saturate(125%)`
  - `border: 1px solid rgba(255,255,255,.18)` (hairline, uniform)
  - `box-shadow: 0 12px 40px rgba(0,0,0,.45)` (soft outer only)
  - `border-radius: 22px` for floating panels; sections inside use 14px.
- **Fully grayscale.** No indigo/amber. Selection = a brighter frost fill (`rgba(255,255,255,.18)`), hover = `rgba(255,255,255,.07)`. The active joint marker in the viewport is white.
- **Neutral scene background** behind the glass: `radial-gradient(120% 90% at 60% 10%, #232529, #15171a 45%, #0c0d0f)`, with a faint white floor grid. No colored light blobs.
- Text: `#f1f3f6` primary, `#a7adb7` dimmed.

## Architecture

Five focused units. Each is independently understandable and testable.

### 1. Theme tokens — `src/styles/theme.css`
Replace the dark/light variable blocks with one `:root` set of glass tokens (the values above): `--glass`, `--glass-hover`, `--glass-sel`, `--stroke`, `--inset`, `--text`, `--text-dim`, `--blur`, `--radius`, `--scene-bg`. No `[data-theme]` selectors.

### 2. Panel styling + layout chrome — `src/styles/globals.css`
- `.glass` utility class implementing the flat frost recipe; applied to tree / inspector / bottom / toolbar.
- Panels become **gapped floating cards** over the scene (grid `gap`, scene background on `.app-shell`).
- **Tree density:** `.tree-row` padding `2px 6px`, gap `6px`, `border-radius: 7px`; `.tree-children` indent `12px`. Hover/selected use frost fills.
- **Field/number-pill styles** (`.num`, `.num .lab`, `.num .val`, `.vec`) per the approved `inputs.html`.
- **Resize handle styles** (`.resize-handle`, vertical/horizontal variants): a thin (6px) transparent hit area that shows a faint white bar on hover; cursor `col-resize` / `row-resize`.
- Restyle scrollbars to thin/translucent to match.

### 3. UI store — `src/state/uiStore.ts`
Add persisted layout state (replace the `theme` field/actions):

```ts
interface PanelLayout {
  treeW: number;        // px, default 232
  inspectorW: number;   // px, default 296
  bottomH: number;      // px, default 180
  treeCollapsed: boolean;
  inspectorCollapsed: boolean;
  bottomCollapsed: boolean;
}
```

- Actions: `setPanelSize(panel, px)`, `toggleCollapsed(panel)`.
- Persisted to `localStorage` under `urdf-studio:layout` (same pattern as the existing `persistTheme`; load on init with sane defaults and clamping). `layers` and `bottomTab` stay as-is.
- Collapsed = render the track at a small fixed size (e.g. tree/inspector → 0 with a thin re-open affordance on the divider; bottom → just its tab bar). Store the pre-collapse size to restore.

### 4. Resize behavior — new `src/lib/resize.ts` + `src/components/layout/ResizeHandle.tsx`
- `src/lib/resize.ts`: a **pure** helper `clampSize(start, deltaPx, min, max)` (and per-panel min/max constants). Pure → unit-tested.
- `ResizeHandle`: a divider element. On `pointerdown` it captures the pointer and tracks `pointermove`, calling `setPanelSize` with `clampSize(...)`; `pointerup` releases. **Double-click** calls `toggleCollapsed`. Props: `orientation` ('vertical' between columns | 'horizontal' above bottom panel), `panel`, and the axis sign (tree grows right, inspector grows left, bottom grows up).
- `App.tsx`: drive `grid-template-columns` / `grid-template-rows` from store sizes via inline style; **always render the inspector panel** (remove the `no-inspector` branch); place `ResizeHandle`s between tree|viewport, viewport|inspector, and above the bottom panel.

### 5. Unity number inputs — `src/components/inspector/fields/NumberField.tsx` (rewrite) + `Vector3Field.tsx` (restyle)
New `NumberField` ("scrub pill") props: `{ label?, value, step=0.01, min?, max?, precision?, onChange, onCommit? }`. Renders `.num` = `.lab` (scrub handle) + `.val` (display) or, while editing, an `<input>`.

- **Scrub:** `pointerdown` on `.lab` → `requestPointerLock()` on the label, set scrubbing class. `pointermove` → `next = value + e.movementX * step * mult`, where `mult = e.shiftKey ? 10 : e.altKey ? 0.1 : 1`; clamp to `[min,max]`; call `onChange(next)`. `pointerup` → `exitPointerLock()`, fire `onCommit`. Fallback to `setPointerCapture` if Pointer Lock is unavailable.
- **Edit:** click `.val` → swap in an `<input>` (value preselected). `Enter`/blur commits a parsed float; `Esc` cancels. The input **stops keydown propagation** so the global Ctrl-Z handler can't hijack text undo.
- Formatting: `value.toFixed(precision)` where precision derives from `step`'s decimals (clamped 1–4).
- `Vector3Field` lays out three pills in a `.vec` row (`flex:1; min-width:0` each) so they shrink to fit the inspector at any width. Labels `x/y/z` or `r/p/y`.

### Undo integration (correctness)
Continuous scrub must not flood the zundo history, and a full drag should be **one** undo step.
- On scrub `pointerdown`: `useRobotStore.temporal.getState().pause()`.
- During drag: `onChange` updates the model (untracked).
- On `pointerup`: `resume()`, then apply the final value once through a normal tracked store update (via `onCommit`) so exactly one entry lands in history.
- Text-edit commit is a single tracked update already.

This also resolves the existing "Ctrl-Z while typing nukes the model" bug, since the edit `<input>` swallows the keystroke.

## Data flow

```
uiStore (sizes, collapsed) ──persist──> localStorage
        │ read
        ▼
   App.tsx grid-template (inline style)
        ▲ setPanelSize / toggleCollapsed
   ResizeHandle (pointer drag / dblclick)

NumberField.lab  ──(pointerlock drag)──> onChange ──> robotStore (temporal paused)
NumberField.val  ──(click→input→Enter)─> onChange ──> robotStore (tracked)
        pointerup/commit ─────────────> onCommit  ──> robotStore.temporal.resume + 1 entry
```

## Testing

- **Unit (`src/lib/resize.test.ts`):** `clampSize` — growth/shrink, min and max clamping, both directions.
- **Unit (NumberField):** scrub math helper (`value + movementX*step*mult`, clamp, precision formatting); keep the existing parse-on-edit / sync-on-external-change behavior and its tests.
- **Existing suites stay green:** `cargo test -p urdf-core` (40), `npm test`, `tsc --noEmit`, `vite build`.
- **Manual smoke:** drag each divider; double-click to collapse/restore; reload → sizes persisted; scrub a value with pointer lock + Shift/Alt; click-edit a value, Enter/Esc; vector3 pills stay inside the inspector at min width; one undo reverts a whole scrub.

## Risks / notes

- **Pointer Lock in the Tauri webview** (webkit2gtk): if `requestPointerLock` is unsupported or rejected, the field falls back to `setPointerCapture` drag (cursor visible, finite) — no functional loss. Verify in the native window.
- **`backdrop-filter` performance** with the live r3f canvas behind: 44px blur on three panels should be fine; if it stutters, the blur radius is a single token to tune.
- Removing the light theme is a deliberate simplification; if a light glass variant is wanted later it's one extra token set.
