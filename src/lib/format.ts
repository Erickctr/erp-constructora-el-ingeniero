const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export const money = (n: number): string => fmt.format(n === 0 ? 0 : n);

export function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function todayISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export const monthOf = (iso: string): string => iso.slice(0, 7);

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function parseAmount(s: string): number {
  const n = parseFloat(s);
  return Number.isFinite(n) ? Math.round((n + Number.EPSILON) * 100) / 100 : 0;
}

