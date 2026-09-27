export type Category = "resident" | "visitor" | "blacklisted";
export type BodyType = "hatchback" | "sedan" | "suv" | "van";
export type LogStatus = "granted" | "visitor" | "denied" | "blacklisted" | "overstay";
export type ScanKind = "resident" | "visitor" | "denied" | "blacklisted" | "fuzzy" | "mismatch";

export interface Vehicle {
  id: string;
  plate: string; // normalized, no spaces
  owner: string;
  flat: string;
  make: string;
  color: string;
  type: BodyType;
  category: Category;
  registeredAt: number;
}

export interface VisitorPass {
  id: string;
  guest: string;
  phone: string;
  plate: string;
  flat: string;
  entryAt: number;
  expiresAt: number;
  status: "active" | "revoked";
  enteredAt?: number;
}

export interface LogEntry {
  id: string;
  ts: number;
  gate: string;
  plate: string;
  ocr: string;
  status: LogStatus;
  note: string;
  make: string;
  color: string;
  type: BodyType;
  yolo: number;
  ocrConf: number;
  speed: number;
  durationMin: number | null;
  imageUrl?: string;
}

export interface Detected {
  make: string;
  color: string;
  type: BodyType;
}

export interface ScanResult {
  id: string;
  kind: ScanKind;
  ocr: string;
  plate: string;
  detected: Detected;
  vehicle?: Vehicle;
  pass?: VisitorPass;
  matchPct?: number;
  yolo: number;
  ocrConf: number;
  speed: number;
  imageUrl?: string;
  resolved?: boolean;
  ts: number;
}

export const GATES = ["Main Gate - Entry", "North Gate - Exit", "Service Gate"] as const;
