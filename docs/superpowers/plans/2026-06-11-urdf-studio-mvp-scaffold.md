# URDF Studio MVP Scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Working MVP scaffold of URDF Studio — open a URDF, see it in 3D, edit links/joints/geometry via forms, validate, and save deterministic XML — per `URDF_Studio_PRD.md`.

**Architecture:** Tauri 2 shell + React/TS frontend (PRD §5), with one deviation: the Rust side is a **Cargo workspace** of `urdf-core` (all parsing/serialization/validation logic, zero system deps, fully unit-tested) and `src-tauri` (thin command shell). Reason: this machine lacks `webkit2gtk-4.1` and sudo, so the Tauri crate cannot compile here — but `urdf-core` can be built and tested, and the split is better layering regardless. Frontend renders the Zustand model directly with react-three-fiber (not `urdf-loaders`, which loads URDF *files*; our source of truth is the in-memory model, PRD §5.4 Pattern A).

**Tech Stack:** Rust (quick-xml, ts-rs, thiserror), Tauri 2, React 18 + TypeScript + Vite, Zustand + zundo (undo/redo), three + @react-three/fiber + @react-three/drei, react-colorful. npm (pnpm not installed).

**Decisions vs PRD open questions (§16):** r3f over raw Three.js (fewer lines, idiomatic React); validation debounced-continuous; no telemetry; parser hand-rolled on quick-xml (full control of model shape), with `urdf-rs` skipped.

---

### Task 1: Repo skeleton (inline, main session)

**Files:** `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `.gitignore`, `Cargo.toml` (workspace), `src-tauri/tauri.conf.json`, `src-tauri/capabilities/default.json`, `README.md`

- [x] git init, write configs, `npm install`, commit.

### Task 2: `urdf-core` Rust crate (subagent A)

**Files:**
- Create: `urdf-core/Cargo.toml`, `urdf-core/src/lib.rs`, `urdf-core/src/model.rs`, `urdf-core/src/parser.rs`, `urdf-core/src/serializer.rs`, `urdf-core/src/validation/{mod,schema,kinematics,inertia}.rs`, `urdf-core/src/mesh.rs`
- Test: `urdf-core/tests/roundtrip.rs`, `urdf-core/tests/fixtures/*.urdf`

Data model: PRD §6.1 verbatim, plus on every struct/enum: `#[derive(TS)] #[ts(export, export_to = "../src/types/generated/")]` and `#[serde(rename_all = "camelCase")]` (so IPC JSON matches the TS mirror in PRD §6.2 — `jointType`, `materialName`).

- [ ] **Step 1:** Write failing roundtrip test: parse fixture URDF (2 links, 1 revolute joint, box+cylinder geometry, material, inertial) → assert model fields; serialize → parse again → assert equal models; serialize twice → assert byte-identical (NFR-5).
- [ ] **Step 2:** `cargo test -p urdf-core` → FAIL (unimplemented).
- [ ] **Step 3:** Implement `model.rs` (PRD §6.1 + derives above), `parser.rs` (quick-xml pull parser → `parse_urdf(xml: &str) -> Result<Robot, CoreError>`), `serializer.rs` (`serialize_urdf(&Robot) -> String`, fixed field order, fixed float formatting via shortest-repr, 2-space indent).
- [ ] **Step 4:** Validation: `validate(&Robot) -> Vec<ValidationIssue>` where `ValidationIssue { severity: Error|Warning, code: String, message: String, target: Option<String> /* link/joint name */ }` (TS-exported). Checks: empty robot/link/joint names, duplicate names, joint parent/child referencing missing links (schema.rs); multiple roots / orphan links / cycles via parent-map walk (kinematics.rs); mass <= 0, non-positive-definite tensor via Sylvester's criterion on the 3x3 (inertia.rs — hand-rolled determinants, no nalgebra needed for a 3x3).
- [ ] **Step 5:** `mesh.rs`: `resolve_mesh_path(package_path, urdf_dir)` — strip `package://<pkg>/`, walk up from urdf_dir to find a dir containing `package.xml` whose folder name matches `<pkg>`, else join relative to urdf_dir.
- [ ] **Step 6:** `cargo test -p urdf-core` → PASS. ts-rs export test generates `src/types/generated/*.ts`. Commit.

### Task 3: `src-tauri` shell (subagent A, after Task 2)

**Files:** `src-tauri/Cargo.toml`, `src-tauri/build.rs`, `src-tauri/src/{main,lib,commands}.rs`, `src-tauri/icons/`

- [ ] Commands per PRD §7.1: `open_urdf`, `save_urdf`, `serialize_urdf`, `validate_robot`, `resolve_mesh_path`, `read_mesh_file`, `new_robot` — each a 1–4 line wrapper over `urdf_core`. Register in `lib.rs` builder; `tauri-plugin-dialog` + `tauri-plugin-fs` registered.
- [ ] **Cannot `cargo check` here** (missing webkit2gtk). Acceptance: code review + `urdf-core` tests green. Document in NEXT_SESSION.md.

