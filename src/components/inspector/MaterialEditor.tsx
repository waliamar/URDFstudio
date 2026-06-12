// src/components/inspector/MaterialEditor.tsx
import { RgbaColorPicker } from "react-colorful";
import type { Material } from "../../types/robot";
import { useRobotStore } from "../../state/robotStore";
import { SelectField } from "./fields/SelectField";
import { useFieldGate } from "./useFieldGate";

interface Props {
  /** Currently assigned material name on the visual (undefined = none). */
  value: string | undefined;
  onChange: (materialName: string | undefined) => void;
}

const NONE = "(none)";
const CREATE = "(new material…)";

// react-colorful uses 0-255 rgb + 0-1 alpha; URDF uses 0-1 floats.
function toPicker(c: [number, number, number, number]) {
  return { r: Math.round(c[0] * 255), g: Math.round(c[1] * 255), b: Math.round(c[2] * 255), a: c[3] };
}
function toUrdf(p: { r: number; g: number; b: number; a: number }): [number, number, number, number] {
  return [p.r / 255, p.g / 255, p.b / 255, p.a];
}

export function MaterialEditor({ value, onChange }: Props) {
  const materials = useRobotStore((s) => s.robot?.materials ?? []);
  const upsertMaterial = useRobotStore((s) => s.upsertMaterial);
  const gate = useFieldGate("material", value ?? "");

  const current: Material | undefined = materials.find((m) => m.name === value);
  const color = current?.color ?? [0.6, 0.6, 0.6, 1];
  const colorLocked = gate.disabled("color");

  const handleSelect = (selected: string) => {
    if (selected === NONE) return onChange(undefined);
    if (selected === CREATE) {
      const name = window.prompt("New material name:");
      if (!name) return;
      upsertMaterial({ name, color: [0.6, 0.6, 0.6, 1] });
      return onChange(name);
    }
    onChange(selected);
  };

  return (
    <div className="material-editor">
      <SelectField
        label="material"
        value={value ?? NONE}
        options={[NONE, ...materials.map((m) => m.name), CREATE]}
        onChange={handleSelect}
      />
      {current && colorLocked && (
        <div
          className="color-swatch-readonly"
          style={{
            background: `rgba(${Math.round(color[0] * 255)}, ${Math.round(color[1] * 255)}, ${Math.round(color[2] * 255)}, ${color[3]})`,
          }}
          title="Color is macro-derived (read-only)"
        />
      )}
      {current && !colorLocked && (
        <div
          // Commit the spliced color back to source on release (not per-frame).
          onPointerUp={() => {
            const c = current.color ?? color;
            gate.commitVec("color", c);
          }}
        >
          <RgbaColorPicker
            color={toPicker(color)}
            onChange={(p) => upsertMaterial({ ...current, color: toUrdf(p) })}
          />
        </div>
      )}
    </div>
  );
}
