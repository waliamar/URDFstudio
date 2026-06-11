// src/state/selectionStore.ts
import { create } from "zustand";

export type SelectionKind = "link" | "joint";

export interface Selection {
  kind: SelectionKind;
  name: string;
}

interface SelectionState {
  selected: Selection | null;
  select: (kind: SelectionKind, name: string) => void;
  clear: () => void;
}

export const useSelectionStore = create<SelectionState>((set) => ({
  selected: null,
  select: (kind, name) => set({ selected: { kind, name } }),
  clear: () => set({ selected: null }),
}));