### Task 4: Frontend state + API layer (subagent B, parallel with Task 2)

**Files:** `src/types/robot.ts` (PRD §6.2 verbatim), `src/types/validation.ts`, `src/api/{commands,dialog,mock}.ts`, `src/state/{robotStore,selectionStore,uiStore}.ts`, `src/lib/{transforms,kinematics,debounce}.ts`, `src/samples/sampleRobot.ts`

- [ ] `api/commands.ts`: PRD §7.3 wrappers; if `!('__TAURI_INTERNALS__' in window)` delegate to `mock.ts` (returns `sampleRobot`, serializes via a 40-line TS mirror serializer for browser-dev XML preview, validates → `[]`). Keeps the UI fully developable in plain `vite dev`.
- [ ] `robotStore.ts`: Zustand + zundo temporal middleware. State: `robot, filePath, dirty`. Actions: `setRobot, updateLink(name, patch), updateJoint(name, patch), renameLink/renameJoint (with joint-reference fixup), addLink, addJoint, deleteLink (cascade warning data), deleteJoint, setMaterial`. Undo/redo = temporal API.
- [ ] `selectionStore`: `{ selected: {kind:'link'|'joint', name} | null }`. `uiStore`: theme, layer toggles (visual/collision/inertia), bottom tab.
- [ ] `lib/transforms.ts`: rpy→THREE.Euler order 'ZYX' fixed-axis conversion (URDF rpy is extrinsic XYZ = intrinsic ZYX). `lib/kinematics.ts`: build render tree (root links, joint→child nesting) from flat model.
- [ ] Vitest: store mutation + undo test, kinematics tree test, transforms test. `npm test` → PASS. Commit.

### Task 5: Frontend UI + viewport (subagent B, after Task 4)

**Files:** `src/main.tsx`, `src/App.tsx`, `src/components/layout/{MenuBar,Toolbar,StatusBar,Panels}.tsx`, `src/components/tree/RobotTree.tsx`, `src/components/inspector/{Inspector,LinkForm,JointForm,GeometryEditor,PoseEditor,InertialEditor,MaterialEditor,fields/{NumberField,Vector3Field,SelectField}}.tsx`, `src/components/viewport/{Viewport,RobotModel,LinkMesh}.tsx`, `src/components/xml/XmlPreview.tsx`, `src/components/problems/ProblemsPanel.tsx`, `src/hooks/{useFileOps,useUndoRedo,useValidation}.ts`, `src/styles/{globals,theme}.css`

- [ ] Layout per PRD §9.1: toolbar, left tree, center viewport, right inspector, tabbed bottom panel (Problems / XML), status bar. CSS grid + CSS-variable theming (light/dark, `data-theme` attr).
- [ ] Viewport: r3f Canvas, drei OrbitControls + Grid, recursive `<RobotModel>` from `lib/kinematics`, geometry switch (box/cylinder/sphere primitives; mesh → STL/DAE via three loaders through `read_mesh_file`/`resolve_mesh_path`, placeholder box on failure). Cylinder rotated +X→ URDF z-axis convention. Selected link highlighted (emissive); click mesh → select.
- [ ] Inspector forms write through store actions (instant 3D update, no IPC). Number fields commit on change, drag-friendly.
- [ ] Hooks: `useFileOps` (open/save/saveAs/new + dirty guard on close via Tauri event or beforeunload), `useUndoRedo` (Ctrl+Z/Ctrl+Shift+Z), `useValidation` (300 ms debounce → `validateRobot`), XML preview same debounce → `serializeUrdf`.
- [ ] `npx tsc --noEmit` and `npm run build` → PASS. Commit.

### Task 6: Verification + docs (inline, main session)

- [ ] `cargo test -p urdf-core` green; `npm test`, `tsc`, `vite build` green; review subagent output for hardcoding/overengineering.
- [ ] Write `NEXT_SESSION.md` (plan for next session + transcript of this one), `README.md` (setup incl. `sudo apt install libwebkit2gtk-4.1-dev ...`). Final commit.

## Self-review notes
- FR-1..6, 8..27, 30..33, 37..39 covered by Tasks 2–5. FR-23/24 (STL/DAE) render path included; real-file testing deferred to next session (needs running Tauri shell). FR-25 in mesh.rs + viewport wiring.
- Types consistent: `ValidationIssue` defined once in urdf-core, ts-rs-exported; TS mirror in PRD §6.2 matches `rename_all = "camelCase"`.
- Not compilable here: `src-tauri` only (system libs). Everything else verified by tests/builds this session.
