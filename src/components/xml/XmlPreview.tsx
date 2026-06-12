// src/components/xml/XmlPreview.tsx
import { useEffect, useMemo, useState } from "react";
import { useRobotStore } from "../../state/robotStore";
import { serializeUrdf } from "../../api/commands";
import { debounce } from "../../lib/debounce";

export function XmlPreview() {
  const robot = useRobotStore((s) => s.robot);
  const isXacro = useRobotStore((s) => s.isXacro);
  const computedUrdf = useRobotStore((s) => s.computedUrdf);
  const [xml, setXml] = useState("");

  // Debounced serialize on robot change (300ms).
  const run = useMemo(
    () =>
      debounce((r: NonNullable<typeof robot>) => {
        serializeUrdf(r).then(setXml).catch((e) => setXml(`<!-- serialize error: ${e} -->`));
      }, 300),
    [],
  );

  useEffect(() => {
    // For xacro docs, show the immutable computed URDF instead of re-serializing
    // the in-memory model (which would lose all xacro structure).
    if (isXacro) return;
    if (!robot) {
      setXml("");
      return;
    }
    run(robot);
    return () => run.cancel();
  }, [robot, run, isXacro]);

  const text = isXacro ? (computedUrdf ?? "") : xml;
  return <pre className="xml-preview">{text || "<!-- no robot -->"}</pre>;
}
