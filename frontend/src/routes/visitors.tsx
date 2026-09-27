import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Ticket, Download, Share2, Plus, Clock3 } from "lucide-react";
import { toast } from "sonner";
import { useALPR } from "@/context/ALPRContext";
import { Panel, PageHeader, PlateBadge } from "@/components/alpr/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fmtDateTime } from "@/lib/alpr/utils";
import type { VisitorPass } from "@/lib/alpr/types";

export const Route = createFileRoute("/visitors")({
  head: () => ({
    meta: [
      { title: "Visitor Pre-Approval & Gate Pass — smart gate ai" },
      { name: "description", content: "Pre-register guests and generate QR digital gate passes with automatic plate recognition." },
      { property: "og:title", content: "Visitor Gate Passes — smart gate ai" },
      { property: "og:description", content: "Pre-register guests and issue QR digital gate passes." },
    ],
  }),
  component: Visitors,
});

const toLocal = (t: number) => { const d = new Date(t - new Date().getTimezoneOffset() * 60000); return d.toISOString().slice(0, 16); };

function PassCard({ p }: { p: VisitorPass }) {
  const payload = JSON.stringify({ id: p.id, plate: p.plate, flat: p.flat, exp: p.expiresAt });
  const download = () => {
    const svg = document.getElementById(`qr-${p.id}`)?.outerHTML ?? "";
    const html = `<html><body style="font-family:sans-serif;background:#0B0F17;color:#e5e7eb;padding:24px"><h2>SmartGate Digital Gate Pass</h2><p>${p.guest} · ${p.phone}</p><p>Plate: <b>${p.plate}</b> · Flat ${p.flat}</p><p>Valid: ${fmtDateTime(p.entryAt)} → ${fmtDateTime(p.expiresAt)}</p><div style="background:#fff;display:inline-block;padding:12px">${svg}</div></body></html>`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    a.download = `gate-pass-${p.plate}.html`; a.click();
  };
  const share = async () => {
    const text = `SmartGate pass for ${p.guest}: plate ${p.plate}, flat ${p.flat}, valid till ${fmtDateTime(p.expiresAt)}. Pass ID ${p.id}`;
    if (navigator.share) await navigator.share({ title: "Gate Pass", text }).catch(() => {});
    else { await navigator.clipboard.writeText(text); toast.success("Pass details copied"); }
  };
  return (
    <div className="animate-scale-in overflow-hidden rounded-xl border border-primary/40 bg-gradient-to-br from-secondary to-background">
      <div className="flex items-center justify-between bg-primary px-4 py-2 text-primary-foreground">
        <span className="flex items-center gap-2 text-sm font-bold"><Ticket className="h-4 w-4" />DIGITAL GATE PASS</span>
        <span className="font-mono text-xs">#{p.id.toUpperCase()}</span>
      </div>
      <div className="flex gap-4 p-4">
        <div className="rounded-lg bg-foreground p-2"><QRCodeSVG id={`qr-${p.id}`} value={payload} size={120} /></div>
        <div className="space-y-1.5 text-sm">
          <div className="text-lg font-bold">{p.guest}</div>
          <div className="text-muted-foreground">{p.phone}</div>
          <PlateBadge plate={p.plate} className="text-sm" />
          <div>Visiting flat <b>{p.flat}</b></div>
          <div className="flex items-center gap-1 text-xs text-warning"><Clock3 className="h-3 w-3" />Expires {fmtDateTime(p.expiresAt)}</div>
        </div>
      </div>
      <div className="flex gap-2 border-t border-border p-3">
        <Button size="sm" variant="outline" onClick={download}><Download className="h-4 w-4" />Download</Button>
        <Button size="sm" variant="outline" onClick={share}><Share2 className="h-4 w-4" />Share</Button>
      </div>
    </div>
  );
}

