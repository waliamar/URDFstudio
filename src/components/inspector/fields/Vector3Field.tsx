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
  /** Fired at a commit boundary with the full (post-commit) vector. */
  onCommit?: (value: Vec3) => void;
  /** Render the whole vector immutable. */
  disabled?: boolean;
}

export function Vector3Field({
  label,
  value,
  labels = ["X", "Y", "Z"],
  step,
  min,
  max,
  onChange,
  onCommit,
  disabled = false,
}: Props) {
  const set = (i: number, v: number) => {
    const next: Vec3 = [...value];
    next[i] = v;
    onChange(next);
  };
  const commit = (i: number, v: number) => {
    if (!onCommit) return;
    const next: Vec3 = [...value];
    next[i] = v;
    onCommit(next);
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
            onCommit={(n) => commit(i, n)}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  );
}
