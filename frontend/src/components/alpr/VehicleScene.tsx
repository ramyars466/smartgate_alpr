import type { BodyType } from "@/lib/alpr/types";
import { COLOR_HEX, fmtPlate } from "@/lib/alpr/utils";

/** Stylised front-view vehicle render with plate at a known position so the detection box aligns. */
export function VehicleScene({
  color = "White", type = "sedan", plate = "", box = true, boxColor = "var(--success)", muddy = false, className = "", label,
}: { color?: string; type?: BodyType; plate?: string; box?: boolean; boxColor?: string; muddy?: boolean; className?: string; label?: string }) {
  const body = COLOR_HEX[color] ?? "#9ca3af";
  const tall = type === "suv" || type === "van" ? 30 : type === "hatchback" ? 12 : 0;
  return (
    <svg viewBox="0 0 400 240" className={className} role="img" aria-label={`${color} ${type} ${plate}`}>
      <defs>
        <linearGradient id="road" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0f172a" /><stop offset="1" stopColor="#1e293b" />
        </linearGradient>
      </defs>
      <rect width="400" height="240" fill="url(#road)" />
      <rect x="0" y="200" width="400" height="40" fill="#111827" />
      <line x1="200" y1="205" x2="200" y2="240" stroke="#facc15" strokeWidth="3" strokeDasharray="8 6" />
      <g>
        <rect x="110" y={70 - tall} width="180" height={60 + tall} rx="26" fill={body} opacity="0.95" />
        <rect x="130" y={80 - tall} width="140" height={36 + tall * 0.4} rx="10" fill="#0b1220" opacity="0.85" />
        <rect x="80" y="118" width="240" height="70" rx="18" fill={body} />
        <circle cx="112" cy="140" r="12" fill="#fef9c3" /><circle cx="288" cy="140" r="12" fill="#fef9c3" />
        <rect x="150" y="128" width="100" height="14" rx="4" fill="#111827" opacity="0.7" />
        <rect x="90" y="186" width="34" height="22" rx="5" fill="#0b0f17" /><rect x="276" y="186" width="34" height="22" rx="5" fill="#0b0f17" />
        {/* plate */}
        <rect x="150" y="152" width="100" height="26" rx="3" fill="#f8fafc" stroke="#111827" strokeWidth="2" />
        <text x="200" y="170" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontWeight="700" fontSize="13" fill="#0b0f17">
          {fmtPlate(plate)}
        </text>
        {muddy && <><ellipse cx="228" cy="166" rx="16" ry="9" fill="#78350f" opacity="0.75" /><ellipse cx="165" cy="158" rx="9" ry="5" fill="#78350f" opacity="0.55" /></>}
      </g>
      {box && (
        <g>
          <rect x="144" y="146" width="112" height="38" fill="none" stroke={boxColor} strokeWidth="2.5" />
          <rect x="144" y="130" width="84" height="16" fill={boxColor} />
          <text x="148" y="142" fontFamily="JetBrains Mono, monospace" fontSize="10" fill="#0b0f17" fontWeight="700">{label ?? "plate 0.98"}</text>
        </g>
      )}
    </svg>
  );
}

/** Cropped plate preview */
export function PlateCrop({ plate, muddy }: { plate: string; muddy?: boolean }) {
  return (
    <svg viewBox="0 0 200 52" className="w-full rounded-md">
      <rect width="200" height="52" fill="#f8fafc" stroke="#111827" strokeWidth="3" rx="4" />
      <text x="100" y="35" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontWeight="800" fontSize="24" fill="#0b0f17">{fmtPlate(plate)}</text>
      {muddy && <ellipse cx="140" cy="26" rx="22" ry="14" fill="#78350f" opacity="0.7" />}
    </svg>
  );
}
