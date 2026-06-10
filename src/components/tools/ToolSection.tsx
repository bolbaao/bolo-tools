"use client";

import type { ReactNode } from "react";

type SectionProps = {
  title: string;
  desc?: string;
  children: ReactNode;
  className?: string;
};

export function ToolSection({ title, desc, children, className = "" }: SectionProps) {
  return (
    <section className={`tool-section ${className}`.trim()}>
      <div className="tool-section-head">
        <h2 className="tool-section-title">{title}</h2>
        {desc ? <p className="tool-section-desc">{desc}</p> : null}
      </div>
      {children}
    </section>
  );
}

type PresetCardProps = {
  title: string;
  desc?: string;
  icon?: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
};

export function ToolPresetCard({
  title,
  desc,
  icon,
  active,
  disabled,
  onClick,
}: PresetCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`tool-preset-card${active ? " tool-preset-card--active" : ""}`}
    >
      {icon ? (
        <span className="tool-preset-card-icon" aria-hidden>
          {icon}
        </span>
      ) : null}
      <span className="tool-preset-card-title">{title}</span>
      {desc ? <span className="tool-preset-card-desc">{desc}</span> : null}
    </button>
  );
}

export function ToolPresetGrid({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`tool-preset-grid ${className}`.trim()}>{children}</div>;
}

export function ToolNotice({ children }: { children: ReactNode }) {
  return <p className="tool-notice">{children}</p>;
}

type ChipProps = {
  label: string;
  active?: boolean;
  onClick?: () => void;
};

export function ToolChip({ label, active, onClick }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`tool-chip${active ? " tool-chip--active" : ""}`}
    >
      {label}
    </button>
  );
}

export function ToolChipBar({ children }: { children: ReactNode }) {
  return <div className="tool-chip-bar">{children}</div>;
}

export function ToolError({ children }: { children: ReactNode }) {
  return <p className="tool-error">{children}</p>;
}
