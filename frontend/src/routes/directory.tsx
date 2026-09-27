import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Search, Pencil, Trash2, Ban, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useALPR } from "@/context/ALPRContext";
import { PageHeader, Panel, PlateBadge, CategoryBadge } from "@/components/alpr/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { fmtDate, fmtPlate, COLOR_HEX } from "@/lib/alpr/utils";
import type { Vehicle, Category, BodyType } from "@/lib/alpr/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/directory")({
  head: () => ({
    meta: [
      { title: "Vehicle Directory & Blacklist — smart gate ai" },
      { name: "description", content: "Manage resident vehicles, pre-approved visitors and the security blacklist." },
      { property: "og:title", content: "Vehicle Directory & Blacklist — smart gate ai" },
      { property: "og:description", content: "Manage resident vehicles, visitors and the security blacklist." },
    ],
  }),
  component: Directory,
});

type Form = Omit<Vehicle, "id" | "registeredAt">;
const EMPTY: Form = { plate: "", owner: "", flat: "", make: "", color: "White", type: "sedan", category: "resident" };
const FILTERS: { v: "all" | Category; l: string }[] = [
  { v: "all", l: "All" }, { v: "resident", l: "Residents" }, { v: "visitor", l: "Pre-Approved Visitors" }, { v: "blacklisted", l: "Blacklisted" },
];

function Sel({ value, onChange, opts }: { value: string; onChange: (v: string) => void; opts: string[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm capitalize">
      {opts.map((o) => <option key={o} value={o} className="bg-popover">{o}</option>)}
    </select>
  );
}

function Directory() {
  const { vehicles, addVehicle, updateVehicle, deleteVehicle, toggleBlacklist } = useALPR();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<"all" | Category>("all");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<string | null>(null);
  const [f, setF] = useState<Form>(EMPTY);
  const [del, setDel] = useState<Vehicle | null>(null);

  const rows = useMemo(() => {
    const s = q.toUpperCase().replace(/\s/g, "");
    return vehicles.filter((v) => (cat === "all" || v.category === cat) && (!s || v.plate.includes(s) || v.owner.toUpperCase().replace(/\s/g, "").includes(s)));
  }, [vehicles, q, cat]);

  const startAdd = () => { setEdit(null); setF(EMPTY); setOpen(true); };
  const startEdit = (v: Vehicle) => { setEdit(v.id); setF({ ...v }); setOpen(true); };
  const save = () => {
    if (!f.plate || !f.owner) return toast.error("Plate and owner are required");
    if (edit) { updateVehicle(edit, f); toast.success("Vehicle updated"); }
    else { addVehicle(f); toast.success(`${fmtPlate(f.plate)} registered — scannable at the gate now`); }
    setOpen(false);
  };

  return (
    <div>
      <PageHeader title="Vehicle Directory & Blacklist Manager" subtitle={`${vehicles.length} registered vehicles · ${vehicles.filter((v) => v.category === "blacklisted").length} on alarm trigger list`}
        actions={<Button onClick={startAdd}><Plus className="h-4 w-4" />Register New Vehicle</Button>} />
      <Panel>
        <div className="mb-4 flex flex-wrap gap-3">
          <div className="relative min-w-[240px] flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by plate or owner name" className="pl-9" />
          </div>
          <div className="flex flex-wrap rounded-md border border-border p-0.5">
            {FILTERS.map((x) => (
              <button key={x.v} onClick={() => setCat(x.v)} className={cn("rounded px-3 py-1.5 text-xs", cat === x.v ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>{x.l}</button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr><th className="py-2">Owner</th><th>Flat</th><th>Plate</th><th>Make / Color</th><th>Category</th><th>Registered</th><th className="text-right">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((v) => (
                <tr key={v.id} className={cn("transition", v.category === "blacklisted" && "bg-destructive/10 text-destructive")}>
                  <td className="py-2.5 font-medium">{v.owner}</td>
                  <td>{v.flat}</td>
                  <td><PlateBadge plate={v.plate} /></td>
                  <td><span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full border border-border" style={{ background: COLOR_HEX[v.color] }} />{v.color} {v.make}</span></td>
                  <td><CategoryBadge c={v.category} /></td>
                  <td className="text-muted-foreground">{fmtDate(v.registeredAt)}</td>
                  <td className="whitespace-nowrap text-right">
                    <Button size="icon" variant="ghost" onClick={() => startEdit(v)} aria-label="Edit"><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => setDel(v)} aria-label="Delete"><Trash2 className="h-4 w-4" /></Button>
                    <Button size="sm" variant={v.category === "blacklisted" ? "outline" : "destructive"} onClick={() => { toggleBlacklist(v.id); toast[v.category === "blacklisted" ? "success" : "warning"](v.category === "blacklisted" ? `${fmtPlate(v.plate)} removed from blacklist` : `${fmtPlate(v.plate)} added to alarm trigger list`); }}>
                      {v.category === "blacklisted" ? <><ShieldCheck className="h-4 w-4" />Unblock</> : <><Ban className="h-4 w-4" />Blacklist</>}
                    </Button>
                  </td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">No vehicles match.</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit ? "Edit vehicle" : "Register new vehicle"}</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Plate number</Label><Input className="font-mono uppercase" value={f.plate} onChange={(e) => setF({ ...f, plate: e.target.value })} placeholder="KL 07 AB 1234" /></div>
            <div className="space-y-1.5"><Label>Owner name</Label><Input value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Flat number</Label><Input value={f.flat} onChange={(e) => setF({ ...f, flat: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Make / model</Label><Input value={f.make} onChange={(e) => setF({ ...f, make: e.target.value })} placeholder="Tata Nexon" /></div>
            <div className="space-y-1.5"><Label>Color</Label><Sel value={f.color} onChange={(v) => setF({ ...f, color: v })} opts={Object.keys(COLOR_HEX)} /></div>
            <div className="space-y-1.5"><Label>Body type</Label><Sel value={f.type} onChange={(v) => setF({ ...f, type: v as BodyType })} opts={["hatchback", "sedan", "suv", "van"]} /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label>Category</Label><Sel value={f.category} onChange={(v) => setF({ ...f, category: v as Category })} opts={["resident", "visitor", "blacklisted"]} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save}>{edit ? "Save changes" : "Register"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!del} onOpenChange={(o) => !o && setDel(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete {del && fmtPlate(del.plate)}?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This vehicle will no longer be recognised at the gate.</p>
          <DialogFooter><Button variant="outline" onClick={() => setDel(null)}>Cancel</Button><Button variant="destructive" onClick={() => { deleteVehicle(del!.id); setDel(null); toast("Vehicle deleted"); }}>Delete</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
