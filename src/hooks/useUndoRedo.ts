// src/hooks/useUndoRedo.ts
import { useEffect } from "react";
import { useRobotStore } from "../state/robotStore";

/** Wires Ctrl/Cmd+Z (undo), Ctrl/Cmd+Shift+Z and Ctrl+Y (redo). */
export function useUndoRedo() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      const temporal = useRobotStore.temporal.getState();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        temporal.undo();
      } else if ((key === "z" && e.shiftKey) || key === "y") {
        e.preventDefault();
        temporal.redo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}
