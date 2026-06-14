# URDF Studio

**A visual editor for ROS URDF/xacro robot descriptions, with a live 3D preview.**

Open a `.urdf` or `.xacro` file and edit links, joints, geometry, materials,
and inertia through real forms and a 3D viewport — instead of hand-editing XML
and re-launching RViz to find out what broke. Every edit updates the 3D scene
instantly, validation runs as you type, and saving writes back deterministic,
byte-stable XML. For xacro documents, edits are spliced straight back into your
original source files, so your macros and includes survive.

Built with **Tauri 2** (Rust core + native WebView) and **React 19 +
react-three-fiber**.

- **Status:** MVP — the Rust core (parser, serializer, validation) and the full
  React UI are complete and tested.
- **Version:** 0.1.0
- **Platforms:** Linux (primary), macOS, Windows (via Tauri).
- **Architecture map:** [`ARCHITECTURE.md`](ARCHITECTURE.md)

---

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Requirements](#requirements)
- [Install](#install)
- [Usage](#usage)
- [Develop](#develop)
- [Testing](#testing)
- [Building & packaging](#building--packaging)
- [Project layout](#project-layout)
- [License](#license)

---

## Features

### Open & parse
- **URDF and xacro** input. xacro documents are expanded by shelling out to the
  `xacro` CLI (sourcing your ROS / workspace `setup.bash`), so `package://` and
  `$(find pkg)` resolve exactly as they would in a real ROS shell.
- **ROS package resolution** (`ament`) — maps package names to their `share/`
  directories to locate meshes referenced by `package://` URIs.
- **Mesh resolution** relative to the opened file's directory and the package
  index.

### Edit through forms (Inspector)
- **Links** — name, visual + collision geometry, material, and inertial block.
- **Joints** — type (`fixed`, `revolute`, `continuous`, `prismatic`,
  `floating`, `planar`), parent/child links, origin, axis, and limits.
- **Geometry** — `box`, `cylinder`, `sphere`, and `mesh` (with file path),
  for both visual and collision.
- **Inertial** — mass, center-of-mass origin, and the full 3×3 inertia tensor.
- **Material** — RGBA color picker (react-colorful) and named materials.
- **Pose editor** — shared xyz / rpy origin editor used by links, joints,
  geometry, and inertial frames.
- **Unity-style number fields** — drag on a label to scrub the value; click to
  type an exact number; rounded display when blurred, full precision when
  focused.
- **xacro source write-back** — editing a field on a xacro document splices the
  new value back into the original source text (when the field maps to a
  writable anchor), preserving the rest of your xacro.
- **Undo / redo** across every model edit (history via `zundo`).

### 3D viewport
- **Live preview** of the kinematic tree, rebuilt from the in-memory model on
  every edit — no save/reload round-trip.
- **Mesh rendering** — STL and Collada (`.dae`).
- **Transform gizmo** — Unity-style translate/rotate handles on the selected
  link or joint; dragging writes the new origin back into the model.
- **Unity-style navigation** — left-click selects; `Alt`+drag orbits; middle
  drag pans; right-drag / scroll zooms; `F` frames the current selection. A
  corner orientation nav-gizmo shows and snaps view direction.
- **Layer toggles** — show/hide visual, collision, and inertial geometry
  independently.
- **Z-up** scene matching the URDF convention.

### Validation & inspection
- **Live validation** (debounced) covering:
  - **Schema** — required fields, value ranges, well-formed references.
  - **Kinematics** — orphan/disconnected links, missing parents/children,
    cycles / kinematic loops, missing root.
  - **Inertia** — mass and positive-definite inertia-tensor sanity.
- **Problems panel** — lists issues; click one to jump straight to the
  offending link or joint.
- **XML preview** — read-only, syntax-highlighted view of the computed URDF (or
  the xacro source), scroll-synced to the current selection.
- **Robot tree** — hierarchical link/joint browser that drives selection across
  the whole UI.
- **Status bar** — robot name plus a live validation summary.

### Output
- **Deterministic serializer** — saving round-trips the model to byte-stable
  URDF XML, so version-control diffs stay minimal and meaningful.

### Modes & theming
- **Dark and light** themes.
- **Browser dev mode** — the entire UI runs under plain `vite dev` against a
  mock backend and a built-in sample robot, with no Rust/native build required.

---

## Tech stack

| Layer | Technology | Version |
|---|---|---|
| Desktop shell | [Tauri](https://tauri.app) | 2 |
| Core language | Rust (edition 2021) | stable |
| XML parsing | quick-xml | 0.36 |
| Rust ↔ TS types | ts-rs | 10 |
| Serialization | serde / serde_json | 1 |
| Errors | thiserror | 2 |
| UI framework | React | 19 |
| 3D rendering | three.js | 0.176 |
| React 3D | @react-three/fiber | 9 |
| 3D helpers | @react-three/drei | 10 |
| State | zustand | 5 |
| Undo/redo | zundo | 2.3 |
| Color picker | react-colorful | 5.6 |
| Tauri plugins | plugin-dialog, plugin-fs | 2 |
| Language | TypeScript | 5.8 |
| Bundler / dev server | Vite | 6 |
| Test runner | Vitest | 3 |
| DOM for tests | jsdom | 29 |

---

## Architecture

Three layers (full file-by-file map in [`ARCHITECTURE.md`](ARCHITECTURE.md)):

```
urdf-core/    Rust: canonical robot model, URDF parser, deterministic serializer,
              validation, xacro source-tree + ROS package (ament) resolution.
              Pure logic — no Tauri/WebView dependency, fully unit-tested.

src-tauri/    Rust: thin Tauri 2 shell exposing urdf-core (plus filesystem and
              xacro expansion) to the UI as IPC commands.

src/          React 19 + react-three-fiber: Zustand stores (undo/redo via zundo)
              are the single source of truth; the 3D viewport, robot tree,
              inspector forms, and XML preview all derive from them.
```

**Data flow:** open file → (Tauri) expand xacro + parse with `urdf-core` →
load the `Robot` model into the Zustand `robotStore` (the working copy) → the
viewport, tree, inspector, and XML preview all render from that store. Edits
mutate the store (with undo history); xacro field edits additionally splice
back into source text. Saving serializes the store back to byte-stable XML.

Because the frontend holds the live, editable model, edits update the 3D scene
with **no IPC round-trip**. Rust owns parsing, serialization, and validation;
generated TypeScript types (via `ts-rs`) keep the two schemas in lockstep.

---

## Requirements

The installer checks these and tells you exactly what's missing.

- **Node.js 18+** and **npm** — <https://nodejs.org>
- **Rust (stable)** via rustup — <https://rustup.rs>
- **Linux — WebView/build libraries** (Tauri needs these to compile):
  ```bash
  # Debian / Ubuntu
  sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
    libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
  # Fedora
  sudo dnf install webkit2gtk4.1-devel openssl-devel curl wget file \
    libappindicator-gtk3-devel librsvg2-devel gcc gcc-c++
  ```
- **`xacro` CLI** *(optional)* — only needed to open `.xacro` files. Ships with
  ROS (`source /opt/ros/<distro>/setup.bash`) or installs via
  `pip install xacro`. Plain `.urdf` files need nothing extra.

---

## Install

The installer builds the native app from source and puts a `urdfstudio`
launcher on your `PATH`.

```bash
git clone git@github.com:waliamar/URDFstudio.git
cd URDFstudio
./scripts/install.sh
```

Then, from anywhere:

```bash
urdfstudio
```

By default everything installs under your home directory (no `sudo`):

| What | Location |
|---|---|
| Launcher | `~/.local/bin/urdfstudio` |
| App binary | `~/.local/lib/urdfstudio/` |
| Desktop entry (Linux) | `~/.local/share/applications/urdfstudio.desktop` |

If the installer warns that `~/.local/bin` isn't on your `PATH`, add it:

```bash
export PATH="$HOME/.local/bin:$PATH"   # add to ~/.bashrc or ~/.zshrc
```

### Installer options

Set these as environment variables when running the script:

| Variable | Effect |
|---|---|
| `PREFIX=/usr/local` | System-wide install (run with `sudo`). |
| `BIN_DIR=...` / `LIB_DIR=...` | Custom launcher / binary locations. |
| `SKIP_DEPS=1` | Skip `npm install`. |
| `SKIP_BUILD=1` | Reuse an existing release build instead of rebuilding. |

```bash
# Example: system-wide install
PREFIX=/usr/local sudo ./scripts/install.sh
```

### Uninstall

```bash
rm -f  ~/.local/bin/urdfstudio
rm -rf ~/.local/lib/urdfstudio
rm -f  ~/.local/share/applications/urdfstudio.desktop
```

---

## Usage

Launch with `urdfstudio` (or `npm run tauri dev` from a clone). Open a file via
the toolbar, then:

### Mouse & keyboard

| Action | Control |
|---|---|
| Select link/joint | Left-click (in viewport or tree) |
| Orbit camera | `Alt` + left-drag |
| Pan camera | Middle-drag |
| Zoom | Right-drag or scroll wheel |
| Frame selection | `F` |
| Move/rotate selection | Drag the transform gizmo |
| Undo | `Ctrl/Cmd` + `Z` |
| Redo | `Ctrl/Cmd` + `Shift` + `Z`  /  `Ctrl` + `Y` |
| Scrub a number field | Drag on its label |
| Edit exact value | Click into the field and type |

### Typical workflow
1. **Open** a `.urdf` / `.xacro` from the toolbar.
2. **Select** a link or joint in the tree or viewport.
3. **Edit** its fields in the Inspector, or drag the gizmo in the viewport.
4. Watch the **3D preview** and **Problems panel** update live.
5. **Save** — URDF is written back deterministically; xacro edits go back into
   source.

---

## Develop

```bash
npm install

npm run dev          # browser-only UI (mock backend + sample robot, no Rust)
npm run tauri dev    # full native window (needs the Linux system deps above)

cargo test -p urdf-core   # Rust core tests; also regenerates src/types/generated/
npm test                  # frontend store/lib tests (Vitest)
npm run build             # type-check (tsc --noEmit) + production frontend build
npm run tauri build       # production app + OS installers
```

`npm run dev` is the fastest loop: the whole UI runs in a normal browser tab
against `src/api/mock.ts`, so you can work on the frontend without compiling
Rust or installing the WebView libraries.

> The `npm run tauri` wrapper (`scripts/tauri.sh`) strips snap-injected
> GTK/GLib env vars before invoking the Tauri CLI, which avoids a glibc symbol
> crash when launching the native window from a snap-packaged terminal/editor.

---

## Testing

```bash
cargo test -p urdf-core   # parser/serializer round-trip + validation rules
npm test                  # Zustand stores + pure lib helpers (Vitest)
npm run build             # tsc type-check + Vite production build
```

The Rust core is fully unit-tested independent of the WebView, so logic tests
run anywhere — no system GUI libraries required.

---

## Building & packaging

```bash
npm run tauri build
```

Produces a self-contained release binary plus OS installers under
`src-tauri/target/release/` (e.g. `.deb` / `.AppImage` on Linux). The
`scripts/install.sh` installer wraps this build and wires up the `urdfstudio`
command.

---

## Project layout

```
urdf-core/      Rust core: model, parser, serializer, validation, ament/mesh,
                xacro source-tree resolution (+ integration tests)
src-tauri/      Tauri 2 shell: IPC commands, xacro expansion, app config/icons
src/
  api/          typed IPC wrappers + browser mock fallback + dialogs
  state/        Zustand stores (robot/selection/ui/issues) with undo/redo
  lib/          pure helpers (transforms, kinematics, gizmo math, formatting)
  types/        TS robot/validation types + ts-rs generated/
  components/   viewport/ inspector/ tree/ xml/ layout/ problems/
  hooks/        file ops, undo/redo wiring, debounced validation
  samples/      sample robot used by browser dev mode
  styles/       global + theme CSS
scripts/        install.sh (installer), tauri.sh (CLI wrapper)
ARCHITECTURE.md detailed, file-by-file architecture reference
```

---

## License

See repository for license details.
