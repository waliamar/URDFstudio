// src/App.tsx
import { useEffect } from "react";
import { Toolbar } from "./components/layout/Toolbar";
import { StatusBar } from "./components/layout/StatusBar";
import { RobotTree } from "./components/tree/RobotTree";
import { Viewport } from "./components/viewport/Viewport";
import { Inspector } from "./components/inspector/Inspector";
import { XmlPreview } from "./components/xml/XmlPreview";
import { ProblemsPanel } from "./components/problems/ProblemsPanel";
import { useSelectionStore } from "./state/selectionStore";
import { useUiStore } from "./state/uiStore";
import { useIssuesStore } from "./state/issuesStore";
import { useUndoRedo } from "./hooks/useUndoRedo";
import { useValidation } from "./hooks/useValidation";

export default function App() {
  const selected = useSelectionStore((s) => s.selected);
  const theme = useUiStore((s) => s.theme);
  const bottomTab = useUiStore((s) => s.bottomTab);
  const setBottomTab = useUiStore((s) => s.setBottomTab);
  const issueCount = useIssuesStore((s) => s.issues.length);

  useUndoRedo();
  useValidation();

  // Apply theme to <html> on mount + change.
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return (
    <div className={`app-shell${selected ? "" : " no-inspector"}`}>
      <Toolbar />

      <div className="tree-panel">
        <RobotTree />
      </div>

      <div className="viewport-panel">
        <Viewport />
      </div>

      {selected && (
        <div className="inspector-panel">
          <Inspector />
        </div>
      )}

      <div className="bottom-panel">
        <div className="tab-bar">
          <button
            className={bottomTab === "problems" ? "active" : ""}
            onClick={() => setBottomTab("problems")}
          >
            Problems{issueCount > 0 ? ` (${issueCount})` : ""}
          </button>
          <button
            className={bottomTab === "xml" ? "active" : ""}
            onClick={() => setBottomTab("xml")}
          >
            XML Preview
          </button>
        </div>
        <div className="tab-content">
          {bottomTab === "problems" ? <ProblemsPanel /> : <XmlPreview />}
        </div>
      </div>

      <StatusBar />
    </div>
  );
}
