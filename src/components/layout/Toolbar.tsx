// src/components/layout/Toolbar.tsx
import { useStore } from "zustand";
import { useRobotStore } from "../../state/robotStore";
import { useUiStore, type Layers } from "../../state/uiStore";
import { useFileOps } from "../../hooks/useFileOps";

export function Toolbar() {
  const { doNew, doOpen, doSave, doSaveAs } = useFileOps();
  const hasRobot = useRobotStore((s) => s.robot !== null);

  // Subscribe to temporal store so undo/redo button disabled-state updates.
  const { pastStates, futureStates } = useStore(useRobotStore.temporal);
  const canUndo = pastStates.length > 0;
  const canRedo = futureStates.length > 0;

  const layers = useUiStore((s) => s.layers);
  const toggleLayer = useUiStore((s) => s.toggleLayer);
  const theme = useUiStore((s) => s.theme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);

  const layerBtn = (key: keyof Layers, label: string) => (
    <button
      className={layers[key] ? "active" : ""}
      onClick={() => toggleLayer(key)}
      title={`Toggle ${key} layer`}
    >
      {label}
    </button>
  );

  return (
    <div className="toolbar">
      <button onClick={doNew}>New</button>
      <button onClick={doOpen}>Open</button>
      <button onClick={doSave} disabled={!hasRobot}>Save</button>
      <button onClick={doSaveAs} disabled={!hasRobot}>Save As</button>
      <span className="sep" />
      <button onClick={() => useRobotStore.temporal.getState().undo()} disabled={!canUndo} title="Undo (Ctrl+Z)">↶ Undo</button>
      <button onClick={() => useRobotStore.temporal.getState().redo()} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">↷ Redo</button>
      <span className="sep" />
      {layerBtn("visual", "Visual")}
      {layerBtn("collision", "Collision")}
      {layerBtn("inertial", "Inertial")}
      <span className="spacer" />
      <button onClick={toggleTheme} title="Toggle theme">
        {theme === "dark" ? "☾ Dark" : "☀ Light"}
      </button>
    </div>
  );
}
