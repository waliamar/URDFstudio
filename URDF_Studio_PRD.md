# URDF Studio — Product Requirements Document

**Project:** URDF Studio — a visual URDF editor for ROS2
**Architecture:** Tauri 2 (Rust backend) + React (TypeScript) frontend
**Document version:** 1.0
**Status:** Draft for engineering
**Author:** [you]
**Last updated:** June 2026

---

## 1. Overview

### 1.1 Summary

URDF Studio is a cross-platform desktop application that lets roboticists create, edit, and validate URDF (Unified Robot Description Format) files visually, with a live 3D preview, instead of hand-editing raw XML. It eliminates the slow edit-XML → launch-sim → inspect → repeat loop that dominates ROS2 robot modeling today.

The application is a native desktop program built with Tauri 2. The Rust backend handles file I/O, URDF/XML parsing, validation, and export. The React + TypeScript frontend renders the UI and a real-time 3D scene using Three.js with the `urdf-loaders` library. The two communicate over Tauri's IPC bridge.

### 1.2 Problem statement

ROS2 developers currently edit URDF files as raw XML in a text editor. There is no widely adopted, standalone, beginner-friendly tool that provides a visual editor with live 3D preview and validation. The existing tools each miss a critical piece: they lack mesh pipelines, multi-format export, validation, or they require Blender expertise or a cloud account. The unoccupied position is a local-first, integrated, native desktop editor.

### 1.3 Goals

- Let a user open a `.urdf` file and see the robot rendered in 3D within seconds.
- Let a user edit links, joints, geometry, materials, and inertia through forms — never touching XML.
- Update the 3D preview in real time as the user edits.
- Validate the robot description and surface errors clearly (broken kinematic chains, invalid inertia, missing fields).
- Export clean, valid URDF XML.
- Run natively on Linux, macOS, and Windows from one codebase.

### 1.4 Non-goals (for v1)

- No live connection to a running ROS2 system (file-only tool).
- No launch file editing or visualization.
- No CAD mesh creation (mesh import only).
- No cloud sync, accounts, or collaboration.
- No SDF / MJCF / xacro export in v1 (deferred to Phase 3).
- No nav2 YAML parameter editing in v1 (deferred to Phase 2).

---

## 2. Target users & personas

### 2.1 Persona: Sam, the robotics student

Learning ROS2 in a university course. Struggles with URDF XML syntax — the most common first blocker. Needs to *see* the robot to understand link/joint relationships. Values a tool that is free, installs in one step, and works offline.

### 2.2 Persona: Priya, the rapid prototyper

Builds new robot configurations frequently at a startup. The XML → sim → inspect cycle costs her 20–30 minutes per iteration. Wants to tweak joint origins and limits and see the result instantly. Values speed and keyboard-friendly workflows.

### 2.3 Persona: Marco, the research engineer

Works on a team where multiple people edit the same robot description. Needs diff-friendly, deterministic XML output so version control stays clean. Values validation that catches mistakes before they reach simulation.

---

## 3. Functional requirements

Requirements are tagged: **[MVP]** = must ship in v1, **[P2]** = Phase 2, **[P3]** = Phase 3.

### 3.1 File operations

- **FR-1 [MVP]** Open a `.urdf` file via a native file dialog.
- **FR-2 [MVP]** Parse the URDF into an in-memory robot model.
- **FR-3 [MVP]** Save edits back to the original file (overwrite).
- **FR-4 [MVP]** "Save As" to a new path.
- **FR-5 [MVP]** Create a new, empty robot from scratch.
- **FR-6 [MVP]** Detect unsaved changes and warn on close.
- **FR-7 [P2]** Open `.xacro` files (requires xacro expansion).

### 3.2 Link & joint editing

