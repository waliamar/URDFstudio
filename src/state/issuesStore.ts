// src/state/issuesStore.ts
// Holds the latest validation results (produced by useValidation).
import { create } from "zustand";
import type { ValidationIssue } from "../types/validation";

interface IssuesState {
  issues: ValidationIssue[];
  setIssues: (issues: ValidationIssue[]) => void;
}

export const useIssuesStore = create<IssuesState>((set) => ({
  issues: [],
  setIssues: (issues) => set({ issues }),
}));
