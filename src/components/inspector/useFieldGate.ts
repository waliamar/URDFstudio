// src/components/inspector/useFieldGate.ts
// Per-parameter edit gating + source write-back for the inspector.
//
// For a plain URDF every field is editable and writes flow through the normal
// in-memory model + Save. For a xacro, a field is editable only when it has a
// writable source anchor; commits are spliced back into the source file.
import { useRobotStore } from "../../state/robotStore";

export interface FieldGate {
  /** True when `field` must be rendered immutable (xacro, no anchor). */
  disabled: (field: string) => boolean;
  /** Commit a vector field's value (space-joined) back to source. */
  commitVec: (field: string, value: number[]) => void;
  /** Commit a scalar field's value back to source. */
  commitNum: (field: string, value: number) => void;
  /** Commit a raw string field (e.g. mesh filename) back to source. */
  commitStr: (field: string, value: string) => void;
}

export function useFieldGate(kind: string, name: string): FieldGate {
  const isXacro = useRobotStore((s) => s.isXacro);
  const anchors = useRobotStore((s) => s.anchors);
  const commit = useRobotStore((s) => s.commitFieldToSource);

  const hasAnchor = (field: string) =>
    anchors.some((a) => a.kind === kind && a.name === name && a.field === field);

  return {
    disabled: (field) => isXacro && !hasAnchor(field),
    commitVec: (field, value) => {
      if (isXacro && hasAnchor(field)) void commit(kind, name, field, value.join(" "));
    },
    commitNum: (field, value) => {
      if (isXacro && hasAnchor(field)) void commit(kind, name, field, String(value));
    },
    commitStr: (field, value) => {
      if (isXacro && hasAnchor(field)) void commit(kind, name, field, value);
    },
  };
}
