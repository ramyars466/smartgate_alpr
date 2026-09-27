import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download, Search, FileWarning } from "lucide-react";
import { toast } from "sonner";
import { useALPR } from "@/context/ALPRContext";
import { PageHeader, Panel, PlateBadge, StatusBadge, Metric } from "@/components/alpr/ui";
import { VehicleScene, PlateCrop } from "@/components/alpr/VehicleScene";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fmtDateTime, fmtPlate, normPlate } from "@/lib/alpr/utils";
import { GATES, type LogEntry, type LogStatus } from "@/lib/alpr/types";

export const Route = createFileRoute("/logs")({
  head: () => ({
    meta: [
      { title: "Access Audit Logs & Reports — smart gate ai" },
      { name: "description", content: "Search, filter and export every gate event with snapshots, OCR text and AI confidence." },
      { property: "og:title", content: "Access Audit Logs — smart gate ai" },
      { property: "og:description", content: "Search, filter and export every gate event." },
    ],
  }),
  component: Logs,
});

const day = (t: number) => new Date(t - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const STATUSES: { v: "all" | LogStatus; l: string }[] = [
  { v: "all", l: "All statuses" }, { v: "granted", l: "Granted" }, { v: "visitor", l: "Visitor granted" }, { v: "denied", l: "Denied" }, { v: "blacklisted", l: "Blacklisted Alert" }, { v: "overstay", l: "Overstay" },
];
const selCls = "h-9 rounded-md border border-input bg-transparent px-3 text-sm";

function Logs() {
  const { logs, updateLogNote } = useALPR();
  const [from, setFrom] = useState(() => day(Date.now() - 3 * 86400000));
  const [to, setTo] = useState(() => day(Date.now()));
  const [gate, setGate] = useState("all");
  const [status, setStatus] = useState<"all" | LogStatus>("all");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<LogEntry | null>(null);
  const [note, setNote] = useState("");

  const rows = useMemo(() => {
    const a = new Date(from + "T00:00").getTime(), b = new Date(to + "T23:59:59").getTime(), s = normPlate(q);
    return logs.filter((l) => l.ts >= a && l.ts <= b && (gate === "all" || l.gate === gate) && (status === "all" || l.status === status) && (!s || l.plate.includes(s) || l.ocr.includes(s)));
  }, [logs, from, to, gate, status, q]);

  const exportCsv = () => {
    const head = ["Timestamp", "Gate", "Plate", "OCR Text", "Status", "Vehicle", "YOLO %", "OCR %", "Speed ms", "Duration min", "Guard Notes"];
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = rows.map((l) => [new Date(l.ts).toISOString(), l.gate, fmtPlate(l.plate), l.ocr, l.status, `${l.color} ${l.make}`, l.yolo.toFixed(1), l.ocrConf.toFixed(1), l.speed, l.durationMin ?? "", l.note].map(esc).join(","));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" }));
    a.download = `smartgate-audit-${from}_to_${to}.csv`; a.click();
    toast.success(`Exported ${rows.length} rows`);
  };

  const openRow = (l: LogEntry) => { setSel(l); setNote(l.note); };
  const boxFor = (s: LogStatus) => (s === "blacklisted" || s === "denied" ? "var(--destructive)" : "var(--success)");

  return (
    <div>
      <PageHeader title="Access Audit Logs & Reports" subtitle={`${rows.length} of ${logs.length} events`} actions={<Button onClick={exportCsv}><Download className="h-4 w-4" />Export CSV Report</Button>} />
      <Panel>
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1"><Label className="text-xs">From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">Gate</Label>
            <select className={selCls + " w-full"} value={gate} onChange={(e) => setGate(e.target.value)}><option value="all" className="bg-popover">All gates</option>{GATES.map((g) => <option key={g} className="bg-popover">{g}</option>)}</select></div>
          <div className="space-y-1"><Label className="text-xs">Status</Label>
            <select className={selCls + " w-full"} value={status} onChange={(e) => setStatus(e.target.value as any)}>{STATUSES.map((s) => <option key={s.v} value={s.v} className="bg-popover">{s.l}</option>)}</select></div>
          <div className="space-y-1"><Label className="text-xs">Plate</Label>
            <div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9 font-mono uppercase" value={q} onChange={(e) => setQ(e.target.value)} placeholder="KL65…" /></div></div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground"><tr><th className="py-2">Timestamp</th><th>Gate</th><th>Snapshot</th><th>Plate crop</th><th>Extracted text</th><th>Status</th><th>Guard notes</th></tr></thead>
            <tbody className="divide-y divide-border">
              {rows.slice(0, 200).map((l) => (
                <tr key={l.id} onClick={() => openRow(l)} className="cursor-pointer transition hover:bg-accent/50">
                  <td className="whitespace-nowrap py-2 font-mono text-xs">{fmtDateTime(l.ts)}</td>
                  <td className="whitespace-nowrap text-muted-foreground">{l.gate}</td>
                  <td>{l.imageUrl ? <img src={l.imageUrl} alt="" className="h-10 w-16 rounded object-cover" /> : <VehicleScene className="h-10 w-16 rounded" color={l.color} type={l.type} plate={l.plate} box={false} />}</td>
                  <td><div className="w-24"><PlateCrop plate={l.ocr} /></div></td>
                  <td className="font-mono font-semibold">{fmtPlate(l.ocr)}</td>
                  <td><StatusBadge s={l.status} /></td>
                  <td className="max-w-[240px] truncate text-muted-foreground">{l.note}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">No events for these filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>

      <Dialog open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <DialogContent className="max-w-2xl">
          {sel && (<>
            <DialogHeader><DialogTitle className="flex items-center gap-2"><FileWarning className="h-5 w-5 text-primary" />Incident Report · <PlateBadge plate={sel.plate} /></DialogTitle></DialogHeader>
            {sel.imageUrl ? <img src={sel.imageUrl} alt="Snapshot" className="w-full rounded-lg" /> :
              <VehicleScene className="w-full rounded-lg" color={sel.color} type={sel.type} plate={sel.plate} boxColor={boxFor(sel.status)} label={`yolov8 ${(sel.yolo / 100).toFixed(2)}`} />}
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div><div className="text-xs text-muted-foreground">Time</div>{fmtDateTime(sel.ts)}</div>
              <div><div className="text-xs text-muted-foreground">Gate</div>{sel.gate}</div>
              <div><div className="text-xs text-muted-foreground">Vehicle</div>{sel.color} {sel.make}</div>
              <div><div className="text-xs text-muted-foreground">Time inside</div>{sel.durationMin == null ? "Not admitted" : `${Math.floor(sel.durationMin / 60)}h ${sel.durationMin % 60}m`}</div>
            </div>
            <div className="flex flex-wrap items-center gap-2"><StatusBadge s={sel.status} />
              <Metric label="YOLO" value={`${sel.yolo.toFixed(1)}%`} tone="success" /><Metric label="OCR" value={`${sel.ocrConf.toFixed(1)}%`} tone={sel.ocrConf < 88 ? "warning" : "success"} /><Metric label="Latency" value={`${sel.speed} ms`} /></div>
            <div className="space-y-1.5"><Label>Guard notes</Label><Textarea value={note} onChange={(e) => setNote(e.target.value)} />
              <Button size="sm" onClick={() => { updateLogNote(sel.id, note); toast.success("Note saved"); setSel(null); }}>Save note</Button></div>
          </>)}
        </DialogContent>
      </Dialog>
    </div>
  );
}
