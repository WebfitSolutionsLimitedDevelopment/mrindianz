export const NZ_TZ = "Pacific/Auckland";

/** Format integer cents as NZD without floating-point arithmetic on stored values. */
export function formatCents(cents: number, currency = "NZD"): string {
  if (!Number.isInteger(cents)) throw new Error("cents must be an integer");
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100).toLocaleString("en-NZ");
  const rem = String(abs % 100).padStart(2, "0");
  const prefix = currency === "NZD" ? "NZ$" : `${currency} `;
  return `${negative ? "-" : ""}${prefix}${dollars}.${rem}`;
}

export function formatNzDateTime(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = {}) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-NZ", {
    timeZone: NZ_TZ, day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", ...opts,
  }).format(new Date(iso));
}

export function formatNzDate(iso: string | null | undefined) {
  if (!iso) return "—";
  // Date-only values are calendar dates already in NZ — format without any timezone shift.
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return new Intl.DateTimeFormat("en-NZ", { timeZone: "UTC", weekday: "short", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${iso}T00:00:00Z`));
  }
  return new Intl.DateTimeFormat("en-NZ", { timeZone: NZ_TZ, weekday: "short", day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
}

/** Days from `now` until an NZ calendar date (counting by NZ local date). */
export function daysUntilNzDate(isoDate: string, now = new Date()): number {
  const todayNz = new Intl.DateTimeFormat("en-CA", { timeZone: NZ_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const a = Date.UTC(...(todayNz.split("-").map(Number) as [number, number, number]).map((v, i) => (i === 1 ? v - 1 : v)) as [number, number, number]);
  const [y, m, d] = isoDate.split("-").map(Number);
  const b = Date.UTC(y, m - 1, d);
  return Math.round((b - a) / 86_400_000);
}

/** Convert a datetime-local value entered in NZ time to an ISO UTC string. */
export function nzLocalToIso(local: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null;
  const [date, time] = local.split("T");
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  // Find the UTC instant whose NZ wall-clock equals the input (handles DST).
  let guess = Date.UTC(y, mo - 1, d, h, mi) - 13 * 3600_000;
  for (let i = 0; i < 3; i++) {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-CA", { timeZone: NZ_TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
        .formatToParts(new Date(guess)).map((p) => [p.type, p.value]),
    );
    const wall = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
    const target = Date.UTC(y, mo - 1, d, h, mi);
    guess += target - wall;
  }
  return new Date(guess).toISOString();
}

export function isoToNzLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: NZ_TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
      .formatToParts(new Date(iso)).map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function paragraphs(text: string | null | undefined): string[] {
  return (text ?? "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
}
