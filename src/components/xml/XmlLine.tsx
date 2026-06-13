// Render helpers that paint URDF/xacro XML with syntax colors.
import { useMemo } from "react";
import { tokenizeXml } from "../../lib/xmlHighlight";

/** One line of XML as colored token spans (empty line renders nothing). */
export function XmlLine({ line }: { line: string }) {
  const tokens = useMemo(() => tokenizeXml(line), [line]);
  return (
    <>
      {tokens.map((t, i) => (
        <span key={i} className={`xtok xtok-${t.type}`}>
          {t.value}
        </span>
      ))}
    </>
  );
}

/** A whole XML document highlighted line-by-line inside a <pre>. */
export function HighlightedXml({
  text,
  className = "xml-preview",
}: {
  text: string;
  className?: string;
}) {
  const lines = useMemo(() => text.split("\n"), [text]);
  return (
    <pre className={className}>
      {lines.map((line, i) => (
        <span key={i}>
          <XmlLine line={line} />
          {i < lines.length - 1 ? "\n" : ""}
        </span>
      ))}
    </pre>
  );
}
