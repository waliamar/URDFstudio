// src/components/xml/XmlPreview.tsx
import { useEffect, useMemo, useState } from "react";
import { useRobotStore } from "../../state/robotStore";
import { serializeUrdf } from "../../api/commands";
import { debounce } from "../../lib/debounce";

export function XmlPreview() {
  const robot = useRobotStore((s) => s.robot);
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
    if (!robot) {
      setXml("");
      return;
    }
    run(robot);
    return () => run.cancel();
  }, [robot, run]);

  return <pre className="xml-preview">{xml || "<!-- no robot -->"}</pre>;
}
