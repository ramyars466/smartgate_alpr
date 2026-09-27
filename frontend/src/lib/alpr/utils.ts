export const normPlate = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

export function fmtPlate(p: string) {
  const n = normPlate(p);
  const m = n.match(/^([A-Z]{2})(\d{1,2})([A-Z]{0,3})(\d{1,4})$/);
  if (!m) return n;
  return [m[1], m[2], m[3], m[4]].filter(Boolean).join(" ");
}

export function similarity(a: string, b: string) {
  const s = normPlate(a), t = normPlate(b);
  const d: number[][] = Array.from({ length: s.length + 1 }, (_, i) => [i, ...Array(t.length).fill(0)]);
  for (let j = 1; j <= t.length; j++) d[0][j] = j;
  for (let i = 1; i <= s.length; i++)
    for (let j = 1; j <= t.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (s[i - 1] === t[j - 1] ? 0 : 1));
  const max = Math.max(s.length, t.length) || 1;
  return 1 - d[s.length][t.length] / max;
}

export const uid = () => Math.random().toString(36).slice(2, 10);

export const fmtTime = (t: number) =>
  new Date(t).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" });
export const fmtDateTime = (t: number) =>
  new Date(t).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
export const fmtDate = (t: number) =>
  new Date(t).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" });

export const COLOR_HEX: Record<string, string> = {
  White: "#e5e7eb", Black: "#1f2937", Silver: "#9ca3af", Red: "#dc2626", Blue: "#2563eb",
  Grey: "#6b7280", Brown: "#78350f", Green: "#15803d", Yellow: "#eab308", Orange: "#ea580c",
};