function Visitors() {
  const { passes, addPass, revokePass, extendPass } = useALPR();
  const [f, setF] = useState(() => ({ guest: "", phone: "", plate: "", flat: "", entry: toLocal(Date.now()), hours: "4" }));
  const [last, setLast] = useState<VisitorPass | null>(null);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.guest || !f.plate || !f.flat) return toast.error("Guest name, plate and flat are required");
    const entryAt = new Date(f.entry).getTime();
    const p = addPass({ guest: f.guest, phone: f.phone, plate: f.plate, flat: f.flat, entryAt, expiresAt: entryAt + Number(f.hours) * 3600000 });
    setLast(p);
    toast.success(`Pass issued for ${f.guest}`);
    setF((x) => ({ ...x, guest: "", phone: "", plate: "" }));
  };
  const active = passes.filter((p) => p.status === "active");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <div>
      <PageHeader title="Visitor Pre-Approval & Pass Generator" subtitle="Approved plates are recognised automatically at the gate" />
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Pre-register a guest" icon={<Plus className="h-4 w-4" />}>
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Guest name</Label><Input value={f.guest} onChange={set("guest")} placeholder="Rahul Verma" /></div>
            <div className="space-y-1.5"><Label>Guest phone</Label><Input value={f.phone} onChange={set("phone")} placeholder="+91 98xxx xxxxx" /></div>
            <div className="space-y-1.5"><Label>Vehicle plate</Label><Input value={f.plate} onChange={set("plate")} placeholder="KL 07 AB 1234" className="font-mono uppercase" /></div>
            <div className="space-y-1.5"><Label>Visiting flat</Label><Input value={f.flat} onChange={set("flat")} placeholder="A-304" /></div>
            <div className="space-y-1.5"><Label>Expected entry</Label><Input type="datetime-local" value={f.entry} onChange={set("entry")} /></div>
            <div className="space-y-1.5"><Label>Valid for</Label>
              <select value={f.hours} onChange={set("hours")} className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm">
                {["2", "4", "8", "12", "24"].map((h) => <option key={h} value={h} className="bg-popover">{h} hours</option>)}
              </select>
            </div>
            <Button type="submit" className="sm:col-span-2"><Ticket className="h-4 w-4" />Generate Gate Pass</Button>
          </form>
        </Panel>
        <div>{last ? <PassCard p={last} /> : (
          <div className="glass flex h-full min-h-[260px] items-center justify-center p-6 text-center text-muted-foreground">Submit the form to generate a digital pass with QR code.</div>
        )}</div>
      </div>
      <Panel title={`Active visitor passes (${active.length})`} className="mt-5">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground"><tr><th className="py-2">Guest</th><th>Plate</th><th>Flat</th><th>Entry</th><th>Expires</th><th>Status</th><th className="text-right">Actions</th></tr></thead>
            <tbody className="divide-y divide-border">
              {active.map((p) => {
                const expired = p.expiresAt < Date.now();
                return (
                  <tr key={p.id}>
                    <td className="py-2.5"><div className="font-medium">{p.guest}</div><div className="text-xs text-muted-foreground">{p.phone}</div></td>
                    <td><PlateBadge plate={p.plate} /></td><td>{p.flat}</td>
                    <td className="text-muted-foreground">{fmtDateTime(p.entryAt)}</td>
                    <td className={expired ? "text-destructive" : ""}>{fmtDateTime(p.expiresAt)}</td>
                    <td>{expired ? <span className="text-xs text-destructive">Expired</span> : p.enteredAt ? <span className="text-xs text-success">Inside</span> : <span className="text-xs text-muted-foreground">Expected</span>}</td>
                    <td className="space-x-2 whitespace-nowrap text-right">
                      <Button size="sm" variant="outline" onClick={() => { extendPass(p.id, 2); toast.success("Extended by 2 hours"); }}>Extend Time</Button>
                      <Button size="sm" variant="destructive" onClick={() => { revokePass(p.id); toast("Pass revoked"); }}>Revoke Pass</Button>
                    </td>
                  </tr>
                );
              })}
              {!active.length && <tr><td colSpan={7} className="py-6 text-center text-muted-foreground">No active passes</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
