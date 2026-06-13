// src/components/viewport/TransformGizmo.tsx
import { useEffect, useState } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { TransformControls } from "@react-three/drei";
import { useSelectionStore } from "../../state/selectionStore";
import { useRobotStore } from "../../state/robotStore";
import { originFromLocal } from "../../lib/gizmo";

type Mode = "translate" | "rotate";

type Commit = (xyz: [number, number, number], rpy: [number, number, number]) => void;

/** Resolve which named scene group the gizmo drives and how to persist a drag. */
function useGizmoTarget(): { target: THREE.Object3D | null; commit: Commit | null } {
  const scene = useThree((s) => s.scene);
  const selected = useSelectionStore((s) => s.selected);
  const robot = useRobotStore((s) => s.robot);
  const [target, setTarget] = useState<THREE.Object3D | null>(null);

  let objectName: string | null = null;
  let commit: Commit | null = null;

  if (selected && robot) {
    if (selected.kind === "joint") {
      const joint = robot.joints.find((j) => j.name === selected.name);
      if (joint) {
        objectName = `link:${joint.child}`;
        commit = (xyz, rpy) =>
          useRobotStore.getState().updateJoint(joint.name, { origin: { xyz, rpy } });
      }
    } else {
      const parent = robot.joints.find((j) => j.child === selected.name);
      if (parent) {
        objectName = `link:${selected.name}`;
        commit = (xyz, rpy) =>
          useRobotStore.getState().updateJoint(parent.name, { origin: { xyz, rpy } });
      } else {
        const link = robot.links.find((l) => l.name === selected.name);
        if (link?.visual) {
          const visual = link.visual;
          objectName = `linkvisual:${selected.name}`;
          commit = (xyz, rpy) =>
            useRobotStore.getState().updateLink(selected.name, {
              visual: { ...visual, origin: { xyz, rpy } },
            });
        }
      }
    }
  }

  // Resolve the Object3D once the scene reflects the current selection/model.
  // During a drag, committing re-renders RobotModel but getObjectByName returns
  // the SAME Object3D instance, so setTarget is a no-op (no loop / no detach).
  useEffect(() => {
    setTarget(objectName ? scene.getObjectByName(objectName) ?? null : null);
  }, [scene, objectName, robot]);

  return { target, commit };
}

/** Unity-style transform gizmo on the selected link/joint. W=move, E=rotate,
 *  X=toggle local/world. Drags commit as one undo entry. */
export function TransformGizmo() {
  const { target, commit } = useGizmoTarget();
  const [mode, setMode] = useState<Mode>("translate");
  const [space, setSpace] = useState<"local" | "world">("local");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === "w" || e.key === "W") setMode("translate");
      else if (e.key === "e" || e.key === "E") setMode("rotate");
      else if (e.key === "x" || e.key === "X") setSpace((s) => (s === "local" ? "world" : "local"));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Safety net: if the gizmo unmounts mid-drag (selection cleared or the
  // dragged object deleted), close the interaction so the undo store doesn't
  // stay paused. endInteraction is a no-op when no drag is in progress.
  useEffect(() => {
    return () => { useRobotStore.getState().endInteraction(); };
  }, [target]);

  if (!target || !commit) return null;

  const onObjectChange = () => {
    const { xyz, rpy } = originFromLocal(target.position, target.rotation);
    commit(xyz, rpy);
  };

  return (
    <TransformControls
      object={target}
      mode={mode}
      space={space}
      onMouseDown={() => useRobotStore.getState().beginInteraction()}
      onMouseUp={() => useRobotStore.getState().endInteraction()}
      onObjectChange={onObjectChange}
    />
  );
}
