// src/types/validation.ts

export interface ValidationIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
  /** Name of the link or joint this issue refers to, if any. */
  target?: string;
}
