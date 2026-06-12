// src/hooks/useFileOps.ts
import { useCallback, useEffect } from "react";
import { useRobotStore } from "../state/robotStore";
import { useSelectionStore } from "../state/selectionStore";
import { openDocument, saveUrdf, newRobot } from "../api/commands";
import { openUrdfDialog, saveUrdfDialog } from "../api/dialog";

export function useFileOps() {
  const setRobot = useRobotStore((s) => s.setRobot);
  const setDocument = useRobotStore((s) => s.setDocument);
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
    const doc = await openDocument(path ?? "");
    setDocument(doc, path);
    clearSelection();
  }, [setDocument, clearSelection]);

  // Save the computed URDF to a new file (the only Save offered for xacro docs,
  // which must never be overwritten with flattened URDF).
  const doExportComputed = useCallback(async () => {
    const { robot, filePath } = useRobotStore.getState();
    if (!robot) return;
    const path = await saveUrdfDialog(filePath ?? undefined);
    if (!path) return;
    await saveUrdf(path, robot);
  }, []);

  const doSaveAs = useCallback(async () => {
    const { robot, filePath, isXacro } = useRobotStore.getState();
    if (!robot) return;
    if (isXacro) return doExportComputed();
    const path = await saveUrdfDialog(filePath ?? undefined);
    if (!path) return;
    await saveUrdf(path, robot);
    markSaved(path);
  }, [markSaved, doExportComputed]);

  const doSave = useCallback(async () => {
    const { robot, filePath, isXacro } = useRobotStore.getState();
    if (!robot) return;
    // Phase 1: never overwrite a .xacro with flattened URDF. Offer export.
    if (isXacro) return doExportComputed();
    if (!filePath) return doSaveAs();
    await saveUrdf(filePath, robot);
    markSaved(filePath);
  }, [markSaved, doSaveAs, doExportComputed]);

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

  return { doNew, doOpen, doSave, doSaveAs, doExportComputed };
}
