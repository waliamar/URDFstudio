// src/components/inspector/fields/NumberField.tsx
import { useEffect, useRef, useState } from "react";
import { useRobotStore } from "../../../state/robotStore";
import { scrubMultiplier, applyScrub } from "../../../lib/scrub";

interface Props {
  label?: string;
  value: number;
  step?: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
}

function decimalsOf(step: number): number {
  const s = String(step);
  const d = s.includes(".") ? s.split(".")[1].length : 0;
  return Math.min(Math.max(d, 1), 4);
}

/** Unity-style number field: drag the label to scrub, click the value to type. */
export function NumberField({ label, value, step = 0.01, min, max, onChange }: Props) {
  const precision = decimalsOf(step);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const scrubbing = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const display = value.toFixed(precision);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  // ── scrub (drag the label) ──
  const onLabelPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    scrubbing.current = true;
    useRobotStore.getState().beginInteraction();
    const el = e.currentTarget as HTMLElement;
    if (el.requestPointerLock) el.requestPointerLock();
    else el.setPointerCapture(e.pointerId);
  };
  const onLabelPointerMove = (e: React.PointerEvent) => {
    if (!scrubbing.current) return;
    const mult = scrubMultiplier({ shift: e.shiftKey, alt: e.altKey });
    onChange(applyScrub(value, e.movementX, step, mult, min, max));
  };
  const endScrub = () => {
    if (!scrubbing.current) return;
    scrubbing.current = false;
    if (document.pointerLockElement) document.exitPointerLock();
    useRobotStore.getState().endInteraction();
  };

  // End the scrub if pointer lock is dropped without a pointerup (e.g. the user
  // presses Escape mid-drag) — otherwise the temporal store stays paused and
  // undo history breaks for the rest of the session.
  useEffect(() => {
    const onLockChange = () => {
      if (!document.pointerLockElement) endScrub();
    };
    document.addEventListener("pointerlockchange", onLockChange);
    return () => document.removeEventListener("pointerlockchange", onLockChange);
  }, []);

  // ── click to edit ──
  const startEdit = () => { setText(display); setEditing(true); };
  const commit = (ok: boolean) => {
    if (ok) {
      const n = parseFloat(text);
      if (!Number.isNaN(n)) {
        const clamped = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));
        onChange(clamped);
      }
    }
    setEditing(false);
  };

  return (
    <div className={`num${scrubbing.current ? " scrubbing" : ""}${editing ? " editing" : ""}`}>
      {label !== undefined && (
        <span
          className="lab"
          onPointerDown={onLabelPointerDown}
          onPointerMove={onLabelPointerMove}
          onPointerUp={endScrub}
          onLostPointerCapture={endScrub}
        >
          {label}
        </span>
      )}
      {editing ? (
        <input
          ref={inputRef}
          className="val-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation(); // keep Ctrl+Z scoped to the text field
            if (e.key === "Enter") commit(true);
            if (e.key === "Escape") commit(false);
          }}
          onBlur={() => commit(true)}
        />
      ) : (
        <span className="val" onClick={startEdit}>{display}</span>
      )}
    </div>
  );
}
