// src/components/inspector/LinkForm.tsx
import type { Link, Visual, Collision, Inertial } from "../../types/robot";
import { useRobotStore } from "../../state/robotStore";
import { useSelectionStore } from "../../state/selectionStore";
import { Section } from "./Section";
import { PoseEditor } from "./PoseEditor";
import { GeometryEditor } from "./GeometryEditor";
import { InertialEditor } from "./InertialEditor";
import { MaterialEditor } from "./MaterialEditor";

const zeroPose = { xyz: [0, 0, 0] as [number, number, number], rpy: [0, 0, 0] as [number, number, number] };

const defaultVisual: Visual = { origin: zeroPose, geometry: { type: "box", size: [0.1, 0.1, 0.1] } };
const defaultCollision: Collision = { origin: zeroPose, geometry: { type: "box", size: [0.1, 0.1, 0.1] } };
const defaultInertial: Inertial = {
  origin: zeroPose,
  mass: 1,
  inertia: { ixx: 0.001, ixy: 0, ixz: 0, iyy: 0.001, iyz: 0, izz: 0.001 },
};

export function LinkForm({ link }: { link: Link }) {
  const updateLink = useRobotStore((s) => s.updateLink);
  const renameLink = useRobotStore((s) => s.renameLink);
  const select = useSelectionStore((s) => s.select);

  const patch = (p: Partial<Link>) => updateLink(link.name, p);

  return (
    <div className="inspector">
      <h2>Link</h2>
      <div className="field">
        <label>name</label>
        <input
          type="text"
          defaultValue={link.name}
          key={link.name}
          onBlur={(e) => {
            const next = e.target.value.trim();
            if (next && next !== link.name) {
              renameLink(link.name, next);
              select("link", next);
            }
          }}
        />
      </div>

      <Section
        title="Visual"
        present={!!link.visual}
        onTogglePresent={() => patch({ visual: link.visual ? undefined : defaultVisual })}
      >
        {link.visual && (
          <>
            <PoseEditor value={link.visual.origin} onChange={(origin) => patch({ visual: { ...link.visual!, origin } })} />
            <div className="field-row-label">geometry</div>
            <GeometryEditor value={link.visual.geometry} onChange={(geometry) => patch({ visual: { ...link.visual!, geometry } })} />
            <div className="field-row-label">material</div>
            <MaterialEditor
              value={link.visual.materialName}
              onChange={(materialName) => patch({ visual: { ...link.visual!, materialName } })}
            />
          </>
        )}
      </Section>

      <Section
        title="Collision"
        defaultOpen={false}
        present={!!link.collision}
        onTogglePresent={() => patch({ collision: link.collision ? undefined : defaultCollision })}
      >
        {link.collision && (
          <>
            <PoseEditor value={link.collision.origin} onChange={(origin) => patch({ collision: { ...link.collision!, origin } })} />
            <div className="field-row-label">geometry</div>
            <GeometryEditor value={link.collision.geometry} onChange={(geometry) => patch({ collision: { ...link.collision!, geometry } })} />
          </>
        )}
      </Section>

      <Section
        title="Inertial"
        defaultOpen={false}
        present={!!link.inertial}
        onTogglePresent={() => patch({ inertial: link.inertial ? undefined : defaultInertial })}
      >
        {link.inertial && (
          <InertialEditor value={link.inertial} onChange={(inertial) => patch({ inertial })} />
        )}
      </Section>
    </div>
  );
}
