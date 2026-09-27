import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import type { Detected, LogEntry, LogStatus, ScanResult, Vehicle, VisitorPass } from "@/lib/alpr/types";
import { GATES } from "@/lib/alpr/types";
import { seedLogs, seedPasses, seedVehicles } from "@/lib/alpr/seed";
import { normPlate, similarity, uid, fmtPlate } from "@/lib/alpr/utils";
import { sfx } from "@/lib/alpr/audio";
import { api } from "@/services/api";

const KEY = "smartgate-alpr-v1";

export type SimKind = "resident" | "visitor" | "denied" | "blacklisted" | "fuzzy" | "mismatch";

interface Barrier { open: boolean; closesAt: number | null; override: boolean }

interface Ctx {
  vehicles: Vehicle[];
  passes: VisitorPass[];
  logs: LogEntry[];
  gate: string;
  setGate: (g: string) => void;
  muted: boolean;
  setMuted: (m: boolean) => void;
  latency: number[];
  backendOnline: boolean;
  endpoint: string;
  setEndpoint: (s: string) => void;
  rtspUrl: string;
  setRtspUrl: (s: string) => void;
  barrier: Barrier;
  openBarrier: (sec?: number) => void;
  toggleOverride: () => void;
  current: ScanResult | null;
  criticalAlert: ScanResult | null;
  dismissAlert: () => void;
  scan: (ocr: string, detected: Detected, imageUrl?: string) => Promise<ScanResult>;
  simulate: (k: SimKind) => void;
  confirmFuzzy: () => void;
  addVehicle: (v: Omit<Vehicle, "id" | "registeredAt">) => void;
  updateVehicle: (id: string, v: Partial<Vehicle>) => void;
  deleteVehicle: (id: string) => void;
  toggleBlacklist: (id: string) => void;
  addPass: (p: Omit<VisitorPass, "id" | "status">) => VisitorPass;
  revokePass: (id: string) => void;
  extendPass: (id: string, hours: number) => void;
  updateLogNote: (id: string, note: string) => void;
  resetData: () => void;
}

const ALPRContext = createContext<Ctx | null>(null);

export const SIM_SAMPLES: Record<SimKind, { ocr: string; detected: Detected; label: string }> = {
  resident: { ocr: "KL65H4383", detected: { make: "Tata Altroz", color: "White", type: "hatchback" }, label: "Resident Car" },
  visitor: { ocr: "KL11BB2020", detected: { make: "Maruti Baleno", color: "Blue", type: "hatchback" }, label: "Visitor Car" },
  denied: { ocr: "MH04ZX8123", detected: { make: "Maruti Dzire", color: "White", type: "sedan" }, label: "Unknown Car" },
  blacklisted: { ocr: "UP16DX0666", detected: { make: "Toyota Fortuner", color: "Black", type: "suv" }, label: "Stolen Plate" },
  fuzzy: { ocr: "KL65H43B3", detected: { make: "Tata Altroz", color: "White", type: "hatchback" }, label: "Muddy / Damaged Plate" },
  mismatch: { ocr: "KL65H4383", detected: { make: "Toyota Fortuner", color: "Black", type: "suv" }, label: "Cloned Plate" },
};

