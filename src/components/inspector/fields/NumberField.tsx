// src/components/inspector/fields/NumberField.tsx
import { useEffect, useState } from "react";

interface Props {
  label?: string;
  value: number;
  step?: number;
  onChange: (value: number) => void;
}

/** Number input that parses floats and commits on change/blur. */
export function NumberField({ label, value, step = 0.01, onChange }: Props) {
  const [text, setText] = useState(String(value));

  // Sync external value changes (e.g. undo) into the local input text,
  // unless the local text already represents the same number.
  useEffect(() => {
    if (parseFloat(text) !== value) setText(String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const commit = (raw: string) => {
    const n = parseFloat(raw);
    if (!Number.isNaN(n)) onChange(n);
  };

  return (
    <div className="field">
      {label !== undefined && <label>{label}</label>}
      <input
        type="number"
        step={step}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          commit(e.target.value);
        }}
        onBlur={() => setText(String(value))}
      />
    </div>
  );
}
