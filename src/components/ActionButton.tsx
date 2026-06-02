"use client";

type Props = {
  label: string;
  loadingLabel?: string;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "secondary";
  className?: string;
};

export default function ActionButton({
  label,
  loadingLabel = "处理中…",
  onClick,
  disabled,
  loading,
  variant = "primary",
  className = "",
}: Props) {
  const base =
    variant === "primary"
      ? "action-btn-primary btn-primary hover:brightness-[1.04] active:scale-[0.98]"
      : "action-btn-secondary bg-black/[0.04] text-black/72 border border-black/10 hover:bg-black/[0.06] hover:text-black/85";

  return (
    <button
      type="button"
      onClick={() => void onClick()}
      disabled={disabled || loading}
      className={`action-btn w-full rounded-xl px-6 py-3.5 text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${base} ${className}`}
    >
      {loading ? (
        <span className="inline-flex items-center justify-center gap-2">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          {loadingLabel}
        </span>
      ) : (
        label
      )}
    </button>
  );
}
