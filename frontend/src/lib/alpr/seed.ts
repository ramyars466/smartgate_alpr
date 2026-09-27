import type { LogEntry, Vehicle, VisitorPass, BodyType, LogStatus } from "./types";
import { GATES } from "./types";
import { uid } from "./utils";

const DAY = 86400000, HOUR = 3600000;

export function seedVehicles(): Vehicle[] {
  const now = Date.now();
  const rows: [string, string, string, string, string, BodyType, Vehicle["category"]][] = [
    ["KL65H4383", "Anand Menon", "A-304", "Tata Altroz", "White", "hatchback", "resident"],
    ["KL07CD1122", "Priya Nair", "B-102", "Hyundai Creta", "Black", "suv", "resident"],
    ["MH12AB4521", "Rohit Sharma", "C-501", "Honda City", "Silver", "sedan", "resident"],
    ["KA03MN7788", "Sneha Rao", "A-110", "Maruti Swift", "Red", "hatchback", "resident"],
    ["TN09BX3344", "Karthik Iyer", "D-702", "Mahindra XUV700", "Blue", "suv", "resident"],
    ["DL8CAF5030", "Neha Gupta", "B-408", "Kia Seltos", "Grey", "suv", "resident"],
    ["KL01AZ9001", "Joseph Mathew", "C-203", "Toyota Innova", "White", "van", "resident"],
    ["GJ05JK6612", "Farhan Qureshi", "D-101", "Skoda Slavia", "Brown", "sedan", "resident"],
    ["KL11BB2020", "Guest of A-304", "A-304", "Maruti Baleno", "Blue", "hatchback", "visitor"],
    ["UP16DX0666", "Unknown (FIR #221)", "—", "Toyota Fortuner", "Black", "suv", "blacklisted"],
    ["HR26ZZ1313", "Banned — Trespass", "—", "Mahindra Scorpio", "Grey", "suv", "blacklisted"],
  ];
  return rows.map(([plate, owner, flat, make, color, type, category], i) => ({
    id: uid(), plate, owner, flat, make, color, type, category, registeredAt: now - (i * 37 + 12) * DAY,
  }));
}

export function seedPasses(): VisitorPass[] {
  const now = Date.now();
  return [
    { id: uid(), guest: "Arjun Pillai", phone: "+91 98470 11223", plate: "KL11BB2020", flat: "A-304", entryAt: now - HOUR, expiresAt: now + 5 * HOUR, status: "active" },
    { id: uid(), guest: "Meera Das", phone: "+91 90000 45454", plate: "KA51EE4040", flat: "C-501", entryAt: now - 6 * HOUR, expiresAt: now + 2 * HOUR, status: "active", enteredAt: now - 5.5 * HOUR },
    { id: uid(), guest: "Swiggy Delivery", phone: "+91 80880 12121", plate: "KL07DL5566", flat: "B-102", entryAt: now - 5 * HOUR, expiresAt: now + 3 * HOUR, status: "active", enteredAt: now - 4.8 * HOUR },
  ];
}

export function seedLogs(vehicles: Vehicle[]): LogEntry[] {
  const now = Date.now();
  const logs: LogEntry[] = [];
  const unknown = ["MH04ZX8123", "KL10QQ0909", "TN22AA7171"];
  for (let i = 0; i < 70; i++) {
    const r = Math.random();
    let status: LogStatus;
    let v: Vehicle | undefined;
    if (r < 0.55) { status = "granted"; v = vehicles.filter((x) => x.category === "resident")[i % 8]; }
    else if (r < 0.78) { status = "visitor"; v = vehicles.find((x) => x.category === "visitor"); }
    else if (r < 0.9) status = "denied";
    else if (r < 0.95) { status = "overstay"; v = vehicles.find((x) => x.category === "visitor"); }
    else { status = "blacklisted"; v = vehicles.filter((x) => x.category === "blacklisted")[i % 2]; }
    const plate = v?.plate ?? unknown[i % 3];
    logs.push({
      id: uid(), ts: now - i * 47 * 60000 - Math.random() * 20 * 60000, gate: GATES[i % 3], plate, ocr: plate, status,
      note: status === "blacklisted" ? "Security dispatched, vehicle held" : status === "denied" ? "Driver redirected to visitor desk" : status === "overstay" ? "Exceeded 4h visitor limit" : "Auto",
      make: v?.make ?? "Maruti Dzire", color: v?.color ?? "White", type: v?.type ?? "sedan",
      yolo: 92 + Math.random() * 7.5, ocrConf: 85 + Math.random() * 14, speed: Math.round(90 + Math.random() * 60),
      durationMin: status === "denied" ? null : Math.round(20 + Math.random() * 400),
    });
  }
  return logs;
}
