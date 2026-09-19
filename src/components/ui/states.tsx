import { GlassCard } from "@/src/components/ui/glass-card";

export function LoadingState({ label = "Loading workspace" }: { label?: string }) {
  return (
    <GlassCard className="flex min-h-44 items-center justify-center gap-3 p-8 text-sm text-slate-400">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-300/25 border-t-indigo-300" aria-hidden="true" />
      {label}
    </GlassCard>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <GlassCard className="p-8 text-center sm:p-12">
      <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/6 text-indigo-300">—</div>
      <h2 className="text-lg font-medium text-white">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">{description}</p>
    </GlassCard>
  );
}

export function ErrorState({ title = "Something went wrong", description, onRetry }: { title?: string; description: string; onRetry?: () => void }) {
  return (
    <GlassCard className="border-rose-300/15 p-8">
      <p className="text-sm font-semibold text-rose-200">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
      {onRetry ? <button onClick={onRetry} className="mt-5 rounded-xl border border-white/12 px-4 py-2 text-sm text-white transition hover:bg-white/8">Try again</button> : null}
    </GlassCard>
  );
}