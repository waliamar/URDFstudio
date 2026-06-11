// src/components/inspector/fields/Vector3Field.tsx
import { NumberField } from "./NumberField";

type Vec3 = [number, number, number];

interface Props {
  label?: string;
  value: Vec3;
  labels?: [string, string, string];
  step?: number;
  min?: number;
  max?: number;
  onChange: (value: Vec3) => void;
}

export function Vector3Field({
  label,
  value,
  labels = ["X", "Y", "Z"],
  step,
  min,
  max,
  onChange,
}: Props) {
  const set = (i: number, v: number) => {
    const next: Vec3 = [...value];
    next[i] = v;
    onChange(next);
  };
  return (
    <div className="field">
      {label !== undefined && <label>{label}</label>}
      <div className="vec">
        {value.map((v, i) => (
          <NumberField
            key={i}
            label={labels[i]}
            value={v}
            step={step}
            min={min}
            max={max}
            onChange={(n) => set(i, n)}
          />
        ))}
      </div>
    </div>
  );
}