- **FR-8 [MVP]** Display the link/joint hierarchy as a navigable tree.
- **FR-9 [MVP]** Select a link or joint to open its property form.
- **FR-10 [MVP]** Edit link visual geometry (box, cylinder, sphere, mesh) with numeric parameters.
- **FR-11 [MVP]** Edit link origin (xyz, rpy).
- **FR-12 [MVP]** Edit link material (name + RGBA color).
- **FR-13 [MVP]** Edit joint type (fixed, revolute, prismatic, continuous, planar, floating).
- **FR-14 [MVP]** Edit joint parent/child link references.
- **FR-15 [MVP]** Edit joint origin, axis, and limits (lower, upper, effort, velocity).
- **FR-16 [MVP]** Add a new link or joint.
- **FR-17 [MVP]** Delete a link or joint (with reference cleanup warnings).
- **FR-18 [MVP]** Edit link collision geometry separately from visual.
- **FR-19 [MVP]** Edit link inertial properties (mass, inertia tensor, center of mass).

### 3.3 3D preview

- **FR-20 [MVP]** Render the robot in a live WebGL 3D viewport.
- **FR-21 [MVP]** Update the 3D scene in real time as form fields change.
- **FR-22 [MVP]** Orbit / pan / zoom camera controls.
- **FR-23 [MVP]** Import and render `.stl` mesh files.
- **FR-24 [MVP]** Import and render `.dae` (Collada) mesh files.
- **FR-25 [MVP]** Resolve `package://` mesh paths automatically.
- **FR-26 [MVP]** Toggle visual / collision / inertia display layers.
- **FR-27 [MVP]** Highlight the currently selected link/joint in the 3D scene.
- **FR-28 [P2]** Joint slider panel to animate joint states (like `joint_state_publisher_gui`).
- **FR-29 [P2]** Display TF axes (xyz triads) on each link frame.

### 3.4 Validation

- **FR-30 [MVP]** Validate against the URDF schema — flag missing required fields inline.
- **FR-31 [MVP]** Kinematic chain checker — detect disconnected links, loops, orphan joints, multiple roots.
- **FR-32 [MVP]** Inertia sanity checks — warn on zero/negative mass and non-positive-definite inertia tensors.
- **FR-33 [MVP]** Surface all validation issues in a dedicated problems panel with click-to-navigate.

### 3.5 Export (deferred)

- **FR-34 [P3]** Export to SDF (Gazebo).
- **FR-35 [P3]** Export to MJCF (Isaac Lab / MuJoCo).
- **FR-36 [P3]** Export to parametric xacro with macro scaffolding.

### 3.6 Editor experience

- **FR-37 [MVP]** Undo / redo for all edits.
- **FR-38 [MVP]** Live raw-XML preview pane that updates as you edit.
- **FR-39 [MVP]** Light / dark theme.
- **FR-40 [P2]** Recent files list.

---

## 4. Non-functional requirements

- **NFR-1** 3D preview updates in under 100 ms after a form field change.
- **NFR-2** Open and render a typical 20-link robot in under 2 seconds.
- **NFR-3** Application binary under 20 MB (Tauri advantage over Electron).
- **NFR-4** Runs on Ubuntu 22.04+, macOS 12+, Windows 10+.
- **NFR-5** Exported XML is deterministic (same model always produces byte-identical output) for clean version control diffs.
- **NFR-6** No network connection required for any core feature.

---

## 5. System architecture

### 5.1 High-level architecture

```
┌─────────────────────────────────────────────────────────┐
│                   URDF Studio (Tauri app)                 │
│                                                           │
│   ┌─────────────────────┐      ┌──────────────────────┐  │
│   │  React + TS Frontend │      │   Rust Backend       │  │
│   │  (WebView)           │◄────►│   (Tauri core)       │  │
│   │                      │ IPC  │                      │  │
│   │  - UI components     │      │  - File I/O          │  │
│   │  - 3D viewport       │      │  - URDF parser       │  │
│   │    (Three.js +       │      │  - Validation        │  │
│   │     urdf-loaders)    │      │  - XML serializer    │  │
│   │  - State (Zustand)   │      │  - Export pipeline   │  │
│   └─────────────────────┘      └──────────────────────┘  │
│                                                           │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
                  Local filesystem (.urdf, meshes)
```

### 5.2 Responsibility split

The split follows the principle: **Rust owns the data and the truth; React owns the presentation.**

- **Rust backend** owns: reading/writing files, parsing URDF into the canonical data model, validation logic, and XML serialization. It is the single source of truth for the robot model on disk.
- **React frontend** owns: all UI, the live 3D scene, transient editing state, and undo/redo. It holds a working copy of the robot model and sends mutations to Rust only on save (or optionally on every change, see 5.4).

