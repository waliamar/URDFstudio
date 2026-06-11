// src/components/tree/RobotTree.tsx
import { useRobotStore } from "../../state/robotStore";
import { useSelectionStore } from "../../state/selectionStore";
import { buildTree, type LinkNode } from "../../lib/kinematics";
import type { Link, Joint } from "../../types/robot";

const zeroPose = { xyz: [0, 0, 0] as [number, number, number], rpy: [0, 0, 0] as [number, number, number] };

function uniqueName(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  let i = 1;
  while (taken.has(`${base}_${i}`)) i++;
  return `${base}_${i}`;
}

export function RobotTree() {
  const robot = useRobotStore((s) => s.robot);
  if (!robot) return <div className="tree-empty">No robot loaded.</div>;

  const { roots } = buildTree(robot);
  return (
    <div style={{ padding: "4px 0" }}>
      {roots.length === 0 && <div className="tree-empty">No links.</div>}
      {roots.map((node) => (
        <LinkRow key={node.link.name} node={node} />
      ))}
    </div>
  );
}

function LinkRow({ node }: { node: LinkNode }) {
  const robot = useRobotStore((s) => s.robot)!;
  const addLink = useRobotStore((s) => s.addLink);
  const addJoint = useRobotStore((s) => s.addJoint);
  const deleteLink = useRobotStore((s) => s.deleteLink);
  const jointsReferencing = useRobotStore((s) => s.jointsReferencing);
  const selected = useSelectionStore((s) => s.selected);
  const select = useSelectionStore((s) => s.select);
  const clear = useSelectionStore((s) => s.clear);

  const link = node.link;
  const isSelected = selected?.kind === "link" && selected.name === link.name;

  const addChild = () => {
    const linkNames = new Set(robot.links.map((l) => l.name));
    const jointNames = new Set(robot.joints.map((j) => j.name));
    const childName = uniqueName(`${link.name}_child`, linkNames);
    const jointName = uniqueName(`${link.name}_joint`, jointNames);
    const newLink: Link = { name: childName };
    const newJoint: Joint = {
      name: jointName,
      jointType: "fixed",
      parent: link.name,
      child: childName,
      origin: zeroPose,
    };
    addLink(newLink);
    addJoint(newJoint);
    select("link", childName);
  };

  const removeLink = () => {
    const affected = jointsReferencing(link.name);
    const msg =
      affected.length > 0
        ? `Delete link "${link.name}"?\nThis also removes ${affected.length} joint(s): ${affected.join(", ")}`
        : `Delete link "${link.name}"?`;
    if (!window.confirm(msg)) return;
    deleteLink(link.name);
    if (isSelected) clear();
  };

  return (
    <div className="tree-children-wrap">
      <div
        className={`tree-row link${isSelected ? " selected" : ""}`}
        onClick={() => select("link", link.name)}
      >
        <span className="icon">◻</span>
        <span className="label">{link.name}</span>
        <button className="node-btn" title="Add child link + joint" onClick={(e) => { e.stopPropagation(); addChild(); }}>+</button>
        <button className="node-btn" title="Delete link" onClick={(e) => { e.stopPropagation(); removeLink(); }}>×</button>
      </div>
      {node.children.length > 0 && (
        <div className="tree-children">
          {node.children.map((c) => (
            <JointRow key={c.joint.name} joint={c.joint} childNode={c.node} />
          ))}
        </div>
      )}
    </div>
  );
}

function JointRow({ joint, childNode }: { joint: Joint; childNode: LinkNode }) {
  const deleteJoint = useRobotStore((s) => s.deleteJoint);
  const selected = useSelectionStore((s) => s.selected);
  const select = useSelectionStore((s) => s.select);
  const clear = useSelectionStore((s) => s.clear);

  const isSelected = selected?.kind === "joint" && selected.name === joint.name;

  const removeJoint = () => {
    if (!window.confirm(`Delete joint "${joint.name}"?`)) return;
    deleteJoint(joint.name);
    if (isSelected) clear();
  };

  return (
    <div className="tree-children-wrap">
      <div
        className={`tree-row joint${isSelected ? " selected" : ""}`}
        onClick={() => select("joint", joint.name)}
      >
        <span className="icon">↳</span>
        <span className="label">{joint.name} <span style={{ opacity: 0.6 }}>({joint.jointType})</span></span>
        <button className="node-btn" title="Delete joint" onClick={(e) => { e.stopPropagation(); removeJoint(); }}>×</button>
      </div>
      <div className="tree-children">
        <LinkRow node={childNode} />
      </div>
    </div>
  );
}
