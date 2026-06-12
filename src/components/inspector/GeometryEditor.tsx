// src/components/inspector/GeometryEditor.tsx
import type { Geometry } from "../../types/robot";
import { NumberField } from "./fields/NumberField";
import { Vector3Field } from "./fields/Vector3Field";
import { SelectField } from "./fields/SelectField";
import type { FieldGate } from "./useFieldGate";

interface Props {
  value: Geometry;
  onChange: (geometry: Geometry) => void;
  gate?: FieldGate;
  /** Geometry context for field paths: "visual" or "collision". */
  base?: "visual" | "collision";
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

export function GeometryEditor({ value, onChange, gate, base = "visual" }: Props) {
  // Primitive dims have no source anchor yet ⇒ gated read-only on xacro docs.
  const primitiveDisabled = gate?.disabled(`${base}.geometry`);
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
          disabled={primitiveDisabled}
        />
      )}
      {value.type === "cylinder" && (
        <>
          <NumberField label="radius" value={value.radius} onChange={(radius) => onChange({ ...value, radius })} disabled={primitiveDisabled} />
          <NumberField label="length" value={value.length} onChange={(length) => onChange({ ...value, length })} disabled={primitiveDisabled} />
        </>
      )}
      {value.type === "sphere" && (
        <NumberField label="radius" value={value.radius} onChange={(radius) => onChange({ ...value, radius })} disabled={primitiveDisabled} />
      )}
      {value.type === "mesh" && (
        <>
          <div className="field">
            <label>file</label>
            <input
              type="text"
              value={value.filename}
              placeholder="package://... or path"
              disabled={gate?.disabled(`${base}.mesh.filename`)}
              onChange={(e) => onChange({ ...value, filename: e.target.value })}
              onBlur={(e) => gate?.commitStr(`${base}.mesh.filename`, e.target.value)}
            />
          </div>
          <Vector3Field
            label="scale"
            value={value.scale}
            onChange={(scale) => onChange({ ...value, scale })}
            disabled={gate?.disabled(`${base}.mesh.scale`)}
            onCommit={(scale) => gate?.commitVec(`${base}.mesh.scale`, scale)}
          />
        </>
      )}
    </>
  );
}
