# URDF Studio — Session Log & Next-Session Plan

## Session 1 transcript (2026-06-11)

Implemented the full MVP scaffold per `docs/superpowers/plans/2026-06-11-urdf-studio-mvp-scaffold.md`, executed with parallel subagents + two-stage review (spec compliance, then code quality). ~3,600 lines total. Commits:

| Commit | What |
|---|---|
| `31b2873` | Repo skeleton: vite/tsconfig/Tauri 2 config, Cargo workspace (`default-members = ["urdf-core"]`) |
| `89f54e7` | `urdf-core`: PRD §6.1 model (camelCase serde + ts-rs export), hand-rolled quick-xml parser, deterministic serializer, validation (schema/kinematics/inertia via Sylvester), `package://` resolver |
| `b84c325` | Frontend state: PRD §6.2 types, 7 IPC wrappers w/ browser mock fallback, robotStore (zundo undo/redo, rename ref-fixup, delete cascade), selection/ui stores, kinematics tree builder, rpy→Euler ("ZYX") |
| `98c06ff` | `src-tauri` shell: 7 commands (`open_urdf`, `save_urdf`, `serialize_urdf`, `validate_robot`, `resolve_mesh_path`, `read_mesh_file`, `new_robot`), dialog+fs plugins |
| `06acdb7` | UI: PRD §9.1 grid layout, toolbar, recursive RobotTree, full inspector (Link/Joint/Geometry/Pose/Inertial/Material forms), r3f viewport (Z-up group, cylinder Z-axis fix, STL loading, layer toggles, selection highlight), XML preview, problems panel w/ click-to-navigate, file/undo/validation hooks, dark+light themes |
| `b86f8dd` | Review fix: rootless-cycle robots now flagged `kinematic-loop` |
| `35f7fdb` | Review fix: mesh paths resolve relative to the opened URDF's dir (was hardcoded `""`) |

**Verified green:** `cargo test -p urdf-core` 40 tests · `npm test` 29 tests · `tsc --noEmit` · `vite build`.

**Key decisions** (deviations from PRD, all deliberate):
- Cargo **workspace split** (`urdf-core` / `src-tauri`) — logic is testable without webview system libs; thin shell.
- **react-three-fiber** instead of raw Three.js + `urdf-loaders` — scene is built from the in-memory Zustand model (the source of truth), not from URDF files.
- **No react-arborist** (recursive tree ~60 lines), **no MenuBar** (toolbar covers all MVP actions), **no nalgebra** (hand-rolled 3×3 Sylvester check), npm instead of pnpm (not installed).
- Browser dev mode: `src/api/mock.ts` + sample robot lets the whole UI run via `npm run dev` with no Rust at all.

## NOT verified yet (blocked on this machine)

`src-tauri` **has never been compiled** — the machine lacks webkit2gtk and sudo. The whole app has not been run as a native window; STL loading, dialogs, and IPC are untested end-to-end.

## Next session plan

1. **Compile + run the real app** (needs: `sudo apt install libwebkit2gtk-4.1-dev libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev`). Then `npm run tauri dev`, open a real URDF (e.g. from `urdf_tutorial`), and fix whatever IPC/serde mismatches surface — likely suspects: camelCase arg mapping on `resolve_mesh_path`, `Vec<u8>` transfer size for big meshes (consider `tauri::ipc::Response` raw bytes), dialog plugin permissions in `capabilities/default.json`.
2. **End-to-end smoke pass over every FR**: open → tree → select → edit each form field → 3D updates → undo/redo → validate → save → reopen identical (PRD §12.1 definition of done).
3. **Switch frontend types to the generated ones**: `src/types/robot.ts` is a hand mirror; re-point imports at `src/types/generated/` (ts-rs output) and delete the mirror, so Rust is the single schema source (PRD §6.3).
4. **DAE (Collada) mesh rendering** (FR-24): wire `ColladaLoader` next to the STL path in `LinkMesh.tsx` (currently placeholder).
5. **Unsaved-changes guard via Tauri** (FR-6): `beforeunload` works in dev; add `onCloseRequested` + confirm dialog for the native window.
6. **Polish backlog**: auto-expand inspector section when toggled on; scope Ctrl+Z away from text inputs; code-split the three.js chunk; recent-files list (P2); joint-state slider panel (P2, FR-28).
7. **Packaging**: `npm run tauri build` → .deb/.AppImage; add app icons beyond the placeholder PNG.

Known minor notes from review (non-blocking): `radToDeg`/`degToRad` unused in `src/lib/transforms.ts`; determinism test serializes the same object twice (roundtrip test does the real work); in an exact two-component tie the `disconnected-link` pick is deterministic but arbitrary.
