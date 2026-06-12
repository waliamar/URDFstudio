// src/components/inspector/JointForm.tsx
import type { Joint, JointType, JointLimit } from "../../types/robot";
import { useRobotStore } from "../../state/robotStore";
import { useSelectionStore } from "../../state/selectionStore";
import { PoseEditor } from "./PoseEditor";
import { NumberField } from "./fields/NumberField";
import { Vector3Field } from "./fields/Vector3Field";
import { SelectField } from "./fields/SelectField";
import { useFieldGate } from "./useFieldGate";

const JOINT_TYPES: JointType[] = [
  "fixed", "revolute", "continuous", "prismatic", "planar", "floating",
];

const defaultLimit: JointLimit = { lower: -1.57, upper: 1.57, effort: 10, velocity: 1 };

export function JointForm({ joint }: { joint: Joint }) {
  const updateJoint = useRobotStore((s) => s.updateJoint);
  const renameJoint = useRobotStore((s) => s.renameJoint);
  const linkNames = useRobotStore((s) => s.robot?.links.map((l) => l.name) ?? []);
  const select = useSelectionStore((s) => s.select);
  const gate = useFieldGate("joint", joint.name);

  const patch = (p: Partial<Joint>) => updateJoint(joint.name, p);

  const needsAxis = joint.jointType !== "fixed" && joint.jointType !== "floating";
  const needsLimit = joint.jointType === "revolute" || joint.jointType === "prismatic";

  return (
    <div className="inspector">
      <h2>Joint</h2>
      <div className="field">
        <label>name</label>
        <input
          type="text"
          defaultValue={joint.name}
          key={joint.name}
          onBlur={(e) => {
            const next = e.target.value.trim();
            if (next && next !== joint.name) {
              renameJoint(joint.name, next);
              select("joint", next);
            }
          }}
        />
      </div>

      <SelectField
        label="type"
        value={joint.jointType}
        options={JOINT_TYPES}
        onChange={(jointType) => {
          const next: Partial<Joint> = { jointType: jointType as JointType };
          // Ensure axis/limit exist when the new type requires them.
          if (jointType !== "fixed" && jointType !== "floating" && !joint.axis) next.axis = [0, 0, 1];
          if ((jointType === "revolute" || jointType === "prismatic") && !joint.limit) next.limit = defaultLimit;
          patch(next);
        }}
      />
      <SelectField label="parent" value={joint.parent} options={linkNames} onChange={(parent) => patch({ parent })} />
      <SelectField label="child" value={joint.child} options={linkNames} onChange={(child) => patch({ child })} />

      <div className="field-row-label">origin</div>
      <PoseEditor value={joint.origin} onChange={(origin) => patch({ origin })} gate={gate} base="origin" />

      {needsAxis && (
        <>
          <div className="field-row-label">axis</div>
          <Vector3Field
            value={joint.axis ?? [0, 0, 1]}
            onChange={(axis) => patch({ axis })}
            disabled={gate.disabled("axis")}
            onCommit={(axis) => gate.commitVec("axis", axis)}
          />
        </>
      )}

      {needsLimit && (
        <>
          <div className="field-row-label">limit</div>
          {(["lower", "upper", "effort", "velocity"] as (keyof JointLimit)[]).map((k) => (
            <NumberField
              key={k}
              label={k}
              value={(joint.limit ?? defaultLimit)[k]}
              onChange={(n) => patch({ limit: { ...(joint.limit ?? defaultLimit), [k]: n } })}
              disabled={gate.disabled(`limit.${k}`)}
              onCommit={(n) => gate.commitNum(`limit.${k}`, n)}
            />
          ))}
        </>
      )}
    </div>
  );
}