### 5.3 Why this split

Parsing and validation in Rust gives correctness and speed, and keeps the serialization deterministic (NFR-5). Rendering in the WebView lets you use the mature Three.js + `urdf-loaders` ecosystem, which is the single biggest reason to choose this architecture over a pure-Rust GUI.

### 5.4 State synchronization strategy

Two viable patterns — the PRD recommends **Pattern A** for v1:

**Pattern A — Frontend-authoritative working copy (recommended)**
The frontend holds the live, editable robot model in Zustand. Rust parses on open and serializes on save. The 3D preview reads directly from Zustand, so edits are instant with no IPC round-trip. Validation can run on-demand (via a Rust command) or continuously (via a debounced call). Simpler, faster UI, fewer IPC calls.

**Pattern B — Backend-authoritative**
Every mutation is an IPC call to Rust, which updates the canonical model and returns the new state. Guarantees the frontend never diverges from the validated model, but adds latency to every keystroke and is harder to make feel instant. Defer unless you hit correctness problems.

---

## 6. Data model

The canonical data model is defined in Rust and mirrored in TypeScript. Both must stay in sync — see 6.3 for the recommended type-generation approach.

### 6.1 Rust data model (canonical)

```rust
// src-tauri/src/model/mod.rs

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Robot {
    pub name: String,
    pub links: Vec<Link>,
    pub joints: Vec<Joint>,
    pub materials: Vec<Material>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Link {
    pub name: String,
    pub visual: Option<Visual>,
    pub collision: Option<Collision>,
    pub inertial: Option<Inertial>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Visual {
    pub origin: Pose,
    pub geometry: Geometry,
    pub material_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Collision {
    pub origin: Pose,
    pub geometry: Geometry,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Inertial {
    pub origin: Pose,
    pub mass: f64,
    pub inertia: InertiaTensor,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum Geometry {
    Box { size: [f64; 3] },
    Cylinder { radius: f64, length: f64 },
    Sphere { radius: f64 },
    Mesh { filename: String, scale: [f64; 3] },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Joint {
    pub name: String,
    pub joint_type: JointType,
    pub parent: String,   // parent link name
    pub child: String,    // child link name
    pub origin: Pose,
    pub axis: Option<[f64; 3]>,
    pub limit: Option<JointLimit>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum JointType {
    Fixed,
    Revolute,
    Continuous,
    Prismatic,
    Planar,
    Floating,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JointLimit {
    pub lower: f64,
    pub upper: f64,
    pub effort: f64,
    pub velocity: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pose {
    pub xyz: [f64; 3],
    pub rpy: [f64; 3],
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InertiaTensor {
    pub ixx: f64, pub ixy: f64, pub ixz: f64,
    pub iyy: f64, pub iyz: f64, pub izz: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Material {
    pub name: String,
    pub color: Option<[f64; 4]>, // rgba
    pub texture: Option<String>,
}
```

### 6.2 TypeScript mirror

```typescript
// src/types/robot.ts

export interface Robot {
  name: string;
  links: Link[];
  joints: Joint[];
  materials: Material[];
}

export interface Link {
  name: string;
  visual?: Visual;
  collision?: Collision;
  inertial?: Inertial;
}

export interface Visual {
  origin: Pose;
  geometry: Geometry;
  materialName?: string;
}

export interface Collision {
  origin: Pose;
  geometry: Geometry;
}

export interface Inertial {
  origin: Pose;
  mass: number;
  inertia: InertiaTensor;
}

export type Geometry =
  | { type: "box"; size: [number, number, number] }
  | { type: "cylinder"; radius: number; length: number }
  | { type: "sphere"; radius: number }
  | { type: "mesh"; filename: string; scale: [number, number, number] };

export type JointType =
  | "fixed" | "revolute" | "continuous"
  | "prismatic" | "planar" | "floating";

export interface Joint {
  name: string;
  jointType: JointType;
  parent: string;
  child: string;
  origin: Pose;
  axis?: [number, number, number];
  limit?: JointLimit;
}

export interface JointLimit {
  lower: number;
  upper: number;
  effort: number;
  velocity: number;
}

export interface Pose {
  xyz: [number, number, number];
  rpy: [number, number, number];
}

export interface InertiaTensor {
  ixx: number; ixy: number; ixz: number;
  iyy: number; iyz: number; izz: number;
}

export interface Material {
  name: string;
  color?: [number, number, number, number];
  texture?: string;
}
```

