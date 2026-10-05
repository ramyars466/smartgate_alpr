import { Vehicle, VisitorPass, LogEntry } from "../lib/alpr/types";

let endpoint = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";
let online = false;

export const api = {
  setEndpoint(url: string) { endpoint = url.replace(/\/$/, ""); },
  getEndpoint: () => endpoint,
  isOnline: () => online,

  async ping(): Promise<{ online: boolean; ms: number }> {
    const t = performance.now();
    try {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 1200);
      const r = await fetch(`${endpoint}/health`, { signal: ctrl.signal });
      clearTimeout(to);
      online = r.ok;
    } catch {
      online = false;
    }
    return { online, ms: Math.round(performance.now() - t) };
  },

  async call<T>(path: string, init: RequestInit | undefined, fallback: () => T): Promise<T> {
    if (!online) return fallback();
    try {
      const r = await fetch(`${endpoint}${path}`, {
        ...init,
        headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      });
      if (!r.ok) throw new Error(String(r.status));
      return (await r.json()) as T;
    } catch {
      online = false;
      return fallback();
    }
  },

  // Vehicle CRUD
  getVehicles(fallback: () => Vehicle[]) {
    return this.call<Vehicle[]>("/vehicles", { method: "GET" }, fallback);
  },
  addVehicle(v: Vehicle, fallback: () => Vehicle) {
    return this.call<Vehicle>("/vehicles", { method: "POST", body: JSON.stringify(v) }, fallback);
  },
  updateVehicle(id: string, v: Partial<Vehicle>, fallback: () => Vehicle) {
    return this.call<Vehicle>(`/vehicles/${id}`, { method: "PUT", body: JSON.stringify(v) }, fallback);
  },
  deleteVehicle(id: string, fallback: () => void) {
    return this.call<{ok: boolean}>(`/vehicles/${id}`, { method: "DELETE" }, () => { fallback(); return {ok: true}; });
  },

  // Pass CRUD
  getPasses(fallback: () => VisitorPass[]) {
    return this.call<VisitorPass[]>("/passes", { method: "GET" }, fallback);
  },
  addPass(p: VisitorPass, fallback: () => VisitorPass) {
    return this.call<VisitorPass>("/passes", { method: "POST", body: JSON.stringify(p) }, fallback);
  },
  updatePass(id: string, p: Partial<VisitorPass>, fallback: () => VisitorPass) {
    return this.call<VisitorPass>(`/passes/${id}`, { method: "PUT", body: JSON.stringify(p) }, fallback);
  },

  // Logs CRUD
  getLogs(fallback: () => LogEntry[]) {
    return this.call<LogEntry[]>("/logs", { method: "GET" }, fallback);
  },
  updateLogNote(id: string, note: string, fallback: () => void) {
    return this.call<{ok: boolean}>(`/logs/${id}`, { method: "PUT", body: JSON.stringify({ note }) }, () => { fallback(); return {ok: true}; });
  },

  scan<T>(payload: unknown, fallback: () => T) {
    return this.call<T>("/scan", { method: "POST", body: JSON.stringify(payload) }, fallback);
  },
  triggerRelay(gate: string) {
    return this.call<{ ok: boolean; mode: string }>("/relay/trigger", { method: "POST", body: JSON.stringify({ gate }) }, () => ({ ok: true, mode: "mock" }));
  },
  
  async scanImage(file: File): Promise<any> {
    if (!online) throw new Error("Offline");
    const formData = new FormData();
    formData.append("file", file);
    const r = await fetch(`${endpoint}/scan-plate`, {
      method: "POST",
      body: formData, // do not set Content-Type, let browser set boundary
    });
    if (!r.ok) throw new Error(String(r.status));
    return await r.json();
  }
};
