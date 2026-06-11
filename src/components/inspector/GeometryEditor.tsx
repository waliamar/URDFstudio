// src/components/inspector/GeometryEditor.tsx
import type { Geometry } from "../../types/robot";
import { NumberField } from "./fields/NumberField";
import { Vector3Field } from "./fields/Vector3Field";
import { SelectField } from "./fields/SelectField";

interface Props {
  value: Geometry;
  onChange: (geometry: Geometry) => void;
}

const GEOM_TYPES: Geometry["type"][] = ["box", "cylinder", "sphere", "mesh"];

/** Sensible defaults when switching geometry type. */
function defaultGeometry(type: Geometry["type"]): Geometry {
  switch (type) {
    case "box": return { type: "box", size: [0.1, 0.1, 0.1] };
    case "cylinder": return { type: "cylinder", radius: 0.05, length: 0.1 };
    case "sphere": return { type: "sphere", radius: 0.05 };
    case "mesh": return { type: "mesh", filename: "", scale: [1, 1, 1] };
  }
}

export function GeometryEditor({ value, onChange }: Props) {
  return (
    <>
      <SelectField
        label="shape"
        value={value.type}
        options={GEOM_TYPES}
        onChange={(t) => {
          if (t !== value.type) onChange(defaultGeometry(t as Geometry["type"]));
        }}
      />
      {value.type === "box" && (
        <Vector3Field
          label="size"
          value={value.size}
          onChange={(size) => onChange({ ...value, size })}
        />
      )}
      {value.type === "cylinder" && (
        <>
          <NumberField label="radius" value={value.radius} onChange={(radius) => onChange({ ...value, radius })} />
          <NumberField label="length" value={value.length} onChange={(length) => onChange({ ...value, length })} />
        </>
      )}
      {value.type === "sphere" && (
        <NumberField label="radius" value={value.radius} onChange={(radius) => onChange({ ...value, radius })} />
      )}
      {value.type === "mesh" && (
        <>
          <div className="field">
            <label>file</label>
            <input
              type="text"
              value={value.filename}
              placeholder="package://... or path"
              onChange={(e) => onChange({ ...value, filename: e.target.value })}
            />
          </div>
          <Vector3Field
            label="scale"
            value={value.scale}
            onChange={(scale) => onChange({ ...value, scale })}
          />
        </>
      )}
    </>
  );
}
