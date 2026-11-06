import type { ReactNode } from "react";

type Shape = { bg: string; fg: string; hdr: string; hfg: string; d: string };

const SHAPES: Record<string, Shape> = {
  "Slow cooker specials": { bg: "#F7922A", fg: "#C8175D", hdr: "hdr hdr-orange", hfg: "#C8175D", d: "M10 22h32v12a8 8 0 0 1-8 8H18a8 8 0 0 1-8-8z M7 21h38v4H7z M21 14h10v6H21z" },
  "One pan weekday": { bg: "#C8175D", fg: "#FFF1C9", hdr: "hdr hdr-rasp", hfg: "#FFF1C9", d: "M9 28a13 13 0 1 0 26 0a13 13 0 1 0 -26 0z M34 25h11a3 3 0 0 1 0 6H34z" },
  "Healthy AF": { bg: "#EC4D6B", fg: "#2A0F1C", hdr: "hdr hdr-pink", hfg: "#2A0F1C", d: "M12 40C12 22 24 13 41 11c0 19-11 31-29 29z" },
  BBQ: { bg: "#2A0F1C", fg: "#F7922A", hdr: "hdr hdr-ink", hfg: "#F7922A", d: "M26 8c6 9 13 15 13 24a13 13 0 0 1-26 0c0-6 3-10 6-13 0 5 2 7 5 7-1-7 0-12 2-18z" },
  "Weekend specials": { bg: "#F7922A", fg: "#2A0F1C", hdr: "hdr hdr-orange", hfg: "#C8175D", d: "M26 9l5 12 13 1-10 8 3 13-11-7-11 7 3-13-10-8 13-1z" },
  "A little bit fancy": { bg: "#2A0F1C", fg: "#EC4D6B", hdr: "hdr hdr-ink", hfg: "#EC4D6B", d: "M26 8l14 18-14 18-14-18z" },
  "Solo night in": { bg: "#C8175D", fg: "#FFF1C9", hdr: "hdr hdr-rasp", hfg: "#FFF1C9", d: "M30 10a16 16 0 1 0 12 26a13 13 0 0 1-12-26z" },
  "Obie meals": { bg: "#EC4D6B", fg: "#FFF1C9", hdr: "hdr hdr-pink", hfg: "#FFF1C9", d: "M10 26a16 16 0 1 0 32 0a16 16 0 1 0 -32 0z" },
};
const FALLBACK: Shape = { bg: "#F7922A", fg: "#2A0F1C", hdr: "hdr hdr-orange", hfg: "#C8175D", d: "M14 30a12 12 0 0 1 24 0z M10 32h32v4H10z M24 14h4v6h-4z" };

export function shapeFor(tag: string | undefined): Shape {
  return (tag && SHAPES[tag]) || FALLBACK;
}

const TILE_CLASSES = ["tile t-orange", "tile t-rasp", "tile t-pink", "tile t-ink", "tile t-rasp", "tile t-orange", "tile t-ink"];
export function tileClass(cat: string, index: number): string {
  if (cat === "Obie meals") return "tile t-dash";
  return TILE_CLASSES[index % TILE_CLASSES.length];
}

export function Thumb({ tag, size = 52 }: { tag?: string; size?: number }) {
  const s = shapeFor(tag);
  return (
    <svg width={size} height={size} viewBox="0 0 52 52" aria-hidden="true" style={{ flexShrink: 0 }}>
      <rect width="52" height="52" rx="14" fill={s.bg} />
      <path d={s.d} fill={s.fg} />
    </svg>
  );
}

function Stroke({ children, size = 24, width = 2.4 }: { children: ReactNode; size?: number; width?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export const Icon = {
  arrow: () => <Stroke width={2.5}><path d="M5 12h14M13 6l6 6-6 6" /></Stroke>,
  back: () => <Stroke size={22} width={2.6}><path d="M15 5l-7 7 7 7" /></Stroke>,
  plus: ({ size = 22 }: { size?: number }) => <Stroke size={size} width={2.8}><path d="M12 5v14M5 12h14" /></Stroke>,
  x: ({ size = 20 }: { size?: number }) => <Stroke size={size} width={2.6}><path d="M6 6l12 12M18 6L6 18" /></Stroke>,
  tick: ({ size = 22 }: { size?: number }) => <Stroke size={size} width={3}><path d="M5 12l5 5 9-10" /></Stroke>,
  home: () => <Stroke><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></Stroke>,
  list: () => <Stroke width={2.2}><path d="M4 5h16M4 12h16M4 19h10" /></Stroke>,
  bulb: () => <Stroke width={2.2}><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z" /></Stroke>,
  bag: () => <Stroke width={2.2}><path d="M4 8h16l-1.5 11a2 2 0 0 1-2 1.7h-9a2 2 0 0 1-2-1.7z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></Stroke>,
  camera: () => <Stroke size={20} width={2.2}><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></Stroke>,
};

export function LoginArt() {
  return (
    <svg viewBox="0 0 334 280" width="100%" style={{ maxWidth: 334, display: "block" }} aria-hidden="true">
      <path d="M28 78 C 70 40, 140 46, 176 92 C 140 76, 84 82, 40 108 Z" fill="#C8175D" />
      <path d="M168 84 C 176 70, 186 64, 198 64 L 198 74 C 188 74, 182 80, 178 90 Z" fill="#C8175D" />
      <path d="M262 30 C 292 30 314 62 308 94 C 303 120 280 132 262 132 C 244 132 221 120 216 94 C 210 62 232 30 262 30 Z" fill="#C8175D" />
      <path d="M257 6 h10 v30 h-10 z" fill="#C8175D" />
      <path d="M262 44 C 254 64 254 104 262 126" fill="none" stroke="#F7922A" strokeWidth="5" strokeLinecap="round" />
      <circle cx="132" cy="186" r="86" fill="#C8175D" />
      <rect x="210" y="174" width="118" height="26" rx="13" fill="#C8175D" />
      <path d="M92 176 C 86 144 134 132 162 148 C 196 166 190 220 156 232 C 118 244 98 216 92 176 Z" fill="#FFF1C9" />
      <circle cx="138" cy="184" r="21" fill="#F7922A" />
    </svg>
  );
}
