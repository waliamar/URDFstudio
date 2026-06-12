// src/components/inspector/PoseEditor.tsx
import type { Pose } from "../../types/robot";
import { Vector3Field } from "./fields/Vector3Field";
import type { FieldGate } from "./useFieldGate";

interface Props {
  value: Pose;
  onChange: (pose: Pose) => void;
  /** Optional source-write gate (xacro docs). */
  gate?: FieldGate;
  /** Field path base for gating/commit, e.g. "origin", "inertial.origin". */
  base?: string;
}

/** xyz (meters) + rpy (radians, URDF-native). */
export function PoseEditor({ value, onChange, gate, base = "origin" }: Props) {
  return (
    <>
      <Vector3Field
        label="xyz"
        value={value.xyz}
        onChange={(xyz) => onChange({ ...value, xyz })}
        disabled={gate?.disabled(`${base}.xyz`)}
        onCommit={(xyz) => gate?.commitVec(`${base}.xyz`, xyz)}
      />
      <Vector3Field
        label="rpy"
        labels={["r", "p", "y"]}
        value={value.rpy}
        onChange={(rpy) => onChange({ ...value, rpy })}
        disabled={gate?.disabled(`${base}.rpy`)}
        onCommit={(rpy) => gate?.commitVec(`${base}.rpy`, rpy)}
      />
    </>
  );
}
