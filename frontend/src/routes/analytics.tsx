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
    const overstay = passes.filter((p) => p.status === "active" && p.enteredAt && !p.exitedAt && Date.now() - p.enteredAt > 4 * 3600000);
    const activeInside = passes.filter((p) => p.status === "active" && p.enteredAt && !p.exitedAt);
    const inside = vehicles.filter((v) => v.category === "resident").length + activeInside.length;
    return { today, yest, hourly, mix: [{ name: "Residents", value: residents }, { name: "Visitors", value: visitors }, { name: "Delivery", value: delivery }], overstay, inside, activeInside };
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
      <Panel title="Live Visitor Tracking & Overstays" icon={<TimerOff className="h-4 w-4" />} className="mt-5">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs uppercase text-muted-foreground">
              <tr>
                <th className="pb-2 font-medium">Plate</th>
                <th className="pb-2 font-medium">Visitor Name</th>
                <th className="pb-2 font-medium">Flat</th>
                <th className="pb-2 font-medium">Time Inside</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {stats.activeInside.length === 0 ? (
                <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">No visitors currently inside.</td></tr>
              ) : (
                stats.activeInside.map((p) => {
                  const m = p.enteredAt ? Math.round((Date.now() - p.enteredAt) / 60000) : 0;
                  const isOverstay = m > 240;
                  return (
                    <tr key={p.id} className={isOverstay ? "bg-destructive/10" : ""}>
                      <td className="py-3 pr-4"><PlateBadge plate={p.plate} /></td>
                      <td className="py-3 pr-4 font-medium">{p.guest}</td>
                      <td className="py-3 pr-4">{p.flat}</td>
                      <td className="py-3 pr-4 font-mono">{Math.floor(m / 60)}h {m % 60}m</td>
                      <td className="py-3 pr-4">
                        {isOverstay ? (
                          <span className="flex items-center gap-1 font-bold text-destructive">
                            <TimerOff className="h-4 w-4" /> OVERSTAY
                          </span>
                        ) : (
                          <span className="font-semibold text-success">Inside</span>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        {isOverstay && (
                          <Button size="sm" variant="outline" className="h-8 gap-2 border-destructive text-destructive hover:bg-destructive/20" onClick={() => toast.success(`WhatsApp sent to flat ${p.flat}`)}>
                            <MessageCircle className="h-3 w-3" /> Notify
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
