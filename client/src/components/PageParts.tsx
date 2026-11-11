import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="animate-rise">
        {eyebrow && (
          <div className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground">
            {eyebrow}
          </div>
        )}
        <h1 className="font-display text-2xl font-bold text-ink sm:text-[1.9rem]">{title}</h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "ink",
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "ink" | "amber" | "green" | "red";
  className?: string;
}) {
  const tones = {
    ink: "bg-primary/8 text-primary",
    amber: "bg-amber/15 text-[#9a6514]",
    green: "bg-emerald-500/10 text-emerald-700",
    red: "bg-red-500/10 text-red-700",
  } as const;
  return (
    <div
      className={cn(
        "animate-rise rounded-2xl border border-border/80 bg-card p-5 shadow-[0_10px_30px_-26px_rgba(21,33,59,0.5)]",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", tones[tone])}>
          <Icon className="h-[18px] w-[18px]" />
        </span>
      </div>
      <div className="mt-3 font-display text-3xl font-bold text-ink">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/60 px-6 py-12 text-center",
        className
      )}
    >
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary text-primary">
        <Icon className="h-6 w-6" />
      </span>
      <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

const statusStyles: Record<string, { label: string; className: string; dot?: boolean }> = {
  scheduled: { label: "upcoming", className: "bg-primary/8 text-primary border-primary/15" },
  live: { label: "Live now", className: "bg-red-50 text-red-700 border-red-200", dot: true },
  ended: { label: "Ended", className: "bg-secondary text-muted-foreground border-border" },
  pending: { label: "Not submitted", className: "bg-amber/15 text-[#8a5a10] border-amber/30" },
  submitted: { label: "Submitted", className: "bg-sky-50 text-sky-700 border-sky-200" },
  graded: { label: "graded", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  missed: { label: "Missed", className: "bg-red-50 text-red-700 border-red-200" },
  ready: { label: "ready", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  processing: { label: "Preparing", className: "bg-amber/15 text-[#8a5a10] border-amber/30" },
  recording: { label: "Recording", className: "bg-red-50 text-red-700 border-red-200", dot: true },
  failed: { label: "Could not save", className: "bg-red-50 text-red-700 border-red-200" },
};

export function StatusPill({
  status,
  label,
  className,
}: {
  status: keyof typeof statusStyles | string;
  label?: string;
  className?: string;
}) {
  const style = statusStyles[status] ?? {
    label: status,
    className: "bg-secondary text-muted-foreground border-border",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
        style.className,
        className
      )}
    >
      {style.dot && <span className="live-dot" />}
      {label ?? style.label}
    </span>
  );
}
