import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Car, TrendingUp, TrendingDown, TimerOff, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";
import { useALPR } from "@/context/ALPRContext";
import { PageHeader, Panel, PlateBadge } from "@/components/alpr/ui";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Occupancy & Traffic Analytics — smart gate ai" },
      { name: "description", content: "Live parking occupancy, hourly traffic flow, visitor mix and overstay violations." },
      { property: "og:title", content: "Occupancy & Traffic Analytics — smart gate ai" },
      { property: "og:description", content: "Live occupancy, traffic flow and overstay violations." },
    ],
  }),
  component: Analytics,
});

const CAP = 200;
const tip = { contentStyle: { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--foreground)" } };

function Analytics() {
  const { logs, passes, vehicles } = useALPR();
  const stats = useMemo(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const t0 = start.getTime(), y0 = t0 - 86400000;
    const entered = (l: (typeof logs)[number]) => l.status === "granted" || l.status === "visitor";
    const today = logs.filter((l) => l.ts >= t0 && entered(l)).length;
    const yest = logs.filter((l) => l.ts >= y0 && l.ts < t0 && entered(l)).length;
    const hourly = Array.from({ length: 24 }, (_, h) => {
      const real = logs.filter((l) => l.ts >= t0 && new Date(l.ts).getHours() === h);
      return { hour: `${String(h).padStart(2, "0")}:00`, entries: real.filter(entered).length, exits: 0 };
    });
    const residents = logs.filter((l) => l.status === "granted").length;
    const visitors = logs.filter((l) => l.status === "visitor").length;
    const delivery = 0; // Real delivery tracking not yet implemented in backend
    const overstay = passes.filter((p) => p.status === "active" && p.enteredAt && Date.now() - p.enteredAt > 4 * 3600000);
    const inside = vehicles.filter((v) => v.category === "resident").length + passes.filter((p) => p.status === "active" && p.enteredAt).length;
    return { today, yest, hourly, mix: [{ name: "Residents", value: residents }, { name: "Visitors", value: visitors }, { name: "Delivery", value: delivery }], overstay, inside };
  }, [logs, passes, vehicles]);
  const delta = stats.yest ? Math.round(((stats.today - stats.yest) / stats.yest) * 100) : 0;
  const colors = ["var(--chart-2)", "var(--chart-3)", "var(--chart-1)"];

  return (
    <div>
      <PageHeader title="Society Occupancy & Traffic Analytics" subtitle="Live security intelligence" />
      <div className="grid gap-5 md:grid-cols-3">
        <Panel title="Vehicles currently inside" icon={<Car className="h-4 w-4" />}>
          <div className="font-mono text-4xl font-bold">{stats.inside}<span className="text-lg text-muted-foreground"> / {CAP}</span></div>
          <Progress value={(stats.inside / CAP) * 100} className="mt-3" />
          <div className="mt-2 text-xs text-muted-foreground">{CAP - stats.inside} slots free</div>
        </Panel>
        <Panel title="Total entries today" icon={<TrendingUp className="h-4 w-4" />}>
          <div className="font-mono text-4xl font-bold">{stats.today}</div>
          <div className={`mt-3 flex items-center gap-1 text-sm ${delta >= 0 ? "text-success" : "text-destructive"}`}>
            {delta >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}{delta >= 0 ? "+" : ""}{delta}% vs yesterday ({stats.yest})
          </div>
        </Panel>
        <Panel title="Overstay violations" icon={<TimerOff className="h-4 w-4" />}>
          <div className="font-mono text-4xl font-bold text-warning">{stats.overstay.length}</div>
          <div className="mt-3 text-sm text-muted-foreground">Visitors past the 4-hour limit</div>
        </Panel>
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Panel title="Hourly traffic flow" className="lg:col-span-2">
          <div className="h-72">
            <ResponsiveContainer>
              <LineChart data={stats.hourly}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="hour" stroke="var(--muted-foreground)" fontSize={11} interval={2} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                <Tooltip {...tip} />
                <Legend />
                <Line type="monotone" dataKey="entries" stroke="var(--chart-1)" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="exits" stroke="var(--chart-3)" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Category distribution">
          <div className="h-72">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={stats.mix} dataKey="value" nameKey="name" innerRadius={60} outerRadius={95} paddingAngle={3} stroke="none">
                  {stats.mix.map((_, i) => <Cell key={i} fill={colors[i]} />)}
                </Pie>
                <Tooltip {...tip} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>
      <Panel title="Overstay alert list" className="mt-5">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted-foreground"><tr><th className="py-2">Plate</th><th>Guest</th><th>Flat</th><th>Time inside</th><th className="text-right">Action</th></tr></thead>
          <tbody className="divide-y divide-border">
            {stats.overstay.map((p) => {
              const m = Math.round((Date.now() - p.enteredAt!) / 60000);
              return (
                <tr key={p.id}>
                  <td className="py-2.5"><PlateBadge plate={p.plate} /></td><td>{p.guest}</td><td>{p.flat}</td>
                  <td className="font-mono text-warning">{Math.floor(m / 60)}h {m % 60}m</td>
                  <td className="text-right"><Button size="sm" variant="outline" onClick={() => toast.success(`WhatsApp sent to resident of ${p.flat}`, { description: `"Your guest ${p.guest} (${p.plate}) has exceeded the 4-hour visitor limit."` })}>
                    <MessageCircle className="h-4 w-4 text-success" />Notify Resident via WhatsApp</Button></td>
                </tr>
              );
            })}
            {!stats.overstay.length && <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">No overstay violations</td></tr>}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
