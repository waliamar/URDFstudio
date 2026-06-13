// src/components/xml/XmlPreview.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useRobotStore } from "../../state/robotStore";
import { useSelectionStore } from "../../state/selectionStore";
import { serializeUrdf } from "../../api/commands";
import type { SourceFile } from "../../api/commands";
import { debounce } from "../../lib/debounce";
import { findElementLocation } from "../../lib/sourceMatch";
import { HighlightedXml, XmlLine } from "./XmlLine";

type Tab = "source" | "computed";

export function XmlPreview() {
  const robot = useRobotStore((s) => s.robot);
  const isXacro = useRobotStore((s) => s.isXacro);
  const computedUrdf = useRobotStore((s) => s.computedUrdf);
  const sourceFiles = useRobotStore((s) => s.sourceFiles);
  const [xml, setXml] = useState("");
  const [tab, setTab] = useState<Tab>("source");

  // Debounced live-serialize for plain URDF docs (xacro shows computed text).
  const run = useMemo(
    () =>
      debounce((r: NonNullable<typeof robot>) => {
        serializeUrdf(r).then(setXml).catch((e) => setXml(`<!-- serialize error: ${e} -->`));
      }, 300),
    [],
  );

  useEffect(() => {
    if (isXacro) return;
    if (!robot) {
      setXml("");
      return;
    }
    run(robot);
    return () => run.cancel();
  }, [robot, run, isXacro]);

  // Plain URDF: single live-serialized view, no tabs.
  if (!isXacro) {
    return <HighlightedXml text={xml || "<!-- no robot -->"} />;
  }

  return (
    <div className="preview-tabbed">
      <div className="preview-tabs">
        <button
          className={tab === "source" ? "active" : ""}
          onClick={() => setTab("source")}
        >
          Source
        </button>
        <button
          className={tab === "computed" ? "active" : ""}
          onClick={() => setTab("computed")}
        >
          Computed
        </button>
      </div>
      {tab === "source" ? (
        <SourceView files={sourceFiles} />
      ) : (
        <HighlightedXml text={computedUrdf || "<!-- empty -->"} />
      )}
    </div>
  );
}

/** The assembled xacro source, one block per file with a sticky header. */
function SourceView({ files }: { files: SourceFile[] }) {
  const selected = useSelectionStore((s) => s.selected);
  const containerRef = useRef<HTMLDivElement>(null);

  // Locate the selected element's definition, tolerating xacro-templated names
  // (e.g. source `${prefix}base_link` vs computed `ur16e_base_link`).
  const loc = useMemo(
    () => (selected ? findElementLocation(files, selected.kind, selected.name) : null),
    [files, selected],
  );

  // Scroll the highlighted line into view when the match changes.
  useEffect(() => {
    if (!loc) return;
    const el = containerRef.current?.querySelector<HTMLElement>(".source-line.match");
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [loc]);

  if (files.length === 0) {
    return <div className="source-empty">No source files.</div>;
  }

  return (
    <div className="source-view" ref={containerRef}>
      {files.map((f, i) => (
        <SourceFileBlock
          key={f.path}
          file={f}
          matchLine={loc && loc.fileIndex === i ? loc.lineIndex : -1}
        />
      ))}
    </div>
  );
}

function SourceFileBlock({
  file,
  matchLine,
}: {
  file: SourceFile;
  matchLine: number;
}) {
  const lines = useMemo(() => file.text.split("\n"), [file.text]);

  return (
    <section className={`source-file${file.editable ? "" : " readonly"}`}>
      <header className="source-file-header">
        <span className="source-file-label">{file.label}</span>
        {!file.editable && <span className="readonly-badge">read-only</span>}
      </header>
      <pre className="xml-preview source-file-body">
        {lines.map((line, i) => (
          <div
            key={i}
            className={`source-line${i === matchLine ? " match" : ""}`}
          >
            {line ? <XmlLine line={line} /> : " "}
          </div>
        ))}
      </pre>
    </section>
  );
}
