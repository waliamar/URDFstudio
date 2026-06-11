// src/components/layout/StatusBar.tsx
import { useRobotStore } from "../../state/robotStore";
import { useIssuesStore } from "../../state/issuesStore";

export function StatusBar() {
  const robot = useRobotStore((s) => s.robot);
  const filePath = useRobotStore((s) => s.filePath);
  const dirty = useRobotStore((s) => s.dirty);
  const issues = useIssuesStore((s) => s.issues);

  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.length - errors;

  return (
    <div className="status-bar">
      {dirty && <span className="dirty-dot" title="Unsaved changes">●</span>}
      <span>{filePath ?? "(unsaved)"}</span>
      {robot && (
        <>
          <span>•</span>
          <span>{robot.links.length} links</span>
          <span>•</span>
          <span>{robot.joints.length} joints</span>
          <span>•</span>
          <span>
            {issues.length === 0
              ? "no issues"
              : `${errors} error${errors === 1 ? "" : "s"}, ${warnings} warning${warnings === 1 ? "" : "s"}`}
          </span>
        </>
      )}
    </div>
  );
}
