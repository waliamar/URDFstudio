// src/components/inspector/fields/SelectField.tsx

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

export function SelectField({ label, value, options, onChange }: Props) {
  const opts = options.map((o) =>
    typeof o === "string" ? { value: o, label: o } : { label: o.value, ...o },
  );
  return (
    <div className="field">
      {label !== undefined && <label>{label}</label>}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {opts.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
