// src/lib/paths.ts

/**
 * Returns the directory portion of a file path, handling both POSIX (`/`)
 * and Windows (`\`) separators. Returns "" if the path has no directory
 * component.
 */
export function dirname(filePath: string): string {
  const lastSlash = Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"));
  if (lastSlash < 0) return "";
  return filePath.slice(0, lastSlash);
}

/** True for POSIX absolute paths (`/...`) or Windows drive-letter paths (`C:\...`, `C:/...`). */
export function isAbsolutePath(filePath: string): boolean {
  return filePath.startsWith("/") || /^[a-zA-Z]:[/\\]/.test(filePath);
}
