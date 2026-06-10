"use client";

import { useCallback, useRef, useState } from "react";

type Props = {
  accept?: string;
  multiple?: boolean;
  icon?: string;
  title: string;
  hint?: string;
  accent?: "amber" | "cyan" | "violet" | "teal";
  onFiles: (files: File[]) => void;
  className?: string;
};

export default function FileDropZone({
  accept,
  multiple,
  icon = "📁",
  title,
  hint,
  accent: _accent = "violet",
  onFiles,
  className = "",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const pick = useCallback(
    (list: FileList | null) => {
      if (!list?.length) return;
      onFiles(Array.from(list));
    },
    [onFiles],
  );

  return (
    <div
      className={`tool-drop-zone${dragActive ? " tool-drop-zone--active" : ""} ${className}`.trim()}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragActive(false);
        pick(e.dataTransfer.files);
      }}
    >
      <span className="tool-drop-zone-icon">{icon}</span>
      <span className="tool-drop-zone-title">{title}</span>
      {hint ? <span className="tool-drop-zone-hint">{hint}</span> : null}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => pick(e.target.files)}
      />
    </div>
  );
}
