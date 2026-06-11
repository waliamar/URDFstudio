// src/components/inspector/PoseEditor.tsx
import type { Pose } from "../../types/robot";
import { Vector3Field } from "./fields/Vector3Field";

interface Props {
  value: Pose;
  onChange: (pose: Pose) => void;
}

/** xyz (meters) + rpy (radians, URDF-native). */
export function PoseEditor({ value, onChange }: Props) {
  return (
    <>
      <Vector3Field
        label="xyz"
        value={value.xyz}
        onChange={(xyz) => onChange({ ...value, xyz })}
      />
      <Vector3Field
        label="rpy"
        labels={["r", "p", "y"]}
        value={value.rpy}
        onChange={(rpy) => onChange({ ...value, rpy })}
      />
    </>
  );
}
