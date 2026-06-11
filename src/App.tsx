// src/App.tsx
import { Toolbar } from "./components/layout/Toolbar";
import { StatusBar } from "./components/layout/StatusBar";
import { ResizeHandle } from "./components/layout/ResizeHandle";
import { RobotTree } from "./components/tree/RobotTree";
import { Viewport } from "./components/viewport/Viewport";
import { Inspector } from "./components/inspector/Inspector";
import { XmlPreview } from "./components/xml/XmlPreview";
import { ProblemsPanel } from "./components/problems/ProblemsPanel";
import { useUiStore } from "./state/uiStore";
import { useIssuesStore } from "./state/issuesStore";
import { useUndoRedo } from "./hooks/useUndoRedo";
import { useValidation } from "./hooks/useValidation";

export default function App() {
  const bottomTab = useUiStore((s) => s.bottomTab);
  const setBottomTab = useUiStore((s) => s.setBottomTab);
  const layout = useUiStore((s) => s.layout);
  const issueCount = useIssuesStore((s) => s.issues.length);

  useUndoRedo();
  useValidation();

  return (
    <div className="app-shell">
      <Toolbar />

      <div className="app-mid">
        <div
          className="tree-panel glass"
          style={{ flexBasis: layout.treeCollapsed ? 0 : layout.treeW, display: layout.treeCollapsed ? "none" : undefined }}
        >
          <RobotTree />
        </div>
        <ResizeHandle panel="tree" orientation="vertical" direction={1} />

        <div className="viewport-panel glass">
          <Viewport />
        </div>

        <ResizeHandle panel="inspector" orientation="vertical" direction={-1} />
        <div
          className="inspector-panel glass"
          style={{ flexBasis: layout.inspectorCollapsed ? 0 : layout.inspectorW, display: layout.inspectorCollapsed ? "none" : undefined }}
        >
          <Inspector />
        </div>
      </div>

      <ResizeHandle panel="bottom" orientation="horizontal" direction={-1} />
      <div
        className="bottom-panel glass"
        style={{ height: layout.bottomCollapsed ? undefined : layout.bottomH }}
      >
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
        {!layout.bottomCollapsed && (
          <div className="tab-content">
            {bottomTab === "problems" ? <ProblemsPanel /> : <XmlPreview />}
          </div>
        )}
      </div>

      <StatusBar />
    </div>
  );
}
