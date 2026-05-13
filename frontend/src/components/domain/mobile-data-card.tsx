import { cn } from "@/lib/utils";

export function MobileDataCard({
  title,
  subtitle,
  badge,
  children,
  actions,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border bg-white p-4 shadow-sm", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-950">{title}</p>
          {subtitle ? <div className="mt-1 text-sm text-slate-500">{subtitle}</div> : null}
        </div>
        {badge ? <div className="shrink-0">{badge}</div> : null}
      </div>
      <div className="mt-4 space-y-3">{children}</div>
      {actions ? <div className="mt-4 flex flex-wrap justify-end gap-2">{actions}</div> : null}
    </div>
  );
}

export function MobileDataField({
  label,
  value,
  className,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-1", className)}>
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>
      <div className="text-sm text-slate-700">{value}</div>
    </div>
  );
}
