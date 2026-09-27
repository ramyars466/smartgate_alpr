// All backend calls go through here. If the FastAPI server responds, live data is used;
// otherwise every call resolves via the provided mock fallback so the UI never breaks.
let endpoint = "http://localhost:8000/api/v1";
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

  scan<T>(payload: unknown, fallback: () => T) {
    return this.call<T>("/scan", { method: "POST", body: JSON.stringify(payload) }, fallback);
  },
  triggerRelay(gate: string) {
    return this.call<{ ok: boolean; mode: string }>("/relay/trigger", { method: "POST", body: JSON.stringify({ gate }) }, () => ({ ok: true, mode: "mock" }));
  },
};
