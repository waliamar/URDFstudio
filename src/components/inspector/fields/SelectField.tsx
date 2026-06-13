// src/components/inspector/fields/SelectField.tsx
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface Option {
  value: string;
  label?: string;
}

interface Props {
  label?: string;
  value: string;
  options: (string | Option)[];
  onChange: (value: string) => void;
}

/** Glass-pill dropdown that mimics the Unity-style xyz number fields. The open
 *  menu is portaled to <body> so the scrolling inspector cannot clip it, and is
 *  fully theme-styled (native <option> popups render white-on-white here). */
export function SelectField({ label, value, options, onChange }: Props) {
  const opts = options.map((o) =>
    typeof o === "string" ? { value: o, label: o } : { value: o.value, label: o.label ?? o.value },
  );
  const current = opts.find((o) => o.value === value);

  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const openMenu = () => {
    setHighlight(Math.max(0, opts.findIndex((o) => o.value === value)));
    setRect(triggerRef.current?.getBoundingClientRect() ?? null);
    setOpen(true);
  };
  const close = () => setOpen(false);
  const pick = (v: string) => { onChange(v); close(); };

  // Close on any outside pointerdown (capture phase, so it fires before clicks).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if ((t as HTMLElement).closest?.(".select-menu")) return;
      close();
    };
    window.addEventListener("pointerdown", onDown, true);
    return () => window.removeEventListener("pointerdown", onDown, true);
  }, [open]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation(); // keep global Ctrl+Z scoped away from the control
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") { e.preventDefault(); openMenu(); }
      return;
    }
    if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((h) => Math.min(opts.length - 1, h + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => Math.max(0, h - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); pick(opts[highlight].value); }
  };

  return (
    <div className="field">
      {label !== undefined && <label>{label}</label>}
      <button
        ref={triggerRef}
        type="button"
        className={`select-trigger${open ? " open" : ""}`}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={onKeyDown}
      >
        <span className="select-value">{current?.label ?? value}</span>
        <span className="select-chevron">▾</span>
      </button>
      {open && rect &&
        createPortal(
          <div
            className="select-menu"
            style={{ position: "fixed", top: rect.bottom + 4, left: rect.left, minWidth: rect.width }}
          >
            {opts.map((o, i) => (
              <div
                key={o.value}
                className={`select-option${o.value === value ? " selected" : ""}${i === highlight ? " active" : ""}`}
                onPointerEnter={() => setHighlight(i)}
                onClick={() => pick(o.value)}
              >
                {o.label}
              </div>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
