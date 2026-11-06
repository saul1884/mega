const DOW = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function parseISO(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function todayISO(): string {
  return toISO(new Date());
}

export function addDays(iso: string, n: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86400000);
}

export function shortDay(iso: string): { dow: string; date: number } {
  const d = parseISO(iso);
  return { dow: DOW[d.getDay()], date: d.getDate() };
}

export function longLabel(iso: string): string {
  const d = parseISO(iso);
  return `${DAY_LONG[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`;
}

export function weekRange(startIso: string): string {
  const a = parseISO(startIso);
  const b = parseISO(addDays(startIso, 6));
  const dow = (d: Date) => DAY_LONG[d.getDay()].slice(0, 3);
  return `${dow(a)} ${a.getDate()} – ${dow(b)} ${b.getDate()} ${MON[b.getMonth()]}`;
}

export function lastMadeText(lastMade: string | null, tried: boolean): string {
  if (!tried && !lastMade) return "Not made yet";
  if (!lastMade) return "Not made in a while";
  const days = daysBetween(lastMade, todayISO());
  if (days < 7) return "Made this week";
  const weeks = Math.floor(days / 7);
  return weeks === 1 ? "Last made 1 week ago" : `Last made ${weeks} weeks ago`;
}