export function ALPRProvider({ children }: { children: ReactNode }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [passes, setPasses] = useState<VisitorPass[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [gate, setGate] = useState<string>(GATES[0]);
  const [muted, setMuted] = useState(false);
  const [latency, setLatency] = useState<number[]>([18]);
  const [backendOnline, setBackendOnline] = useState(false);
  const [endpoint, setEndpointState] = useState(api.getEndpoint());
  const [rtspUrl, setRtspUrl] = useState("rtsp://192.168.1.100:554/stream1");
  const [barrier, setBarrier] = useState<Barrier>({ open: false, closesAt: null, override: false });
  const [current, setCurrent] = useState<ScanResult | null>(null);
  const [criticalAlert, setCriticalAlert] = useState<ScanResult | null>(null);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  // load / seed
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw);
        setVehicles(d.vehicles); setPasses(d.passes); setLogs(d.logs);
        if (d.endpoint) { setEndpointState(d.endpoint); api.setEndpoint(d.endpoint); }
        if (d.rtspUrl) setRtspUrl(d.rtspUrl);
        setLoaded(true);
        return;
      }
    } catch { /* reseed */ }
    const v = seedVehicles();
    setVehicles(v); setPasses(seedPasses()); setLogs(seedLogs(v)); setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(KEY, JSON.stringify({ vehicles, passes, logs: logs.slice(0, 500), endpoint, rtspUrl }));
  }, [vehicles, passes, logs, endpoint, rtspUrl, loaded]);

  // websocket heartbeat simulation + backend ping
  useEffect(() => {
    const t = setInterval(() => {
      setLatency((l) => [...l.slice(-39), Math.round(12 + Math.random() * 14 + (Math.random() < 0.05 ? 40 : 0))]);
    }, 2000);
    const p = setInterval(async () => setBackendOnline((await api.ping()).online), 15000);
    void api.ping().then((r) => setBackendOnline(r.online));
    return () => { clearInterval(t); clearInterval(p); };
  }, []);

  // barrier auto close
  useEffect(() => {
    if (!barrier.open || barrier.override || !barrier.closesAt) return;
    const t = setTimeout(() => setBarrier({ open: false, closesAt: null, override: false }), barrier.closesAt - Date.now());
    return () => clearTimeout(t);
  }, [barrier]);

  const openBarrier = useCallback((sec = 5) => {
    setBarrier((b) => (b.override ? b : { open: true, closesAt: Date.now() + sec * 1000, override: false }));
  }, []);

  const toggleOverride = useCallback(() => {
    setBarrier((b) => {
      const next = !b.override;
      toast[next ? "warning" : "success"](next ? "EMERGENCY OVERRIDE: all barriers held open" : "Override released — normal operation");
      return next ? { open: true, closesAt: null, override: true } : { open: false, closesAt: null, override: false };
    });
  }, []);

  const pushLog = useCallback((r: ScanResult, status: LogStatus, note: string) => {
    setLogs((l) => [{
      id: uid(), ts: Date.now(), gate, plate: r.vehicle?.plate ?? r.pass?.plate ?? r.plate, ocr: r.ocr, status, note,
      make: r.detected.make, color: r.detected.color, type: r.detected.type,
      yolo: r.yolo, ocrConf: r.ocrConf, speed: r.speed, durationMin: null, imageUrl: r.imageUrl,
    }, ...l]);
  }, [gate]);

  const play = (fn: () => void) => { if (!mutedRef.current) fn(); };

  const classify = useCallback((ocr: string, detected: Detected, imageUrl?: string): ScanResult => {
    const plate = normPlate(ocr);
    const base = {
      id: uid(), ocr: plate, plate, detected, imageUrl, ts: Date.now(),
      yolo: +(94 + Math.random() * 5.4).toFixed(1), ocrConf: +(89 + Math.random() * 9).toFixed(1), speed: Math.round(95 + Math.random() * 40),
    };
    const v = vehicles.find((x) => x.plate === plate);
    if (v?.category === "blacklisted") return { ...base, kind: "blacklisted", vehicle: v };
    const pass = passes.find((p) => p.status === "active" && p.plate === plate && p.expiresAt > Date.now());
    if (v && v.category === "resident") {
      if (v.type !== detected.type || v.color !== detected.color) return { ...base, kind: "mismatch", vehicle: v };
      return { ...base, kind: "resident", vehicle: v };
    }
    if (pass || v?.category === "visitor") return { ...base, kind: "visitor", vehicle: v, pass };
    let best: Vehicle | undefined, score = 0;
    for (const x of vehicles) {
      if (x.category === "blacklisted") continue;
      const s = similarity(plate, x.plate);
      if (s > score) { score = s; best = x; }
    }
    if (best && score >= 0.8) return { ...base, kind: "fuzzy", vehicle: best, matchPct: Math.round(score * 100 + 0.5 * 0), ocrConf: 71.3 };
    return { ...base, kind: "denied" };
  }, [vehicles, passes]);

  const scan = useCallback(async (ocr: string, detected: Detected, imageUrl?: string) => {
    const r = await api.scan<ScanResult>({ ocr, detected, gate }, () => classify(ocr, detected, imageUrl));
    setCurrent(r);
    switch (r.kind) {
      case "resident": play(sfx.chime); openBarrier(5); pushLog(r, "granted", "Resident auto-access"); break;
      case "visitor": play(sfx.chime); openBarrier(5); pushLog(r, "visitor", `Visitor for ${r.pass?.flat ?? r.vehicle?.flat ?? "—"}`);
        if (r.pass) setPasses((ps) => ps.map((p) => (p.id === r.pass!.id ? { ...p, enteredAt: Date.now() } : p))); break;
      case "denied": play(sfx.deny); pushLog(r, "denied", "Unregistered vehicle"); break;
      case "mismatch": play(sfx.warn); pushLog(r, "denied", "Plate / vehicle type mismatch — possible cloned plate"); break;
      case "fuzzy": play(sfx.warn); break;
      case "blacklisted": if (!mutedRef.current) sfx.startAlarm(); setCriticalAlert(r); pushLog(r, "blacklisted", "BLACKLIST HIT — security dispatched"); break;
    }
    return r;
  }, [classify, gate, openBarrier, pushLog]);

  const simulate = useCallback((k: SimKind) => { const s = SIM_SAMPLES[k]; void scan(s.ocr, s.detected); }, [scan]);

  const confirmFuzzy = useCallback(() => {
    setCurrent((c) => {
      if (!c || c.kind !== "fuzzy" || c.resolved) return c;
      const fixed = { ...c, resolved: true, plate: c.vehicle!.plate };
      play(sfx.chime); openBarrier(5);
      pushLog(fixed, "granted", `Guard confirmed OCR correction ${fmtPlate(c.ocr)} → ${fmtPlate(c.vehicle!.plate)}`);
      toast.success(`Access granted to ${fmtPlate(c.vehicle!.plate)}`);
      return fixed;
    });
  }, [openBarrier, pushLog]);

  const dismissAlert = useCallback(() => { sfx.stopAlarm(); setCriticalAlert(null); }, []);
  useEffect(() => { if (muted) sfx.stopAlarm(); else if (criticalAlert) sfx.startAlarm(); }, [muted]); // eslint-disable-line

  const value: Ctx = useMemo(() => ({
    vehicles, passes, logs, gate, setGate, muted, setMuted, latency, backendOnline,
    endpoint, setEndpoint: (s) => { setEndpointState(s); api.setEndpoint(s); void api.ping().then((r) => setBackendOnline(r.online)); },
    rtspUrl, setRtspUrl, barrier, openBarrier, toggleOverride, current, criticalAlert, dismissAlert, scan, simulate, confirmFuzzy,
    addVehicle: (v) => setVehicles((vs) => [{ ...v, plate: normPlate(v.plate), id: uid(), registeredAt: Date.now() }, ...vs]),
    updateVehicle: (id, v) => setVehicles((vs) => vs.map((x) => (x.id === id ? { ...x, ...v, plate: normPlate(v.plate ?? x.plate) } : x))),
    deleteVehicle: (id) => setVehicles((vs) => vs.filter((x) => x.id !== id)),
    toggleBlacklist: (id) => setVehicles((vs) => vs.map((x) => (x.id === id ? { ...x, category: x.category === "blacklisted" ? "resident" : "blacklisted" } : x))),
    addPass: (p) => { const np: VisitorPass = { ...p, plate: normPlate(p.plate), id: uid(), status: "active" }; setPasses((ps) => [np, ...ps]); return np; },
    revokePass: (id) => setPasses((ps) => ps.map((p) => (p.id === id ? { ...p, status: "revoked" } : p))),
    extendPass: (id, h) => setPasses((ps) => ps.map((p) => (p.id === id ? { ...p, expiresAt: Math.max(p.expiresAt, Date.now()) + h * 3600000 } : p))),
    updateLogNote: (id, note) => setLogs((ls) => ls.map((l) => (l.id === id ? { ...l, note } : l))),
    resetData: () => { const v = seedVehicles(); setVehicles(v); setPasses(seedPasses()); setLogs(seedLogs(v)); toast.success("Demo data reset"); },
  }), [vehicles, passes, logs, gate, muted, latency, backendOnline, endpoint, rtspUrl, barrier, openBarrier, toggleOverride, current, criticalAlert, dismissAlert, scan, simulate, confirmFuzzy]);

  if (!loaded) return null;
  return <ALPRContext.Provider value={value}>{children}</ALPRContext.Provider>;
}

export function useALPR() {
  const c = useContext(ALPRContext);
  if (!c) throw new Error("useALPR must be inside ALPRProvider");
  return c;
}
