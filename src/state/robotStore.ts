// src/state/robotStore.ts
// Frontend-authoritative working copy of the robot model (PRD §5.4 Pattern A),
// with undo/redo over the `robot` field via zundo's temporal middleware.
import { create } from "zustand";
import { temporal } from "zundo";
import type { Robot, Link, Joint, Material } from "../types/robot";
import type { SourceFile, FieldAnchor } from "../api/commands";
import { setXacroField } from "../api/commands";

interface OpenDocument {
  robot: Robot;
  computedUrdf: string;
  isXacro: boolean;
  workspaceRoot: string | null;
  sourceFiles: SourceFile[];
  anchors: FieldAnchor[];
}

interface RobotState {
  robot: Robot | null;
  filePath: string | null;
  dirty: boolean;

  /** Computed (xacro-expanded or original) URDF text for the Computed view. */
  computedUrdf: string | null;
  /** Whether the open document is a xacro (in-place Save is disabled). */
  isXacro: boolean;
  /** Detected colcon workspace root for the open document, if any. */
  workspaceRoot: string | null;
  /** Ordered xacro source files for the Source view (empty for plain URDF). */
  sourceFiles: SourceFile[];
  /** Writable field anchors for the open xacro document. */
  anchors: FieldAnchor[];

  setRobot: (robot: Robot, filePath?: string | null) => void;
  /** Load a full document result from `openDocument`. */
  setDocument: (doc: OpenDocument, filePath: string | null) => void;
  markSaved: (path: string) => void;

  /**
   * Whether `(kind, name, field)` may be edited. Always true for plain URDF;
   * for a xacro it requires a writable source anchor (per-parameter gating).
   */
  isEditable: (kind: string, name: string, field: string) => boolean;
  /**
   * Persist a field edit on a xacro doc back to its source literal/definition,
   * then apply the re-expanded document. No-op for plain URDF (use Save).
   */
  commitFieldToSource: (
    kind: string,
    name: string,
    field: string,
    valueString: string,
  ) => Promise<void>;

  /** Begin a continuous gesture (e.g. scrub): suspends undo history. */
  beginInteraction: () => void;
  /** End the gesture: records the whole change as ONE undo entry. */
  endInteraction: () => void;

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

let interactionSnapshot: Robot | null = null;

export const useRobotStore = create<RobotState>()(
  temporal(
    (set, get) => ({
      robot: null,
      filePath: null,
      dirty: false,
      computedUrdf: null,
      isXacro: false,
      workspaceRoot: null,
      sourceFiles: [],
      anchors: [],

      setRobot: (robot, filePath) => {
        set({
          robot,
          filePath: filePath ?? null,
          dirty: false,
          // A bare robot (new/empty doc) carries no xacro provenance.
          computedUrdf: null,
          isXacro: false,
          workspaceRoot: null,
          sourceFiles: [],
          anchors: [],
        });
        // Fresh document: discard any prior undo/redo history.
        useRobotStore.temporal.getState().clear();
      },

      setDocument: (doc, filePath) => {
        set({
          robot: doc.robot,
          filePath,
          dirty: false,
          computedUrdf: doc.computedUrdf,
          isXacro: doc.isXacro,
          workspaceRoot: doc.workspaceRoot,
          sourceFiles: doc.sourceFiles,
          anchors: doc.anchors,
        });
        useRobotStore.temporal.getState().clear();
      },

      markSaved: (path) => set({ filePath: path, dirty: false }),

      isEditable: (kind, name, field) => {
        const st = get();
        if (!st.isXacro) return true;
        return st.anchors.some(
          (a) => a.kind === kind && a.name === name && a.field === field,
        );
      },

      commitFieldToSource: async (kind, name, field, valueString) => {
        const st = get();
        if (!st.isXacro || !st.filePath) return;
        const anchor = st.anchors.find(
          (a) => a.kind === kind && a.name === name && a.field === field,
        );
        if (!anchor) return;
        const file = st.sourceFiles[anchor.fileIndex];
        if (!file) return;
        const doc = await setXacroField(
          st.filePath,
          file.path,
          anchor.valueStart,
          anchor.valueEnd,
          valueString,
        );
        get().setDocument(doc, st.filePath);
      },

      beginInteraction: () => {
        interactionSnapshot = get().robot;
        useRobotStore.temporal.getState().pause();
      },

      endInteraction: () => {
        const temporal = useRobotStore.temporal.getState();
        const final = get().robot;
        if (interactionSnapshot && final && interactionSnapshot !== final) {
          // Restore the pre-gesture state while still paused (unrecorded),
          // resume, then re-apply the final value as a single tracked change.
          set({ robot: interactionSnapshot });
          temporal.resume();
          set({ robot: final, dirty: true });
        } else {
          temporal.resume();
        }
        interactionSnapshot = null;
      },

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
