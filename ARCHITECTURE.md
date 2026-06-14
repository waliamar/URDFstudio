# URDF Studio — Architecture

## Overview

URDF Studio is a desktop application (Tauri 2) for editing URDF/xacro robot
description files with a live 3D preview. It is built in three layers:

- **`urdf-core/`** — a Rust crate with no Tauri dependency: the canonical
  robot data model, the URDF parser/serializer, xacro source-tree resolution,
  ROS package (`ament`) resolution, and validation.
- **`src-tauri/`** — a thin Tauri shell exposing `urdf-core` (plus
  filesystem/xacro-shell operations) as IPC commands to the frontend.
- **`src/`** — a React 19 + react-three-fiber (r3f) UI.

The frontend's Zustand `robotStore` holds the **working copy of the robot
model** and is the single source of truth for the editor: the 3D scene in
`Viewport`, the `RobotTree`, the `Inspector` forms, and the XML preview are
all derived from `robotStore.robot` on every render. Edits mutate this store
(with `zundo` undo/redo); for xacro documents, edits to individual fields are
additionally written back into the original source text via
`commitFieldToSource`.

## Data flow

1. User opens a `.urdf` or `.xacro` file via the file dialog
   (`src/api/dialog.ts`) → `useFileOps` calls `openDocument(path)`.
2. **In Tauri**, `src/api/commands.ts` invokes the `open_document` Tauri
   command (`src-tauri/src/commands.rs`), which (for xacro) shells out to
   `xacro` (`src-tauri/src/xacro.rs`) to expand the document, then calls into
   `urdf-core` (`parser.rs`) to parse the expanded URDF into the canonical
   `Robot` model, and `source_tree.rs` to gather the editable xacro source
   files and writable `FieldAnchor`s.
   **In a browser** (`vite dev` without a Tauri webview), `src/api/mock.ts`
   returns a clone of `src/samples/sampleRobot.ts` instead, so the UI runs
   standalone.
3. The result (`Robot` model, computed URDF text, xacro source files, field
   anchors) is loaded into `useRobotStore` (`src/state/robotStore.ts`), which
   becomes the working copy with `zundo`-tracked undo/redo history.
4. The r3f `Viewport` (`src/components/viewport/Viewport.tsx`) walks the
   kinematic tree built by `src/lib/kinematics.ts` from `robotStore.robot`,
   rendering each link's geometry (`LinkMesh.tsx`) positioned by joint origins
   (`src/lib/transforms.ts`). The `Inspector` (`src/components/inspector/`)
   renders forms for the link/joint selected via `useSelectionStore`.
5. User edits:
   - In the **viewport**, dragging the `TransformGizmo`
     (`src/components/viewport/TransformGizmo.tsx`) updates the selected
     link/joint's origin in `robotStore` via `src/lib/gizmo.ts`
     (`originFromLocal`), which converts the dragged object's local transform
     back into a URDF `xyz`/`rpy` origin.
   - In the **Inspector**, field edits call `robotStore` setters directly
     (plain URDF) and, for xacro documents with a writable anchor, also call
     `commitFieldToSource` (via `useFieldGate`), which invokes the
     `set_xacro_field` Tauri command (`setXacroField` in `commands.ts`) to
     splice the new value back into the original xacro source text.
6. `useValidation` debounces calls to `validate_robot` (`urdf-core::validation`)
   via `validateRobot` and stores results in `useIssuesStore`, surfaced by
   `ProblemsPanel`.
7. Saving calls `saveUrdf` → `save_urdf` Tauri command → `urdf-core::serializer`
   writes a deterministic, byte-stable URDF back to disk.

## File & directory index

### Root config
- `package.json` — npm scripts (`dev`, `build`, `test`, `tauri`) and frontend
  dependencies (React 19, r3f/drei, three, zustand, zundo).
- `vite.config.ts` — Vite + Vitest config; dev server port matches the Tauri
  template.
- `tsconfig.json` — TypeScript compiler config for the frontend.
- `Cargo.toml` / `Cargo.lock` — Rust workspace manifest covering `urdf-core`
  and `src-tauri`.
- `index.html` — Vite entry HTML, mounts `src/main.tsx`.
- `scripts/tauri.sh` — wrapper invoked by `npm run tauri`.
- `README.md` — project intro/setup instructions.
- `NEXT_SESSION.md` — running session log of work-in-progress.
- `URDF_Studio_PRD.md` — product requirements document.
- `docs/superpowers/specs`, `docs/superpowers/plans` — design specs and
  implementation plans for features.

### `urdf-core/` (Rust core, no Tauri dependency)
- `src/lib.rs` — crate root; declares the `ament`, `mesh`, `model`, `parser`,
  `serializer`, `source_tree`, `validation` modules and re-exports.
