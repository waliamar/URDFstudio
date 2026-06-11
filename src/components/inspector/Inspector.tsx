// src/components/inspector/Inspector.tsx
import { useRobotStore } from "../../state/robotStore";
import { useSelectionStore } from "../../state/selectionStore";
import { LinkForm } from "./LinkForm";
import { JointForm } from "./JointForm";

export function Inspector() {
  const selected = useSelectionStore((s) => s.selected);
  const robot = useRobotStore((s) => s.robot);

  if (!selected || !robot) {
    return <div className="panel-empty">Select a link or joint to edit its properties.</div>;
  }

  if (selected.kind === "link") {
    const link = robot.links.find((l) => l.name === selected.name);
    return link ? <LinkForm link={link} /> : null;
  }
  const joint = robot.joints.find((j) => j.name === selected.name);
  return joint ? <JointForm joint={joint} /> : null;
}
