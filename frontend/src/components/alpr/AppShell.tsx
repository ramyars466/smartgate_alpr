import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  ScanLine, Ticket, Car, ScrollText, BarChart3, Settings2, ChevronLeft, Volume2, VolumeX, Siren, ShieldAlert, X,
  UserCheck, Ban, Wand2, Copy, FlaskConical, Radio, Terminal,
} from "lucide-react";
import { useALPR, type SimKind } from "@/context/ALPRContext";
import { GATES } from "@/lib/alpr/types";
import { fmtPlate } from "@/lib/alpr/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { VehicleScene } from "./VehicleScene";

const NAV = [
  { to: "/", label: "Live Gate Monitor", icon: ScanLine },
  { to: "/visitors", label: "Visitor Passes", icon: Ticket },
  { to: "/directory", label: "Vehicle Directory", icon: Car },
  { to: "/logs", label: "Audit Logs", icon: ScrollText },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/config", label: "System Config", icon: Settings2 },
] as const;

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  return (
    <div className="font-mono text-sm tabular-nums">
      {now.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour12: false })}
      <span className="ml-1 text-xs text-muted-foreground">IST</span>
    </div>
  );
}

function Header() {
  const { gate, setGate, muted, setMuted, latency, barrier, toggleOverride, backendOnline } = useALPR();
  const ms = latency[latency.length - 1];
  return (
    <header className="sticky top-0 z-30 flex flex-wrap items-center gap-3 border-b border-border bg-background/80 px-4 py-3 backdrop-blur-md md:px-6">
      <Clock />
      <Select value={gate} onValueChange={setGate}>
        <SelectTrigger className="h-9 w-[200px]"><SelectValue /></SelectTrigger>
        <SelectContent>{GATES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
      </Select>
      <div className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs">
        <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-success" /></span>
        WebSocket: Connected <span className="font-mono text-muted-foreground">({ms} ms)</span>
      </div>
      <span className={cn("rounded-md border px-2 py-1 text-xs", backendOnline ? "border-success/40 text-success" : "border-border text-muted-foreground")}>
        {backendOnline ? "FastAPI live" : "Mock engine"}
      </span>
      <div className="ml-auto flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setMuted(!muted)} aria-label="Toggle audio alarm">
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}{muted ? "Muted" : "Audio on"}
        </Button>
        <Button size="sm" variant={barrier.override ? "outline" : "destructive"} onClick={toggleOverride} className={cn(barrier.override && "animate-pulse border-destructive text-destructive")}>
          <Siren className="h-4 w-4" />{barrier.override ? "Release Override" : "Emergency Override"}
        </Button>
      </div>
    </header>
  );
}

const SIMS: { k: SimKind; label: string; icon: typeof UserCheck; cls: string }[] = [
  { k: "resident", label: "Resident", icon: UserCheck, cls: "text-success" },
  { k: "blacklisted", label: "Blacklist", icon: Ban, cls: "text-destructive" },
  { k: "fuzzy", label: "Fuzzy OCR", icon: Wand2, cls: "text-primary" },
  { k: "mismatch", label: "Mismatch", icon: Copy, cls: "text-warning" },
];

