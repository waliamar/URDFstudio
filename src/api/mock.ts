// src/api/mock.ts
// Browser-dev fallbacks used when not running inside a Tauri webview.
// These let the full UI run under plain `vite dev`.
import type { Robot, Geometry, Pose } from "../types/robot";
import type { ValidationIssue } from "../types/validation";
import { sampleRobot } from "../samples/sampleRobot";

export async function openUrdf(_path: string): Promise<Robot> {
  return structuredClone(sampleRobot);
}

export async function openDocument(_path: string): Promise<{
  robot: Robot;
  computedUrdf: string;
  isXacro: boolean;
  workspaceRoot: string | null;
}> {
  const robot = structuredClone(sampleRobot);
  return {
    robot,
    computedUrdf: serialize(robot),
    isXacro: false,
    workspaceRoot: null,
  };
}

export async function newRobot(name: string): Promise<Robot> {
  return {
    name: name || "robot",
    links: [{ name: "base_link" }],
    joints: [],
    materials: [],
  };
}

export async function saveUrdf(path: string, _robot: Robot): Promise<void> {
  console.warn(`[mock] saveUrdf called for ${path}; no file written in browser mode.`);
}

export async function validateRobot(_robot: Robot): Promise<ValidationIssue[]> {
  return [];
}

export async function resolveMeshPath(
  _packagePath: string,
  _urdfDir: string,
): Promise<string | null> {
  return null;
}

export async function readMeshFile(path: string): Promise<Uint8Array> {
  throw new Error(`[mock] readMeshFile not available in browser mode: ${path}`);
}

// Compact TS serializer mirroring the URDF XML shape. Not guaranteed
// byte-identical to the Rust serializer — for live-preview in browser mode only.
export async function serializeUrdf(robot: Robot): Promise<string> {
  return serialize(robot);
}

function v3(v: readonly number[]): string {
  return v.join(" ");
}

function pose(p: Pose, indent: string): string {
  return `${indent}<origin xyz="${v3(p.xyz)}" rpy="${v3(p.rpy)}"/>\n`;
}

function geometry(g: Geometry, indent: string): string {
  let inner: string;
  switch (g.type) {
    case "box": inner = `<box size="${v3(g.size)}"/>`; break;
    case "cylinder": inner = `<cylinder radius="${g.radius}" length="${g.length}"/>`; break;
    case "sphere": inner = `<sphere radius="${g.radius}"/>`; break;
    case "mesh": inner = `<mesh filename="${g.filename}" scale="${v3(g.scale)}"/>`; break;
  }
  return `${indent}<geometry>${inner}</geometry>\n`;
}

function serialize(robot: Robot): string {
  let out = `<?xml version="1.0"?>\n<robot name="${robot.name}">\n`;
  for (const m of robot.materials) {
    out += `  <material name="${m.name}">`;
    if (m.color) out += `<color rgba="${v3(m.color)}"/>`;
    out += `</material>\n`;
  }
  for (const link of robot.links) {
    out += `  <link name="${link.name}">\n`;
    if (link.visual) {
      out += `    <visual>\n${pose(link.visual.origin, "      ")}${geometry(link.visual.geometry, "      ")}`;
      if (link.visual.materialName) out += `      <material name="${link.visual.materialName}"/>\n`;
      out += `    </visual>\n`;
    }
    if (link.collision) {
      out += `    <collision>\n${pose(link.collision.origin, "      ")}${geometry(link.collision.geometry, "      ")}    </collision>\n`;
    }
    if (link.inertial) {
      const i = link.inertial.inertia;
      out += `    <inertial>\n${pose(link.inertial.origin, "      ")}`;
      out += `      <mass value="${link.inertial.mass}"/>\n`;
      out += `      <inertia ixx="${i.ixx}" ixy="${i.ixy}" ixz="${i.ixz}" iyy="${i.iyy}" iyz="${i.iyz}" izz="${i.izz}"/>\n`;
      out += `    </inertial>\n`;
    }
    out += `  </link>\n`;
  }
  for (const j of robot.joints) {
    out += `  <joint name="${j.name}" type="${j.jointType}">\n`;
    out += `    <parent link="${j.parent}"/>\n    <child link="${j.child}"/>\n`;
    out += pose(j.origin, "    ");
    if (j.axis) out += `    <axis xyz="${v3(j.axis)}"/>\n`;
    if (j.limit) out += `    <limit lower="${j.limit.lower}" upper="${j.limit.upper}" effort="${j.limit.effort}" velocity="${j.limit.velocity}"/>\n`;
    out += `  </joint>\n`;
  }
  out += `</robot>\n`;
  return out;
}
