// src/components/layout/ResizeHandle.tsx
import { useRef, useState } from "react";
import { useUiStore } from "../../state/uiStore";
import { clampSize, PANEL_LIMITS, type PanelKey } from "../../lib/resize";

interface Props {
  panel: PanelKey;
  orientation: "vertical" | "horizontal";
  /** +1 if dragging toward larger coords grows the panel, -1 if it shrinks it. */
  direction: 1 | -1;
}

/** Draggable divider: drag to resize the panel, double-click to collapse/restore. */
export function ResizeHandle({ panel, orientation, direction }: Props) {
  const setPanelSize = useUiStore((s) => s.setPanelSize);
  const toggleCollapsed = useUiStore((s) => s.toggleCollapsed);
  const [dragging, setDragging] = useState(false);
  const start = useRef({ coord: 0, size: 0 });

  const sizeField = panel === "tree" ? "treeW" : panel === "inspector" ? "inspectorW" : "bottomH";

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = {
      coord: orientation === "vertical" ? e.clientX : e.clientY,
      size: useUiStore.getState().layout[sizeField] as number,
    };
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const cur = orientation === "vertical" ? e.clientX : e.clientY;
    const delta = (cur - start.current.coord) * direction;
    const { min, max } = PANEL_LIMITS[panel];
    setPanelSize(panel, clampSize(start.current.size, delta, min, max));
  };

  // Handles both pointerup and pointercancel (e.g. a touch interrupted by a
  // system gesture) so a drag can never get stuck with `dragging` true.
  const endDrag = (e: React.PointerEvent) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setDragging(false);
  };

  return (
    <div
      className={`resize-handle ${orientation}${dragging ? " dragging" : ""}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={() => toggleCollapsed(panel)}
    />
  );
}