- `src/model.rs` — canonical `Robot`/`Link`/`Joint`/`Geometry`/... data model,
  derives `ts-rs` to generate matching TypeScript types.
- `src/parser.rs` — hand-rolled URDF XML parser (quick-xml) producing a
  `Robot`.
- `src/serializer.rs` — deterministic URDF XML serializer (round-trips a
  `Robot` back to byte-stable XML).
- `src/ament.rs` — resolves ROS package names to `share/` directories
  (`package://` URIs, `$(find pkg)`).
- `src/mesh.rs` — resolves a URDF `filename`/mesh path to an absolute path
  using the `ament` package index.
- `src/source_tree.rs` — walks `<xacro:include>` directives to build the
  ordered list of xacro source files behind a computed URDF, tagging which are
  editable.
- `src/validation/` — validation rules (`schema.rs`, `kinematics.rs`,
  `inertia.rs`) producing `ValidationIssue`s, aggregated in `mod.rs`.
- `tests/roundtrip.rs`, `tests/validation.rs` — integration tests (parse/
  serialize round-trip, validation rules) with fixtures.

### `src-tauri/` (Tauri shell)
- `src/main.rs` — binary entry point, calls `urdf_studio_lib::run()`.
- `src/lib.rs` — Tauri app builder; registers plugins and the IPC command
  handler list.
- `src/commands.rs` — thin Tauri command wrappers over `urdf-core`:
  `open_document`, `set_xacro_field`, `open_urdf`, `save_urdf`,
  `serialize_urdf`, `validate_robot`, `resolve_mesh_path`, `read_mesh_file`,
  `new_robot`.
- `src/xacro.rs` — expands xacro documents by shelling out to the `xacro` CLI
  (sourcing ROS/workspace `setup.bash` so package resolution matches a real
  ROS shell).
- `build.rs` — Tauri build script.
- `tauri.conf.json` — Tauri app configuration (window, bundle, etc).
- `capabilities/default.json` — IPC permission set for the main window
  (`core:default`, `dialog:default`, `fs:default`).
- `icons/icon.png` — app icon.

### `src/api`
- `commands.ts` — typed wrappers around the Tauri IPC command surface; falls
  back to `mock.ts` when not running inside a Tauri webview.
- `mock.ts` — browser-dev fallbacks (returns `sampleRobot` etc.) so the UI
  runs under plain `vite dev`.
- `dialog.ts` — open/save file dialogs via the Tauri dialog plugin (null-safe
  in browser mode).

### `src/state` (Zustand stores)
- `robotStore.ts` — the working-copy `Robot` model plus open-document
  metadata (computed URDF, xacro source files, field anchors); undo/redo via
  `zundo`'s `temporal` middleware; `commitFieldToSource` writes xacro field
  edits back to source.
- `selectionStore.ts` — currently selected link or joint (`kind` + `name`).
- `uiStore.ts` — UI layout state: panel sizes/collapse, active bottom tab,
  visual/collision/inertial layer toggles.
- `issuesStore.ts` — latest validation results from `useValidation`.
- `robotStore.test.ts`, `uiStore.test.ts` — unit tests for the stores.

### `src/lib` (pure helpers)
- `numberFormat.ts` — display vs. exact-edit string formatting for
  Unity-style number fields (rounded when blurred, exact when focused).
- `gizmo.ts` — maps a dragged object's local transform to a URDF origin
  (`originFromLocal`); a link's local transform equals the joint origin that
  places it.
- `transforms.ts` — URDF `rpy` (extrinsic XYZ) <-> `THREE.Euler` ("ZYX" order)
  conversions.
- `kinematics.ts` — pure kinematic-tree builder (`buildTree`) shared by
  `RobotTree` and `RobotModel`.
- `debounce.ts` — tiny generic trailing-edge debounce.
- `scrub.ts` — pure math for Unity-style drag-scrub number fields
  (`scrubMultiplier`, `applyScrub`).
- `sourceMatch.ts` — locates where a selected element is defined in
  un-expanded xacro source by matching tag + normalized name.
- `xmlHighlight.ts` — dependency-free XML tokenizer for syntax-highlighting
  one line of URDF/xacro at a time.
- `collada.ts` — helpers for fitting loaded Collada (`.dae`) assets into
  URDF Studio's frame (cancels ColladaLoader's up-axis rotation).
- `paths.ts` — `dirname`-style path helpers handling POSIX and Windows
  separators.
- `resize.ts` — pure geometry/clamping for draggable panel dividers
  (`PANEL_LIMITS`, `clampSize`).
- `*.test.ts` — corresponding Vitest unit tests for each module above.

### `src/types`
- `robot.ts` — hand-written TypeScript mirror of the Rust `Robot` model
  (kept verbatim with `urdf-core::model`).
