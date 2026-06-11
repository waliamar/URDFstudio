// src/components/problems/ProblemsPanel.tsx
import { useIssuesStore } from "../../state/issuesStore";
import { useRobotStore } from "../../state/robotStore";
import { useSelectionStore } from "../../state/selectionStore";

export function ProblemsPanel() {
  const issues = useIssuesStore((s) => s.issues);
  const robot = useRobotStore((s) => s.robot);
  const select = useSelectionStore((s) => s.select);

  const navigate = (target?: string) => {
    if (!target || !robot) return;
    if (robot.links.some((l) => l.name === target)) select("link", target);
    else if (robot.joints.some((j) => j.name === target)) select("joint", target);
  };

  if (issues.length === 0) {
    return <div className="panel-empty">No problems detected.</div>;
  }

  return (
    <div>
      {issues.map((issue, i) => (
        <div
          key={i}
          className="problem-row"
          onClick={() => navigate(issue.target)}
          title={issue.code}
        >
          <span className={`sev ${issue.severity}`}>
            {issue.severity === "error" ? "✖" : "⚠"}
          </span>
          <span className="msg">{issue.message}</span>
          {issue.target && <span className="target">{issue.target}</span>}
        </div>
      ))}
    </div>
  );
}
