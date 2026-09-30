import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Server, Video, Activity, Cpu, Zap, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { ResponsiveContainer, AreaChart, Area, YAxis, Tooltip } from "recharts";
import { useALPR } from "@/context/ALPRContext";
import { PageHeader, Panel } from "@/components/alpr/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/services/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/config")({
  head: () => ({
    meta: [
      { title: "System & Hardware Config — smart gate ai" },
      { name: "description", content: "Configure the FastAPI endpoint, RTSP camera stream, WebSocket monitoring and IoT gate relay." },
      { property: "og:title", content: "System & Hardware Config — smart gate ai" },
      { property: "og:description", content: "Configure backend, camera stream and gate relay hardware." },
    ],
  }),
  component: Config,
});

function Config() {
  const { endpoint, setEndpoint, rtspUrl, setRtspUrl, latency, backendOnline, gate, openBarrier, resetData } = useALPR();
  const [ep, setEp] = useState(endpoint);
  const [rtsp, setRtsp] = useState(rtspUrl);
  const [relayLog, setRelayLog] = useState<string[]>([]);
  const [firing, setFiring] = useState(false);
  const data = latency.map((ms, i) => ({ i, ms }));
  const avg = Math.round(latency.reduce((a, b) => a + b, 0) / latency.length);
  const stamp = () => new Date().toLocaleTimeString("en-IN", { hour12: false });

  const testRelay = async () => {
    setFiring(true);
    const log = (s: string) => setRelayLog((l) => [`[${stamp()}] ${s}`, ...l].slice(0, 12));
    log(`POST ${endpoint}/relay/trigger { gate: "${gate}" }`);
    const r = await api.triggerRelay(gate);
    log(`Raspberry Pi GPIO17 → HIGH (${r.mode})`);
    openBarrier(5);
    setTimeout(() => log("Servo SG90 rotated 90° · barrier OPEN"), 400);
    setTimeout(() => { log("Relay released · GPIO17 → LOW"); setFiring(false); toast.success("Relay test OK"); }, 1400);
  };

  return (
    <div>
      <PageHeader title="System & Hardware API Configuration" subtitle="Backend, camera and IoT controller settings" />
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="FastAPI backend" icon={<Server className="h-4 w-4" />}>
          <Label>Endpoint</Label>
          <div className="mt-1.5 flex gap-2">
            <Input className="font-mono" value={ep} onChange={(e) => setEp(e.target.value)} />
            <Button onClick={() => { setEndpoint(ep); toast("Testing connection…"); }}>Save & Test</Button>
          </div>
          <div className={cn("mt-3 text-sm", backendOnline ? "text-success" : "text-warning")}>
            {backendOnline ? "Connected — live data from FastAPI" : "Backend unreachable — running on built-in mock engine"}
          </div>
        </Panel>
        <Panel title="RTSP camera stream" icon={<Video className="h-4 w-4" />}>
          <Label>Stream URL</Label>
          <div className="mt-1.5 flex gap-2">
            <Input className="font-mono" value={rtsp} onChange={(e) => setRtsp(e.target.value)} />
            <Button onClick={() => { setRtspUrl(rtsp); toast.success("Stream URL saved"); }}>Save</Button>
          </div>
          <div className="mt-3 text-sm text-muted-foreground">Used by the Live Gate Monitor feed (CAM-01).</div>
        </Panel>
        <Panel title="WebSocket status monitor" icon={<Activity className="h-4 w-4" />} actions={<span className="font-mono text-xs text-success">avg {avg} ms</span>}>
          <div className="h-40">
            <ResponsiveContainer>
              <AreaChart data={data}>
                <YAxis stroke="var(--muted-foreground)" fontSize={11} width={30} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} formatter={(v) => [`${v} ms`, "Ping"]} labelFormatter={() => ""} />
                <Area type="monotone" dataKey="ms" stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.2} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">ws://…/ws/events · heartbeat every 2 s</div>
        </Panel>
        <Panel title="IoT relay test" icon={<Cpu className="h-4 w-4" />}>
          <p className="text-sm text-muted-foreground">Sends a trigger to the Raspberry Pi / servo gate controller for <b className="text-foreground">{gate}</b>.</p>
          <Button className="mt-3" onClick={testRelay} disabled={firing}><Zap className="h-4 w-4" />{firing ? "Triggering…" : "Test Relay Trigger"}</Button>
          <pre className="mt-3 h-36 overflow-auto rounded-md border border-border bg-background/60 p-3 font-mono text-xs text-muted-foreground">{relayLog.join("\n") || "No relay events yet."}</pre>
        </Panel>
      </div>
    </div>
  );
}
