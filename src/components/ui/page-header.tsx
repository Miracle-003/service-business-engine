type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
};

export function PageHeader({ eyebrow, title, description, action }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-5 border-b border-white/8 pb-7 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300/80">{eyebrow}</p> : null}
        <h1 className="text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl">{title}</h1>
        {description ? <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}