### 6.3 Keeping types in sync

Maintaining two copies of the model by hand is error-prone. Use the `ts-rs` crate to auto-generate the TypeScript definitions from the Rust structs at build time. Annotate each Rust struct with `#[derive(TS)]` and `#[ts(export)]`, and `ts-rs` writes the `.ts` files. This makes Rust the single source of truth for the schema.

---

## 7. Tauri IPC command surface

These are the Rust functions exposed to the frontend via `#[tauri::command]`. The frontend calls them with `invoke()`.

### 7.1 Command list

| Command | Input | Output | Purpose |
|---|---|---|---|
| `open_urdf` | `path: String` | `Robot` | Parse a URDF file into the model |
| `save_urdf` | `path: String, robot: Robot` | `()` | Serialize the model to a file |
| `serialize_urdf` | `robot: Robot` | `String` | Return XML string (for live preview) |
| `validate_robot` | `robot: Robot` | `Vec<ValidationIssue>` | Run all validation checks |
| `resolve_mesh_path` | `package_path: String, urdf_dir: String` | `String` | Resolve `package://` to absolute path |
| `read_mesh_file` | `path: String` | `Vec<u8>` | Read raw mesh bytes for the renderer |
| `new_robot` | `name: String` | `Robot` | Create an empty robot |

### 7.2 Rust command implementation (example)

```rust
// src-tauri/src/commands.rs

use crate::model::Robot;
use crate::parser::parse_urdf;
use crate::serializer::serialize_urdf as serialize;
use crate::validation::{validate, ValidationIssue};

#[tauri::command]
pub fn open_urdf(path: String) -> Result<Robot, String> {
    let xml = std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read file: {e}"))?;
    parse_urdf(&xml).map_err(|e| format!("Parse error: {e}"))
}

#[tauri::command]
pub fn save_urdf(path: String, robot: Robot) -> Result<(), String> {
    let xml = serialize(&robot).map_err(|e| format!("Serialize error: {e}"))?;
    std::fs::write(&path, xml).map_err(|e| format!("Write error: {e}"))
}

#[tauri::command]
pub fn serialize_urdf(robot: Robot) -> Result<String, String> {
    serialize(&robot).map_err(|e| format!("Serialize error: {e}"))
}

#[tauri::command]
pub fn validate_robot(robot: Robot) -> Vec<ValidationIssue> {
    validate(&robot)
}
```

### 7.3 TypeScript invocation wrapper

```typescript
// src/api/commands.ts

import { invoke } from "@tauri-apps/api/core";
import type { Robot } from "../types/robot";
import type { ValidationIssue } from "../types/validation";

export async function openUrdf(path: string): Promise<Robot> {
  return invoke<Robot>("open_urdf", { path });
}

export async function saveUrdf(path: string, robot: Robot): Promise<void> {
  return invoke<void>("save_urdf", { path, robot });
}

export async function serializeUrdf(robot: Robot): Promise<string> {
  return invoke<string>("serialize_urdf", { robot });
}

export async function validateRobot(robot: Robot): Promise<ValidationIssue[]> {
  return invoke<ValidationIssue[]>("validate_robot", { robot });
}

export async function newRobot(name: string): Promise<Robot> {
  return invoke<Robot>("new_robot", { name });
}
```

---

## 8. Full project directory structure

