// src/lib/kinematics.ts
// Pure kinematic-tree builder shared by the RobotTree UI and the 3D renderer.
import type { Robot, Link, Joint } from "../types/robot";

export interface LinkNode {
  link: Link;
  children: { joint: Joint; node: LinkNode }[];
}

export interface RobotTree {
  roots: LinkNode[];
}

/**
 * Builds a forest of LinkNodes from the robot's links and joints.
 *
 * - A link is a root if no joint references it as a child.
 * - Joints with a missing/dangling parent or child link are skipped.
 * - Cycles are broken by visiting each link at most once.
 * - Orphan links (no incoming joint) each become their own root.
 */
export function buildTree(robot: Robot): RobotTree {
  const linkByName = new Map<string, Link>();
  for (const link of robot.links) linkByName.set(link.name, link);

  // Only keep joints whose parent and child both resolve to real links.
  const validJoints = robot.joints.filter(
    (j) => linkByName.has(j.parent) && linkByName.has(j.child),
  );

  // Group child joints by parent link name.
  const childJoints = new Map<string, Joint[]>();
  const hasIncoming = new Set<string>();
  for (const joint of validJoints) {
    if (!childJoints.has(joint.parent)) childJoints.set(joint.parent, []);
    childJoints.get(joint.parent)!.push(joint);
    hasIncoming.add(joint.child);
  }

  const visited = new Set<string>();

  function makeNode(link: Link): LinkNode {
    visited.add(link.name);
    const node: LinkNode = { link, children: [] };
    for (const joint of childJoints.get(link.name) ?? []) {
      const childLink = linkByName.get(joint.child)!;
      if (visited.has(childLink.name)) continue; // break cycles
      node.children.push({ joint, node: makeNode(childLink) });
    }
    return node;
  }

  const roots: LinkNode[] = [];
  for (const link of robot.links) {
    if (hasIncoming.has(link.name)) continue; // has a parent -> not a root
    if (visited.has(link.name)) continue;
    roots.push(makeNode(link));
  }

  // Any link still unvisited (e.g. trapped inside a cycle with no acyclic
  // entry point) becomes its own root so it is never lost.
  for (const link of robot.links) {
    if (!visited.has(link.name)) roots.push(makeNode(link));
  }

  return { roots };
}
