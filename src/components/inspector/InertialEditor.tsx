// src/components/inspector/InertialEditor.tsx
import type { Inertial, InertiaTensor } from "../../types/robot";
import { NumberField } from "./fields/NumberField";
import { PoseEditor } from "./PoseEditor";
import type { FieldGate } from "./useFieldGate";

interface Props {
  value: Inertial;
  onChange: (inertial: Inertial) => void;
  gate?: FieldGate;
}

const TENSOR_KEYS: (keyof InertiaTensor)[] = [
  "ixx", "ixy", "ixz", "iyy", "iyz", "izz",
];

export function InertialEditor({ value, onChange, gate }: Props) {
  const setTensor = (key: keyof InertiaTensor, n: number) =>
    onChange({ ...value, inertia: { ...value.inertia, [key]: n } });

  return (
    <>
      <NumberField
        label="mass"
        value={value.mass}
        onChange={(mass) => onChange({ ...value, mass })}
        disabled={gate?.disabled("inertial.mass")}
        onCommit={(n) => gate?.commitNum("inertial.mass", n)}
      />
      <div className="field-row-label">inertia tensor</div>
      {TENSOR_KEYS.map((k) => (
        <NumberField
          key={k}
          label={k}
          step={0.001}
          value={value.inertia[k]}
          onChange={(n) => setTensor(k, n)}
          disabled={gate?.disabled(`inertial.${k}`)}
          onCommit={(n) => gate?.commitNum(`inertial.${k}`, n)}
        />
      ))}
      <div className="field-row-label">com origin</div>
      <PoseEditor
        value={value.origin}
        onChange={(origin) => onChange({ ...value, origin })}
        gate={gate}
        base="inertial.origin"
      />
    </>
  );
}