```
urdf-studio/
├── README.md
├── package.json                  # Frontend deps & scripts
├── pnpm-lock.yaml
├── tsconfig.json
├── vite.config.ts                # Vite bundler config
├── index.html                    # WebView entry point
│
├── src/                          # ── REACT FRONTEND ──
│   ├── main.tsx                  # React root / entry
│   ├── App.tsx                   # Top-level layout
│   │
│   ├── api/                      # Tauri IPC wrappers
│   │   ├── commands.ts           # invoke() wrappers (see 7.3)
│   │   └── dialog.ts             # File open/save dialogs
│   │
│   ├── types/                    # TS type definitions
│   │   ├── robot.ts              # Robot model (see 6.2)
│   │   ├── validation.ts         # ValidationIssue type
│   │   └── generated/            # ts-rs auto-generated types
│   │
│   ├── state/                    # Zustand stores
│   │   ├── robotStore.ts         # Robot model + mutations
│   │   ├── selectionStore.ts     # Currently selected link/joint
│   │   ├── historyStore.ts       # Undo/redo stack
│   │   └── uiStore.ts            # Theme, panel visibility, layers
│   │
│   ├── components/               # ── UI COMPONENTS ──
│   │   ├── layout/
│   │   │   ├── MenuBar.tsx        # File/Edit/View menus
│   │   │   ├── Toolbar.tsx        # Quick actions
│   │   │   ├── StatusBar.tsx      # File path, validation count
│   │   │   └── ResizablePanels.tsx
│   │   │
│   │   ├── tree/
│   │   │   ├── RobotTree.tsx      # Link/joint hierarchy tree
│   │   │   ├── TreeNode.tsx       # Single tree item
│   │   │   └── TreeContextMenu.tsx # Add/delete actions
│   │   │
│   │   ├── inspector/             # Property forms (right panel)
│   │   │   ├── Inspector.tsx      # Router: shows link or joint form
│   │   │   ├── LinkForm.tsx
│   │   │   ├── JointForm.tsx
│   │   │   ├── GeometryEditor.tsx # Box/cyl/sphere/mesh switcher
│   │   │   ├── PoseEditor.tsx     # xyz + rpy inputs
│   │   │   ├── InertialEditor.tsx # mass + inertia tensor
│   │   │   ├── MaterialEditor.tsx # color picker
│   │   │   └── fields/            # Reusable form fields
│   │   │       ├── NumberField.tsx
│   │   │       ├── Vector3Field.tsx
│   │   │       └── SelectField.tsx
│   │   │
│   │   ├── viewport/              # ── 3D PREVIEW ──
│   │   │   ├── Viewport.tsx       # Three.js canvas container
│   │   │   ├── SceneManager.ts    # Scene setup, camera, lights
│   │   │   ├── RobotRenderer.ts   # Builds Three.js objects from model
│   │   │   ├── meshLoader.ts      # STL/DAE loading via urdf-loaders
│   │   │   ├── controls.ts        # Orbit controls
│   │   │   └── layers.ts          # Visual/collision/inertia toggles
│   │   │
│   │   ├── xml/
│   │   │   └── XmlPreview.tsx     # Live read-only XML pane
│   │   │
│   │   └── problems/
│   │       └── ProblemsPanel.tsx  # Validation issues list
│   │
│   ├── hooks/                     # Custom React hooks
│   │   ├── useFileOps.ts          # Open/save/new with dialogs
│   │   ├── useUndoRedo.ts         # Keyboard shortcuts + history
│   │   ├── useValidation.ts       # Debounced validation calls
│   │   └── useLivePreview.ts      # Syncs model → 3D scene
│   │
│   ├── lib/                       # Frontend utilities
│   │   ├── urdfToThree.ts         # Model → Three.js conversion
│   │   ├── transforms.ts          # rpy → quaternion math
│   │   └── debounce.ts
│   │
│   └── styles/
│       ├── globals.css
│       └── theme.css              # Light/dark CSS variables
│
├── src-tauri/                    # ── RUST BACKEND ──
│   ├── Cargo.toml                # Rust deps
│   ├── Cargo.lock
│   ├── build.rs                  # Tauri build script
│   ├── tauri.conf.json           # App config (window, bundle, perms)
│   ├── capabilities/             # Tauri 2 permission definitions
│   │   └── default.json
│   ├── icons/                    # App icons (all platforms)
│   │
│   └── src/
│       ├── main.rs               # App entry, registers commands
│       ├── commands.rs           # All #[tauri::command] fns (see 7.2)
│       │
│       ├── model/                # Canonical data model
│       │   └── mod.rs            # Robot, Link, Joint, etc. (see 6.1)
│       │
│       ├── parser/               # URDF → model
│       │   ├── mod.rs
│       │   └── xml_parser.rs     # quick-xml based parsing
│       │
│       ├── serializer/           # model → URDF
│       │   ├── mod.rs
│       │   └── xml_writer.rs     # deterministic XML output
│       │
│       ├── validation/           # Validation logic
│       │   ├── mod.rs
│       │   ├── schema.rs         # Required-field checks
│       │   ├── kinematics.rs     # Chain/loop/orphan detection
│       │   └── inertia.rs        # Mass + tensor checks
│       │
│       └── mesh/                 # Mesh path resolution
│           └── resolver.rs       # package:// resolution
│
└── tests/                        # Integration tests
    ├── fixtures/                 # Sample .urdf files
    └── parser_tests.rs
```

