// src/api/commands.ts
// Typed wrappers around the Tauri IPC command surface (PRD §7.3).
// When not running inside a Tauri webview (e.g. plain `vite dev` in a browser)
// every call is delegated to the mock implementation so the UI still works.
import { invoke } from "@tauri-apps/api/core";
import type { Robot } from "../types/robot";
import type { ValidationIssue } from "../types/validation";
import * as mock from "./mock";

const isTauri = (): boolean => "__TAURI_INTERNALS__" in window;

/** A xacro source file in the assembled include tree (mirrors `SourceFile`). */
export interface SourceFile {
  /** Absolute resolved path on disk. */
  path: string;
  /** Display label: raw include string, or workspace-relative path for root. */
  label: string;
  /** Full file contents. */
  text: string;
  /** Whether edits to this file are permitted (write-back). */
  editable: boolean;
}

/** A writable field anchor (mirrors `FieldAnchor`). */
export interface FieldAnchor {
  /** Element kind: "joint" | "link" | "material". */
  kind: string;
  /** Element name. */
  name: string;
  /** Dotted field path, e.g. "origin.xyz", "axis", "limit.lower". */
  field: string;
  /** Index into `sourceFiles` of the file holding the value span. */
  fileIndex: number;
  /** Byte offset of the value start within that file's text. */
  valueStart: number;
  /** Byte offset (exclusive) of the value end. */
  valueEnd: number;
  /** "literal" | "property" | "arg". */
  valueKind: string;
}

/** Richer result of opening a document (mirrors `commands::OpenResult`). */
export interface OpenResult {
  robot: Robot;
  /** xacro-expanded URDF text, or the original text for a plain URDF. */
  computedUrdf: string;
  /** Whether the opened file required xacro expansion. */
  isXacro: boolean;
  /** Detected colcon workspace root, if any. */
  workspaceRoot: string | null;
  /** Ordered xacro source files (empty for plain URDF). */
  sourceFiles: SourceFile[];
  /** Writable field anchors (empty for plain URDF). */
  anchors: FieldAnchor[];
}

export function openDocument(path: string): Promise<OpenResult> {
  if (!isTauri()) return mock.openDocument(path);
  return invoke<OpenResult>("open_document", { path });
}

/**
 * Splice `newText` into `[valueStart, valueEnd)` of `filePath`, re-expand
 * `mainPath`, and return the refreshed document (offsets shift after a write).
 */
export function setXacroField(
  mainPath: string,
  filePath: string,
  valueStart: number,
  valueEnd: number,
  newText: string,
): Promise<OpenResult> {
  if (!isTauri()) return mock.setXacroField(mainPath, filePath, valueStart, valueEnd, newText);
  return invoke<OpenResult>("set_xacro_field", {
    mainPath,
    filePath,
    valueStart,
    valueEnd,
    newText,
  });
}

export function openUrdf(path: string): Promise<Robot> {
  if (!isTauri()) return mock.openUrdf(path);
  return invoke<Robot>("open_urdf", { path });
}

export function saveUrdf(path: string, robot: Robot): Promise<void> {
  if (!isTauri()) return mock.saveUrdf(path, robot);
  return invoke<void>("save_urdf", { path, robot });
}

export function serializeUrdf(robot: Robot): Promise<string> {
  if (!isTauri()) return mock.serializeUrdf(robot);
  return invoke<string>("serialize_urdf", { robot });
}

export function validateRobot(robot: Robot): Promise<ValidationIssue[]> {
  if (!isTauri()) return mock.validateRobot(robot);
  return invoke<ValidationIssue[]>("validate_robot", { robot });
}

export function resolveMeshPath(
  packagePath: string,
  urdfDir: string,
): Promise<string | null> {
  if (!isTauri()) return mock.resolveMeshPath(packagePath, urdfDir);
  return invoke<string | null>("resolve_mesh_path", {
    packagePath,
    urdfDir,
  });
}

export function readMeshFile(path: string): Promise<Uint8Array> {
  if (!isTauri()) return mock.readMeshFile(path);
  return invoke<number[]>("read_mesh_file", { path }).then(
    (bytes) => new Uint8Array(bytes),
  );
}

export function newRobot(name: string): Promise<Robot> {
  if (!isTauri()) return mock.newRobot(name);
  return invoke<Robot>("new_robot", { name });
}
