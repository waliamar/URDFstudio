// src/components/inspector/Section.tsx
import { useState, type ReactNode } from "react";

interface Props {
  title: string;
  defaultOpen?: boolean;
  /** Optional present/absent toggle for optional model sections. */
  present?: boolean;
  onTogglePresent?: () => void;
  children: ReactNode;
}

export function Section({
  title,
  defaultOpen = true,
  present,
  onTogglePresent,
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const hasPresence = present !== undefined;
  const showBody = open && (!hasPresence || present);

  return (
    <div className="form-section">
      <header onClick={() => setOpen((o) => !o)}>
        <span>
          {open ? "▾" : "▸"} {title}
        </span>
        {hasPresence && (
          <input
            type="checkbox"
            checked={present}
            title={present ? "Remove section" : "Add section"}
            onClick={(e) => e.stopPropagation()}
            onChange={() => onTogglePresent?.()}
          />
        )}
      </header>
      {showBody && <div className="body">{children}</div>}
    </div>
  );
}