---

## 9. Frontend layout

### 9.1 Screen layout

```
┌──────────────────────────────────────────────────────────────┐
│  Menu Bar:  File   Edit   View   Help                          │
├──────────────────────────────────────────────────────────────┤
│  Toolbar:  [New] [Open] [Save]  |  [Undo] [Redo]  |  [Layers]  │
├────────────┬───────────────────────────────┬──────────────────┤
│            │                               │                  │
│  Robot     │                               │   Inspector      │
│  Tree      │      3D Viewport              │   (property      │
│            │      (Three.js canvas)        │    forms for     │
│  - base    │                               │    selected      │
│    - joint1│      [orbit/pan/zoom]         │    link/joint)   │
│      - arm │                               │                  │
│    - joint2│                               │                  │
│      - hand│                               │                  │
│            │                               │                  │
├────────────┴───────────────────────────────┴──────────────────┤
│  Bottom panel (tabbed):  [Problems (3)]  [XML Preview]         │
├──────────────────────────────────────────────────────────────┤
│  Status Bar:  /home/user/robot.urdf  •  20 links  •  3 issues  │
└──────────────────────────────────────────────────────────────┘
```

### 9.2 Core interaction flow

1. User clicks **Open** → native file dialog → selects `robot.urdf`.
2. Frontend calls `openUrdf(path)` → Rust parses → returns `Robot`.
3. `robotStore` is populated; `RobotTree` and `Viewport` render.
4. User clicks a joint in the tree → `selectionStore` updates → `Inspector` shows `JointForm`.
5. User edits the joint's origin xyz → `robotStore` mutation fires.
6. `useLivePreview` hook detects the change → updates the Three.js scene (no IPC).
7. `useValidation` hook (debounced 300 ms) calls `validateRobot()` → `ProblemsPanel` updates.
8. User clicks **Save** → frontend calls `saveUrdf(path, robot)` → Rust serializes to disk.

---

## 10. Tech stack & dependencies

### 10.1 Frontend (`package.json`)

| Package | Purpose |
|---|---|
| `react`, `react-dom` | UI framework |
| `typescript` | Type safety |
| `vite` | Build tool / dev server |
| `@tauri-apps/api` | Tauri IPC and dialog bindings |
| `zustand` | State management (model, selection, history) |
| `three` | 3D rendering |
| `urdf-loaders` | NASA JPL URDF → Three.js loader |
| `react-three-fiber` (optional) | React bindings for Three.js |
| `@react-three/drei` (optional) | Helpers (OrbitControls, etc.) |
| `react-arborist` | Tree component for the hierarchy panel |
| `react-colorful` | Color picker for materials |

### 10.2 Backend (`Cargo.toml`)

| Crate | Purpose |
|---|---|
| `tauri` (v2) | Desktop shell + IPC |
| `serde`, `serde_json` | (De)serialization across IPC |
| `quick-xml` | Fast XML parsing and writing |
| `urdf-rs` | Reference URDF parser (optional, can roll your own) |
| `ts-rs` | Generate TS types from Rust structs |
| `thiserror` | Ergonomic error types |
| `nalgebra` | Linear algebra for inertia validation |

### 10.3 Key open-source building blocks

- **`urdf-loaders`** (NASA JPL, MIT) — Three.js loader handling STL/DAE meshes and `package://` paths. This is the renderer foundation.
- **`urdf-rs`** (Rust) — reference parser to validate your own parser against, or use directly.
- **`quick-xml`** — chosen over `xml-rs` for speed and serde integration.

---

## 11. Development setup

### 11.1 Prerequisites

