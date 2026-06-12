// src/components/xml/XmlPreview.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useRobotStore } from "../../state/robotStore";
import { useSelectionStore } from "../../state/selectionStore";
import { serializeUrdf } from "../../api/commands";
import type { SourceFile } from "../../api/commands";
import { debounce } from "../../lib/debounce";

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
    return <pre className="xml-preview">{xml || "<!-- no robot -->"}</pre>;
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
        <pre className="xml-preview">{computedUrdf || "<!-- empty -->"}</pre>
      )}
    </div>
  );
}

/** The assembled xacro source, one block per file with a sticky header. */
function SourceView({ files }: { files: SourceFile[] }) {
  const selected = useSelectionStore((s) => s.selected);
  const containerRef = useRef<HTMLDivElement>(null);

  // Scroll the first line matching the selected element into view.
  useEffect(() => {
    if (!selected) return;
    const el = containerRef.current?.querySelector<HTMLElement>(".source-line.match");
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [selected, files]);

  // Only one block highlights: the first file that defines the selected name.
  const matchFileIndex = useMemo(() => {
    if (!selected) return -1;
    const token = `name="${selected.name}"`;
    return files.findIndex((f) => f.text.includes(token));
  }, [files, selected]);

  if (files.length === 0) {
    return <div className="source-empty">No source files.</div>;
  }

  return (
    <div className="source-view" ref={containerRef}>
      {files.map((f, i) => (
        <SourceFileBlock
          key={f.path}
          file={f}
          selectedName={i === matchFileIndex ? selected?.name ?? null : null}
        />
      ))}
    </div>
  );
}

/** A `name="<sel>"` token marks the line that defines the selected element. */
function lineMatchesSelection(line: string, selectedName: string | null): boolean {
  if (!selectedName) return false;
  return line.includes(`name="${selectedName}"`);
}

function SourceFileBlock({
  file,
  selectedName,
}: {
  file: SourceFile;
  selectedName: string | null;
}) {
  const lines = useMemo(() => file.text.split("\n"), [file.text]);
  const firstMatch = useMemo(
    () => lines.findIndex((l) => lineMatchesSelection(l, selectedName)),
    [lines, selectedName],
  );

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
            className={`source-line${i === firstMatch ? " match" : ""}`}
          >
            {line || " "}
          </div>
        ))}
      </pre>
    </section>
  );
}
