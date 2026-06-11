// src/state/robotStore.ts
// Frontend-authoritative working copy of the robot model (PRD §5.4 Pattern A),
// with undo/redo over the `robot` field via zundo's temporal middleware.
import { create } from "zustand";
import { temporal } from "zundo";
import type { Robot, Link, Joint, Material } from "../types/robot";

interface RobotState {
  robot: Robot | null;
  filePath: string | null;
  dirty: boolean;

  setRobot: (robot: Robot, filePath?: string | null) => void;
  markSaved: (path: string) => void;

  updateLink: (name: string, patch: Partial<Link>) => void;
  updateJoint: (name: string, patch: Partial<Joint>) => void;
  renameLink: (oldName: string, newName: string) => void;
  renameJoint: (oldName: string, newName: string) => void;
  addLink: (link: Link) => void;
  addJoint: (joint: Joint) => void;
  deleteLink: (name: string) => void;
  deleteJoint: (name: string) => void;
  upsertMaterial: (material: Material) => void;

  /** Names of joints that reference `linkName` as parent or child. */
  jointsReferencing: (linkName: string) => string[];
}

/** Patch the array item whose `name` matches, returning a new array. */
function patchByName<T extends { name: string }>(
  items: T[],
  name: string,
  patch: Partial<T>,
): T[] {
  return items.map((item) =>
    item.name === name ? { ...item, ...patch } : item,
  );
}

/** Mutate the robot via `fn`, mark dirty. No-op when no robot is loaded. */
function mutate(
  set: (fn: (s: RobotState) => Partial<RobotState>) => void,
  fn: (robot: Robot) => Robot,
): void {
  set((s) => (s.robot ? { robot: fn(s.robot), dirty: true } : {}));
}

export const useRobotStore = create<RobotState>()(
  temporal(
    (set, get) => ({
      robot: null,
      filePath: null,
      dirty: false,

      setRobot: (robot, filePath) => {
        set({ robot, filePath: filePath ?? null, dirty: false });
        // Fresh document: discard any prior undo/redo history.
        useRobotStore.temporal.getState().clear();
      },

      markSaved: (path) => set({ filePath: path, dirty: false }),

      updateLink: (name, patch) =>
        mutate(set, (r) => ({ ...r, links: patchByName(r.links, name, patch) })),

      updateJoint: (name, patch) =>
        mutate(set, (r) => ({ ...r, joints: patchByName(r.joints, name, patch) })),

      renameLink: (oldName, newName) =>
        mutate(set, (r) => ({
          ...r,
          links: r.links.map((l) =>
            l.name === oldName ? { ...l, name: newName } : l,
          ),
          // Rewrite joint parent/child refs to the new link name.
          joints: r.joints.map((j) => ({
            ...j,
            parent: j.parent === oldName ? newName : j.parent,
            child: j.child === oldName ? newName : j.child,
          })),
        })),

      renameJoint: (oldName, newName) =>
        mutate(set, (r) => ({
          ...r,
          joints: r.joints.map((j) =>
            j.name === oldName ? { ...j, name: newName } : j,
          ),
        })),

      addLink: (link) =>
        mutate(set, (r) => ({ ...r, links: [...r.links, link] })),

      addJoint: (joint) =>
        mutate(set, (r) => ({ ...r, joints: [...r.joints, joint] })),

      deleteLink: (name) =>
        mutate(set, (r) => ({
          ...r,
          links: r.links.filter((l) => l.name !== name),
          // Cascade: drop joints that reference the deleted link.
          joints: r.joints.filter((j) => j.parent !== name && j.child !== name),
        })),

      deleteJoint: (name) =>
        mutate(set, (r) => ({
          ...r,
          joints: r.joints.filter((j) => j.name !== name),
        })),

      upsertMaterial: (material) =>
        mutate(set, (r) => {
          const exists = r.materials.some((m) => m.name === material.name);
          return {
            ...r,
            materials: exists
              ? patchByName(r.materials, material.name, material)
              : [...r.materials, material],
          };
        }),

      jointsReferencing: (linkName) => {
        const robot = get().robot;
        if (!robot) return [];
        return robot.joints
          .filter((j) => j.parent === linkName || j.child === linkName)
          .map((j) => j.name);
      },
    }),
    {
      // Track only the `robot` field in undo/redo history.
      partialize: (state) => ({ robot: state.robot }),
      equality: (a, b) => a.robot === b.robot,
    },
  ),
);
