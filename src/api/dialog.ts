// src/api/dialog.ts
// File open/save dialogs via the Tauri dialog plugin. Null-safe in browser mode.

const isTauri = (): boolean => "__TAURI_INTERNALS__" in window;

const URDF_FILTER = { name: "URDF", extensions: ["urdf", "xacro"] };

export async function openUrdfDialog(): Promise<string | null> {
  if (!isTauri()) return null;
  const { open } = await import("@tauri-apps/plugin-dialog");
  const result = await open({
    multiple: false,
    directory: false,
    filters: [URDF_FILTER],
  });
  return typeof result === "string" ? result : null;
}

export async function saveUrdfDialog(
  defaultPath?: string,
): Promise<string | null> {
  if (!isTauri()) return null;
  const { save } = await import("@tauri-apps/plugin-dialog");
  const result = await save({
    defaultPath,
    filters: [URDF_FILTER],
  });
  return result ?? null;
}
