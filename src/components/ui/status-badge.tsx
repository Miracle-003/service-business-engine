type StatusBadgeProps = {
  status: string;
  tone?: "neutral" | "success" | "warning" | "danger";
};

const tones = {
  neutral: "bg-slate-400/10 text-slate-300 ring-slate-300/15",
  success: "bg-emerald-400/10 text-emerald-300 ring-emerald-300/15",
  warning: "bg-amber-400/10 text-amber-200 ring-amber-300/15",
  danger: "bg-rose-400/10 text-rose-200 ring-rose-300/15",
};

export function StatusBadge({ status, tone = "neutral" }: StatusBadgeProps) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize ring-1 ${tones[tone]}`}>{status.toLowerCase()}</span>;
}