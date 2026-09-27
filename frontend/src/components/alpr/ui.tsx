import type { ReactNode } from "react";
import type { Category, LogStatus } from "@/lib/alpr/types";
import { fmtPlate } from "@/lib/alpr/utils";
import { cn } from "@/lib/utils";

export function Panel({ title, icon, actions, children, className }: { title?: string; icon?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("glass p-5", className)}>
      {title && (
        <header className="mb-4 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{icon}{title}</h2>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {actions}
    </div>
  );
}

export function PlateBadge({ plate, className }: { plate: string; className?: string }) {
  return (
    <span className={cn("inline-block whitespace-nowrap rounded border-2 border-foreground/80 bg-foreground px-2 py-0.5 font-mono text-xs font-bold text-background", className)}>
      {fmtPlate(plate)}
    </span>
  );
}

const catStyle: Record<Category, string> = {
  resident: "bg-success/15 text-success border-success/40",
  visitor: "bg-warning/15 text-warning border-warning/40",
  blacklisted: "bg-destructive/20 text-destructive border-destructive/50",
};
export function CategoryBadge({ c }: { c: Category }) {
  return <span className={cn("rounded-full border px-2 py-0.5 text-xs font-medium capitalize", catStyle[c])}>{c === "visitor" ? "Pre-approved visitor" : c}</span>;
}

const stStyle: Record<LogStatus, [string, string]> = {
  granted: ["Granted", catStyle.resident],
  visitor: ["Visitor granted", catStyle.visitor],
  denied: ["Denied", "bg-muted text-muted-foreground border-border"],
  blacklisted: ["Blacklist alert", catStyle.blacklisted],
  overstay: ["Overstay", "bg-warning/15 text-warning border-warning/40"],
};
export function StatusBadge({ s }: { s: LogStatus }) {
  const [l, c] = stStyle[s];
  return <span className={cn("whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium", c)}>{l}</span>;
}

export function Metric({ label, value, tone = "primary" }: { label: string; value: string; tone?: "primary" | "success" | "warning" }) {
  const t = { primary: "text-primary", success: "text-success", warning: "text-warning" }[tone];
  return (
    <span className="rounded-md border border-border bg-secondary/60 px-2.5 py-1 text-xs">
      <span className="text-muted-foreground">{label}: </span>
      <span className={cn("font-mono font-semibold", t)}>{value}</span>
    </span>
  );
}
