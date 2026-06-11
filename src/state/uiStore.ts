// src/state/uiStore.ts
import { create } from "zustand";
import { clampSize, PANEL_LIMITS, type PanelKey } from "../lib/resize";

export type BottomTab = "problems" | "xml";

export interface Layers {
  visual: boolean;
  collision: boolean;
  inertial: boolean;
}

export interface PanelLayout {
  treeW: number;
  inspectorW: number;
  bottomH: number;
  treeCollapsed: boolean;
  inspectorCollapsed: boolean;
  bottomCollapsed: boolean;
}

interface UiState {
  layers: Layers;
  bottomTab: BottomTab;
  layout: PanelLayout;

  toggleLayer: (layer: keyof Layers) => void;
  setBottomTab: (tab: BottomTab) => void;
  setPanelSize: (panel: PanelKey, px: number) => void;
  toggleCollapsed: (panel: PanelKey) => void;
}

const LAYOUT_KEY = "urdf-studio:layout";

const DEFAULT_LAYOUT: PanelLayout = {
  treeW: 232,
  inspectorW: 296,
  bottomH: 180,
  treeCollapsed: false,
  inspectorCollapsed: false,
  bottomCollapsed: false,
};

function loadLayout(): PanelLayout {
  if (typeof localStorage === "undefined") return DEFAULT_LAYOUT;
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    if (!raw) return DEFAULT_LAYOUT;
    return { ...DEFAULT_LAYOUT, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_LAYOUT;
  }
}

function persistLayout(layout: PanelLayout): void {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
  }
}

const SIZE_FIELD: Record<PanelKey, keyof PanelLayout> = {
  tree: "treeW",
  inspector: "inspectorW",
  bottom: "bottomH",
};
const COLLAPSE_FIELD: Record<PanelKey, keyof PanelLayout> = {
  tree: "treeCollapsed",
  inspector: "inspectorCollapsed",
  bottom: "bottomCollapsed",
};

export const useUiStore = create<UiState>((set) => ({
  layers: { visual: true, collision: false, inertial: false },
  bottomTab: "problems",
  layout: loadLayout(),

  toggleLayer: (layer) =>
    set((s) => ({ layers: { ...s.layers, [layer]: !s.layers[layer] } })),

  setBottomTab: (tab) => set({ bottomTab: tab }),

  setPanelSize: (panel, px) =>
    set((s) => {
      const { min, max } = PANEL_LIMITS[panel];
      const layout = { ...s.layout, [SIZE_FIELD[panel]]: clampSize(px, 0, min, max) };
      persistLayout(layout);
      return { layout };
    }),

  toggleCollapsed: (panel) =>
    set((s) => {
      const field = COLLAPSE_FIELD[panel];
      const layout = { ...s.layout, [field]: !s.layout[field] };
      persistLayout(layout);
      return { layout };
    }),
}));
