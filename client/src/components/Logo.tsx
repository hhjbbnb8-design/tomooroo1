import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={cn("h-10 w-10", className)} aria-hidden="true">
      <rect x="1" y="1" width="46" height="46" rx="14" fill="#111A2E" />
      <rect x="1" y="1" width="46" height="46" rx="14" fill="none" stroke="#E8A33D" strokeOpacity="0.35" />
      <path d="M24 9.5 33.5 24c0 6.2-4.2 10.5-9.5 14.5C18.7 34.5 14.5 30.2 14.5 24L24 9.5Z" fill="#E8A33D" />
      <path d="M24 15v16.5" stroke="#111A2E" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="24" cy="26.5" r="2.6" fill="#111A2E" />
    </svg>
  );
}

export function Logo({
  variant = "light",
  compact = false,
  className,
}: {
  variant?: "light" | "dark";
  compact?: boolean;
  className?: string;
}) {
  const isDark = variant === "dark";
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <LogoMark className={compact ? "h-9 w-9" : "h-11 w-11"} />
      <div className="leading-none">
        <div
          className={cn(
            "font-display text-2xl font-bold tracking-tight",
            isDark ? "text-white" : "text-ink"
          )}
        >
          Midad<span className="text-amber">.</span>
        </div>
        {!compact && (
          <div
            className={cn(
              "mt-1 text-[11px] font-medium",
              isDark ? "text-white/55" : "text-muted-foreground"
            )}
          >
            Tomorrow School
          </div>
        )}
      </div>
    </div>
  );
}
