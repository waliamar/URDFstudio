// src/hooks/useFileOps.ts
import { useCallback, useEffect } from "react";
import { useRobotStore } from "../state/robotStore";
import { useSelectionStore } from "../state/selectionStore";
import { openUrdf, saveUrdf, newRobot } from "../api/commands";
import { openUrdfDialog, saveUrdfDialog } from "../api/dialog";

export function useFileOps() {
  const setRobot = useRobotStore((s) => s.setRobot);
  const markSaved = useRobotStore((s) => s.markSaved);
  const clearSelection = useSelectionStore((s) => s.clear);

  const doNew = useCallback(async () => {
    const name = window.prompt("New robot name:", "robot");
    if (name === null) return;
    const robot = await newRobot(name || "robot");
    setRobot(robot, null);
    clearSelection();
  }, [setRobot, clearSelection]);

  const doOpen = useCallback(async () => {
    const path = await openUrdfDialog();
    // In browser mode the dialog returns null; still load the mock sample.
    const robot = await openUrdf(path ?? "");
    setRobot(robot, path);
    clearSelection();
  }, [setRobot, clearSelection]);

  const doSaveAs = useCallback(async () => {
    const { robot, filePath } = useRobotStore.getState();
    if (!robot) return;
    const path = await saveUrdfDialog(filePath ?? undefined);
    if (!path) return;
    await saveUrdf(path, robot);
    markSaved(path);
  }, [markSaved]);

  const doSave = useCallback(async () => {
    const { robot, filePath } = useRobotStore.getState();
    if (!robot) return;
    if (!filePath) return doSaveAs();
    await saveUrdf(filePath, robot);
    markSaved(filePath);
  }, [markSaved, doSaveAs]);

  // Warn on close when there are unsaved changes (works in Tauri webview too).
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (useRobotStore.getState().dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  return { doNew, doOpen, doSave, doSaveAs };
}
