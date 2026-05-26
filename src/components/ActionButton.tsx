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
      ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-600/20 ring-1 ring-white/10 hover:brightness-110 active:scale-[0.98]"
      : "bg-white/5 text-white/80 border border-white/10 hover:bg-white/8";

  return (
    <button
      type="button"
      onClick={() => void onClick()}
      disabled={disabled || loading}
      className={`w-full rounded-xl px-6 py-3.5 text-sm font-medium transition-all disabled:opacity-50 ${base} ${className}`}
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
