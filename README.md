# URDF Studio

Visual URDF editor for ROS2 — edit links, joints, geometry, materials, and inertia through forms with a live 3D preview, instead of hand-editing XML. Tauri 2 (Rust) + React/TypeScript. Spec: [URDF_Studio_PRD.md](URDF_Studio_PRD.md).

## Layout

```
urdf-core/    Rust: URDF parser, deterministic serializer, validation, mesh resolution (pure, no system deps)
src-tauri/    Rust: thin Tauri 2 shell exposing urdf-core over 7 IPC commands
src/          React: zustand stores (undo/redo via zundo), inspector forms, r3f 3D viewport
```

Rust owns parsing/serialization/validation; the frontend owns the live editable model (PRD §5.4 Pattern A) — edits update the 3D scene with no IPC round-trip.

## Prerequisites

- Node 18+ and npm
- Rust stable (`rustup`)
- Linux only: `sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev`

## Develop

```bash
npm install
npm run tauri dev    # native window (needs system deps above)
npm run dev          # browser-only UI dev mode (mock backend + sample robot)

cargo test -p urdf-core   # backend logic tests (also regenerates src/types/generated/)
npm test                  # frontend store/lib tests
npm run tauri build       # production installers
```

## Status

MVP scaffold complete — see [NEXT_SESSION.md](NEXT_SESSION.md) for what's done and what's next.
