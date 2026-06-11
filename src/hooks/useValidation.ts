// src/hooks/useValidation.ts
import { useEffect, useMemo } from "react";
import { useRobotStore } from "../state/robotStore";
import { useIssuesStore } from "../state/issuesStore";
import { validateRobot } from "../api/commands";
import { debounce } from "../lib/debounce";
import type { Robot } from "../types/robot";

/** Debounced (300ms) validation on robot change; writes to issuesStore. */
export function useValidation() {
  const robot = useRobotStore((s) => s.robot);
  const setIssues = useIssuesStore((s) => s.setIssues);

  const run = useMemo(
    () =>
      debounce((r: Robot) => {
        validateRobot(r).then(setIssues).catch(() => setIssues([]));
      }, 300),
    [setIssues],
  );

  useEffect(() => {
    if (!robot) {
      setIssues([]);
      return;
    }
    run(robot);
    return () => run.cancel();
  }, [robot, run, setIssues]);
}
