// Minimal, dependency-free XML tokenizer for syntax highlighting one line of
// URDF/xacro at a time. Line-scoped (the preview is already rendered per line),
// so multi-line constructs degrade to per-line spans — fine for URDF, where
// comments and attribute strings sit on a single line in practice.
//
// Invariant: concatenating the token values reproduces the input line exactly.

export type TokenType =
  | "punct" // < > </ /> =
  | "tag" // element name (possibly namespaced, e.g. xacro:macro)
  | "attr" // attribute name
  | "string" // quoted attribute value
  | "comment" // <!-- ... -->
  | "text"; // whitespace, text content, anything else

export interface Token {
  type: TokenType;
  value: string;
}

const IDENT = /^[A-Za-z_][\w.:-]*/;
const WS = /^\s+/;
const OTHER = /^[^\s<>="']+/;

export function tokenizeXml(line: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = line.length;
  let inTag = false; // between `<tag` and its closing `>`/`/>`

  const ident = (): string | null => {
    const m = IDENT.exec(line.slice(i));
    return m ? m[0] : null;
  };

  while (i < n) {
    const rest = line.slice(i);

    if (rest.startsWith("<!--")) {
      const end = line.indexOf("-->", i + 4);
      const stop = end === -1 ? n : end + 3;
      tokens.push({ type: "comment", value: line.slice(i, stop) });
      i = stop;
      continue;
    }
    if (rest.startsWith("</")) {
      tokens.push({ type: "punct", value: "</" });
      i += 2;
      const name = ident();
      if (name) {
        tokens.push({ type: "tag", value: name });
        i += name.length;
      }
      inTag = true;
      continue;
    }
    if (line[i] === "<") {
      tokens.push({ type: "punct", value: "<" });
      i += 1;
      const name = ident();
      if (name) {
        tokens.push({ type: "tag", value: name });
        i += name.length;
      }
      inTag = true;
      continue;
    }
    if (rest.startsWith("/>")) {
      tokens.push({ type: "punct", value: "/>" });
      i += 2;
      inTag = false;
      continue;
    }
    if (line[i] === ">") {
      tokens.push({ type: "punct", value: ">" });
      i += 1;
      inTag = false;
      continue;
    }
    if (line[i] === "=") {
      tokens.push({ type: "punct", value: "=" });
      i += 1;
      continue;
    }
    if (line[i] === '"' || line[i] === "'") {
      const q = line[i];
      const end = line.indexOf(q, i + 1);
      const stop = end === -1 ? n : end + 1;
      tokens.push({ type: "string", value: line.slice(i, stop) });
      i = stop;
      continue;
    }

    const ws = WS.exec(rest);
    if (ws) {
      tokens.push({ type: "text", value: ws[0] });
      i += ws[0].length;
      continue;
    }

    const name = ident();
    if (name) {
      // Identifiers are attribute names inside a tag, text content otherwise.
      tokens.push({ type: inTag ? "attr" : "text", value: name });
      i += name.length;
      continue;
    }

    const other = OTHER.exec(rest);
    if (other) {
      tokens.push({ type: "text", value: other[0] });
      i += other[0].length;
      continue;
    }

    // Single leftover special char that didn't match a rule above.
    tokens.push({ type: "text", value: line[i] });
    i += 1;
  }

  return tokens;
}
