import type { HTMLAttributes } from "react";

type GlassCardProps = HTMLAttributes<HTMLDivElement> & {
  interactive?: boolean;
};

export function GlassCard({ className = "", interactive = false, ...props }: GlassCardProps) {
  return (
    <div
      className={`glass rounded-3xl ${interactive ? "transition duration-200 hover:-translate-y-0.5 hover:border-indigo-300/25 hover:bg-slate-800/75" : ""} ${className}`}
      {...props}
    />
  );
}