- Node.js 18+ and `pnpm`
- Rust toolchain (`rustup`, stable)
- Platform-specific Tauri dependencies (WebView2 on Windows, `webkit2gtk` on Linux, Xcode tools on macOS)

### 11.2 Bootstrapping commands

```bash
# Scaffold the Tauri 2 + React + TypeScript project
pnpm create tauri-app urdf-studio --template react-ts

cd urdf-studio
pnpm install

# Add frontend deps
pnpm add zustand three urdf-loaders react-arborist react-colorful

# Add Rust deps (edit src-tauri/Cargo.toml, then)
cd src-tauri && cargo add serde serde_json quick-xml ts-rs thiserror nalgebra

# Run in dev mode (hot-reload frontend, native window)
pnpm tauri dev

# Build a production binary
pnpm tauri build
```

---

## 12. MVP scope & milestones

The MVP proves the core loop: **open → edit visually → see 3D update → export valid XML.**

| Milestone | Weeks | Deliverable |
|---|---|---|
| **M1 — Parser + tree** | 1–2 | Rust parses URDF into the model; frontend renders the link/joint tree; clicking shows a read-only property form. No 3D yet. |
| **M2 — Live 3D preview** | 3–4 | Three.js + urdf-loaders integrated. Robot renders. Box/cylinder/sphere first, then STL meshes. Selection highlights in 3D. |
| **M3 — Edit + export loop** | 5–6 | All form fields writable. Undo/redo. Deterministic XML serializer in Rust. Basic validation (missing fields, broken links). |
| **M4 — Polish + ship** | 7–8 | Collision/inertia layers, mesh file browser, DAE support, dark theme. Tagged v1.0 release with installers for all three platforms. |

### 12.1 Definition of done for v1

- A user can open any standard URDF, see it in 3D, edit every supported field, and save valid XML that re-opens identically.
- Validation catches the three core error classes (schema, kinematics, inertia).
- Installers exist for Linux (.deb/.AppImage), macOS (.dmg), Windows (.msi).

---

## 13. Phases beyond MVP

- **Phase 2:** Joint animation panel, TF axis display, `.xacro` support, recent files, nav2 YAML parameter editor (schema-driven form with hover docs).
- **Phase 3:** Multi-format export — SDF (Gazebo), MJCF (Isaac Lab), xacro with macro scaffolding. This is the major commercial differentiator no competing tool offers.

---

## 14. Risks & mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Rust learning curve slows progress | Schedule slip | Keep Rust surface minimal in MVP (parse/serialize/validate only); all UI complexity stays in familiar React |
| `package://` path resolution is fragile across setups | Meshes fail to load | Reuse `urdf-loaders`' proven resolution logic; walk up to find `package.xml` like noctrog/urdf-editor does |
| Type drift between Rust and TS models | Runtime IPC errors | Use `ts-rs` to auto-generate TS types from Rust — single source of truth |
| DAE (Collada) meshes are complex to render | Some robots won't preview | Ship STL first (simpler); add DAE in M4; show a placeholder for unsupported mesh types |
| Tauri 2 IPC boilerplate friction | Dev velocity | Wrap all `invoke` calls in a thin typed API layer (`src/api/commands.ts`) so components never touch raw IPC |
| Scope creep into launch files / nav2 | Diluted MVP | Hard non-goals in section 1.4; defer everything to Phase 2/3 |

---

## 15. Success metrics

- **Adoption:** GitHub stars, downloads per release, weekly active opens (local telemetry, opt-in only).
- **Activation:** % of users who open a file, make an edit, and save within the first session.
- **Time saved:** self-reported reduction in the edit→preview cycle (target: from ~20 min to under 1 min).
- **Quality:** validation catches errors before simulation — measured by user reports of "caught a bug before launch."

---

## 16. Open questions

1. Should the 3D viewport use raw Three.js or `react-three-fiber`? (r3f is more idiomatic React but adds a dependency and a learning layer; raw Three.js gives finer control over the render loop.)
2. Should validation run continuously (debounced) or only on save/demand? (Pattern A in 5.4 allows either.)
3. Do we ship telemetry at all in v1, or keep it fully offline and add opt-in telemetry later?
4. Is `urdf-rs` worth using directly, or should the parser be hand-rolled with `quick-xml` for full control over the model shape?

---

*End of document.*