- `validation.ts` — `ValidationIssue` type used by the validation pipeline.
- `generated/` — TypeScript types auto-generated from `urdf-core` via `ts-rs`
  (e.g. `Robot.ts`, `Link.ts`, `Joint.ts`, `Geometry.ts`, `Pose.ts`,
  `Inertial.ts`, `Material.ts`, `ValidationIssue.ts`, etc.) — generated
  output, not hand-edited.

### `src/components/viewport`
- `Viewport.tsx` — r3f `Canvas` setup: camera, grid, orbit controls, gizmo
  viewport helper; hosts `RobotModel` and `TransformGizmo`.
- `RobotModel.tsx` — recursively renders the kinematic tree (from
  `lib/kinematics.ts`) as nested `<group>`s positioned by joint origins.
- `LinkMesh.tsx` — renders a single link's visual/collision geometry
  (primitives, STL, or Collada via loaders), applying material and layer
  visibility.
- `TransformGizmo.tsx` — Unity-style transform gizmo (translate/rotate) shown
  on the selected link/joint; drags update the origin via `lib/gizmo.ts`.
- `useViewportControls.ts` — Unity-style scene navigation: plain LMB stays
  free for selection, Alt+LMB orbits, MMB pans, RMB/scroll zoom, `F` frames
  the selected link.

### `src/components/inspector`
- `Inspector.tsx` — top-level panel; shows `LinkForm` or `JointForm` for the
  current selection.
- `LinkForm.tsx` — editable form for a link's name, visual/collision geometry,
  material, and inertial properties.
- `JointForm.tsx` — editable form for a joint's type, parent/child, origin,
  axis, and limits.
- `PoseEditor.tsx` — xyz/rpy origin editor (used by links, joints, geometry,
  inertial frames).
- `GeometryEditor.tsx` — editor for visual/collision geometry (box, cylinder,
  sphere, mesh) dimensions and mesh path.
- `InertialEditor.tsx` — editor for mass, center-of-mass origin, and inertia
  tensor.
- `MaterialEditor.tsx` — color picker (react-colorful) and material name
  editor.
- `Section.tsx` — collapsible section wrapper used throughout the inspector.
- `useFieldGate.ts` — per-field edit gating + xacro source write-back: a field
  is editable when it has a writable source anchor, and commits splice the
  new value into the xacro source.
- `fields/NumberField.tsx` — Unity-style numeric input with drag-scrub,
  display/edit formatting (`lib/numberFormat.ts`, `lib/scrub.ts`).
- `fields/SelectField.tsx` — dropdown field rendered via a portal.
- `fields/Vector3Field.tsx` — group of three `NumberField`s for a 3-vector.

### `src/components/tree`
- `RobotTree.tsx` — hierarchical link/joint tree view built from
  `lib/kinematics.ts`, drives `selectionStore`.

### `src/components/xml`
- `XmlPreview.tsx` — read-only XML preview of the computed/source URDF/xacro,
  with selection-synced scrolling.
- `XmlLine.tsx` — renders one line of XML as syntax-colored spans using
  `lib/xmlHighlight.ts`.

### `src/components/layout`
- `Toolbar.tsx` — top toolbar: file operations (open/save/new), undo/redo,
  layer visibility toggles.
- `StatusBar.tsx` — bottom status bar showing robot name and validation
  summary.
- `ResizeHandle.tsx` — draggable divider for resizing tree/inspector/bottom
  panels (`lib/resize.ts`, `uiStore`).
- `ErrorBoundary.tsx` — panel-level React error boundary; shows error + stack
  inline instead of blanking the window.

### `src/components/problems`
- `ProblemsPanel.tsx` — lists validation issues from `issuesStore`, clicking
  an issue selects the offending link/joint.

### `src/hooks`
- `useFileOps.ts` — open/save/new file operations wiring dialogs, `commands.ts`,
  and `robotStore`.
- `useUndoRedo.ts` — wires Ctrl/Cmd+Z (undo) and Ctrl/Cmd+Shift+Z / Ctrl+Y
  (redo) to `robotStore`'s `zundo` history.
- `useValidation.ts` — debounced validation: calls `validateRobot` on model
  changes and stores results in `issuesStore`.

### `src/samples`
- `sampleRobot.ts` — sample `Robot` model used as the default/mock document
  in browser-dev mode.

### `src/styles`
- `globals.css` — global app styles/layout.
- `theme.css` — color/theme variables.

### Entry points
- `src/App.tsx` — top-level layout: toolbar, tree, viewport, inspector,
  bottom panel (problems/XML), status bar.
- `src/main.tsx` — React root, mounts `App` and imports global styles.

## Where to look

- `NEXT_SESSION.md` — running session log of in-progress work.
- `URDF_Studio_PRD.md` — full product requirements/spec.
- `docs/superpowers/specs/` and `docs/superpowers/plans/` — design specs and
  implementation plans for individual features.
- `README.md` — setup and run instructions.