function SimulatorToolbar() {
  const { simulate } = useALPR();
  const [open, setOpen] = useState(true);
  return (
    <div className="fixed bottom-4 right-4 z-40">
      {open ? (
        <div className="glass w-64 p-3 shadow-2xl">
          <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <span className="flex items-center gap-1.5"><Terminal className="h-3.5 w-3.5" />MANUAL TRIGGERS</span>
            <button onClick={() => setOpen(false)} aria-label="Collapse triggers"><X className="h-3.5 w-3.5" /></button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {SIMS.map(({ k, label, icon: I, cls }) => (
              <button key={k} onClick={() => simulate(k)} className="flex items-center gap-1.5 rounded-md border border-border bg-secondary/70 px-2 py-2 text-xs font-medium transition hover:bg-accent">
                <I className={cn("h-3.5 w-3.5", cls)} />Trigger {label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <Button onClick={() => setOpen(true)} size="sm"><Terminal className="h-4 w-4" />Manual Triggers</Button>
      )}
    </div>
  );
}

function CriticalOverlay() {
  const { criticalAlert, dismissAlert } = useALPR();
  if (!criticalAlert) return null;
  const v = criticalAlert.vehicle;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-destructive/30 p-4 backdrop-blur-sm">
      <div className="absolute inset-0 animate-pulse bg-destructive/20" />
      <div className="relative w-full max-w-xl rounded-xl border-2 border-destructive bg-background p-6 shadow-2xl">
        <div className="flex items-center gap-3 text-destructive">
          <ShieldAlert className="h-10 w-10 animate-pulse" />
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.2em]">Critical alert</div>
            <div className="text-xl font-extrabold">BLACKLISTED VEHICLE DETECTED</div>
          </div>
        </div>
        <VehicleScene className="mt-4 w-full rounded-lg" color={criticalAlert.detected.color} type={criticalAlert.detected.type} plate={criticalAlert.plate} boxColor="var(--destructive)" label="BLACKLIST" />
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div><div className="text-muted-foreground">Plate</div><div className="font-mono text-2xl font-bold">{fmtPlate(criticalAlert.plate)}</div></div>
          <div><div className="text-muted-foreground">Record</div><div className="font-semibold">{v?.owner ?? "Unknown"}</div></div>
          <div><div className="text-muted-foreground">Vehicle</div><div>{criticalAlert.detected.color} {criticalAlert.detected.make}</div></div>
          <div><div className="text-muted-foreground">Barrier</div><div className="font-semibold text-destructive">LOCKED</div></div>
        </div>
        <div className="mt-6 flex gap-2">
          <Button variant="destructive" className="flex-1" onClick={dismissAlert}><Radio className="h-4 w-4" />Acknowledge & Dispatch Security</Button>
        </div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const { barrier } = useALPR();
  return (
    <div className="flex min-h-screen">
      <aside className={cn("sticky top-0 hidden h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-all md:flex", collapsed ? "w-16" : "w-64")}>
        <div className="flex items-center gap-2 px-4 py-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"><ScanLine className="h-4 w-4" /></div>
          {!collapsed && <div><div className="font-bold leading-tight">smart gate ai</div><div className="font-mono text-[10px] tracking-widest text-muted-foreground">ALPR · v2.4</div></div>}
        </div>
        <nav className="flex-1 space-y-1 px-2">
          {NAV.map(({ to, label, icon: I }) => (
            <Link key={to} to={to} activeOptions={{ exact: to === "/" }}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/75 transition hover:bg-sidebar-accent hover:text-sidebar-foreground"
              activeProps={{ className: "bg-sidebar-accent !text-primary font-medium" }} title={label}>
              <I className="h-4 w-4 shrink-0" />{!collapsed && label}
            </Link>
          ))}
        </nav>
        <button onClick={() => setCollapsed(!collapsed)} className="m-2 flex items-center justify-center gap-2 rounded-md border border-sidebar-border py-2 text-xs text-muted-foreground hover:bg-sidebar-accent">
          <ChevronLeft className={cn("h-4 w-4 transition", collapsed && "rotate-180")} />{!collapsed && "Collapse"}
        </button>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <nav className="flex gap-1 overflow-x-auto border-b border-border px-3 py-2 md:hidden">
          {NAV.map(({ to, label, icon: I }) => (
            <Link key={to} to={to} activeOptions={{ exact: to === "/" }} className="flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground" activeProps={{ className: "bg-accent !text-primary" }}>
              <I className="h-3.5 w-3.5" />{label}
            </Link>
          ))}
        </nav>
        {barrier.override && <div className="bg-destructive px-4 py-1.5 text-center text-xs font-bold uppercase tracking-widest text-destructive-foreground">Emergency override active — all barriers held open</div>}
        <main className="flex-1 p-4 pb-40 md:p-6 md:pb-32">{children}</main>
      </div>
      <SimulatorToolbar />
      <CriticalOverlay />
    </div>
  );
}
