// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { useUiStore } from "./uiStore";

describe("uiStore panel layout", () => {
  beforeEach(() => {
    localStorage.clear();
    useUiStore.setState({
      layout: {
        treeW: 232, inspectorW: 296, bottomH: 180,
        treeCollapsed: false, inspectorCollapsed: false, bottomCollapsed: false,
      },
    });
  });

  it("setPanelSize clamps to the panel limits", () => {
    useUiStore.getState().setPanelSize("tree", 9999);
    expect(useUiStore.getState().layout.treeW).toBe(480); // tree max
    useUiStore.getState().setPanelSize("tree", 0);
    expect(useUiStore.getState().layout.treeW).toBe(160); // tree min
  });

  it("toggleCollapsed flips and restores the flag", () => {
    useUiStore.getState().toggleCollapsed("inspector");
    expect(useUiStore.getState().layout.inspectorCollapsed).toBe(true);
    useUiStore.getState().toggleCollapsed("inspector");
    expect(useUiStore.getState().layout.inspectorCollapsed).toBe(false);
  });

  it("persists layout to localStorage", () => {
    useUiStore.getState().setPanelSize("bottom", 200);
    expect(localStorage.getItem("urdf-studio:layout")).toContain("200");
  });
});
