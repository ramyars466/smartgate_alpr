let ctx: AudioContext | null = null;
let alarmTimer: ReturnType<typeof setInterval> | null = null;

function ac() {
  if (typeof window === "undefined") return null;
  if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(freq: number, dur: number, type: OscillatorType = "sine", vol = 0.15, delay = 0) {
  const c = ac();
  if (!c) return;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.value = freq;
  const t = c.currentTime + delay;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t); o.stop(t + dur + 0.05);
}

export const sfx = {
  chime() { tone(880, 0.4, "sine", 0.12); tone(1320, 0.5, "sine", 0.1, 0.15); },
  warn() { tone(520, 0.25, "triangle", 0.14); tone(520, 0.25, "triangle", 0.14, 0.3); },
  deny() { tone(220, 0.5, "square", 0.08); },
  startAlarm() {
    this.stopAlarm();
    const beep = () => { tone(960, 0.22, "sawtooth", 0.12); tone(640, 0.22, "sawtooth", 0.12, 0.25); };
    beep();
    alarmTimer = setInterval(beep, 520);
  },
  stopAlarm() { if (alarmTimer) clearInterval(alarmTimer); alarmTimer = null; },
};
