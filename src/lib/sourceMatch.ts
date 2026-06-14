// Locate where a selected element is defined in the (un-expanded) xacro source.
//
// The robot model carries *computed* (post-expansion) names, while the source
// may template them, e.g. `name="${prefix}base_link"`. We match by element tag
// (so a link and a joint sharing a name don't cross-match) and normalize away
// xacro substitutions, accepting an exact match or a computed name that ends/
// begins with the literal remainder (the common prefix/suffix-variable case).

export type ElementKind = "link" | "joint" | "material";

export interface SourceLocation {
  /** Index into the files array. */
  fileIndex: number;
  /** 0-based line index within that file. */
  lineIndex: number;
}

interface MatchableFile {
  text: string;
}

/** Strip `${...}` and `$(...)` xacro substitutions, leaving literal text. */
function normalize(value: string): string {
  return value
    .replace(/\$\{[^}]*\}/g, "")
    .replace(/\$\([^)]*\)/g, "")
    .trim();
}

/** 2 = exact, 1 = normalized (template) match, 0 = no match. */
function matchStrength(sourceName: string, target: string): 0 | 1 | 2 {
  if (sourceName === target) return 2;
  const norm = normalize(sourceName);
  if (norm.length === 0) return 0;
  if (norm === target || target.endsWith(norm) || target.startsWith(norm)) return 1;
  return 0;
}

/**
 * Find the best source location defining `(kind, name)`, or null when no source
 * line plausibly defines it. Exact matches beat templated ones; ties break by
 * earliest file then earliest offset.
 */
export function findElementLocation(
  files: MatchableFile[],
  kind: ElementKind,
  name: string,
): SourceLocation | null {
  // `<[ns:]kind ... name="VALUE"`; the local tag name must equal `kind`, so a
  // `<xacro:macro name="...">` (local name "macro") never matches.
  const tagRe = new RegExp(
    `<\\s*(?:[A-Za-z_][\\w.-]*:)?${kind}\\b[^>]*?\\bname\\s*=\\s*"([^"]*)"`,
    "g",
  );

  let bestStrength = 0;
  let bestLoc: SourceLocation | null = null;

  files.forEach((file, fileIndex) => {
    tagRe.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = tagRe.exec(file.text)) !== null) {
      const strength = matchStrength(m[1], name);
      if (strength === 0) continue;
      if (strength > bestStrength) {
        bestStrength = strength;
        const lineIndex = file.text.slice(0, m.index).split("\n").length - 1;
        bestLoc = { fileIndex, lineIndex };
        if (strength === 2) return; // can't beat an exact match in this file
      }
    }
  });

  return bestLoc;
}
