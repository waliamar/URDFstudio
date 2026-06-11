// src/state/uiStore.ts
import { create } from "zustand";

export type Theme = "dark" | "light";
export type BottomTab = "problems" | "xml";

export interface Layers {
  visual: boolean;
  collision: boolean;
  inertial: boolean;
}

interface UiState {
  theme: Theme;
  layers: Layers;
  bottomTab: BottomTab;

  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  toggleLayer: (layer: keyof Layers) => void;
  setBottomTab: (tab: BottomTab) => void;
}

const THEME_KEY = "urdf-studio:theme";

function loadTheme(): Theme {
  if (typeof localStorage === "undefined") return "dark";
  const stored = localStorage.getItem(THEME_KEY);
  return stored === "light" || stored === "dark" ? stored : "dark";
}

function persistTheme(theme: Theme): void {
  if (typeof localStorage !== "undefined") localStorage.setItem(THEME_KEY, theme);
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-theme", theme);
  }
}

export const useUiStore = create<UiState>((set) => ({
  theme: loadTheme(),
  layers: { visual: true, collision: false, inertial: false },
  bottomTab: "problems",

  toggleTheme: () =>
    set((s) => {
      const theme: Theme = s.theme === "dark" ? "light" : "dark";
      persistTheme(theme);
      return { theme };
    }),

  setTheme: (theme) => {
    persistTheme(theme);
    set({ theme });
  },

  toggleLayer: (layer) =>
    set((s) => ({ layers: { ...s.layers, [layer]: !s.layers[layer] } })),

  setBottomTab: (tab) => set({ bottomTab: tab }),
}));
