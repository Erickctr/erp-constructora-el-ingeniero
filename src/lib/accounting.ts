import type {
  Account,
  Condicion,
  JournalEntry,
  JournalLine,
  TipoDoc,
} from "./types";

export const IVA_RATE = 0.13;

/** Códigos de cuentas del catálogo base usados en la integración automática. */
export const CUENTAS = {
  CAJA: "110101",
  BANCOS: "110102",
  CLIENTES: "1102",
  IVA_CF: "1103",
  INVENTARIO: "1104",
  PROVEEDORES: "2101",
  IVA_DF: "2102",
  CAPITAL: "3101",
  VENTAS: "5101",
} as const;

export const r2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
const cents = (n: number): number => Math.round(n * 100);

export function isBalanced(debe: number, haber: number): boolean {
  return cents(debe) === cents(haber);
}

export function sumLines(lines: JournalLine[]): { debe: number; haber: number } {
  let d = 0;
  let h = 0;
  for (const l of lines) {
    d += cents(l.debe);
    h += cents(l.haber);
  }
  return { debe: d / 100, haber: h / 100 };
}

/* ------------------------------ VENTAS ------------------------------ */

export interface SaleCalc {
  exenta: number;
  neto: number;
  iva: number;
  total: number;
}

/**
 * CCF: se ingresa la venta neta y el IVA Débito = 13% sobre la venta neta.
 * FAC: se ingresa el precio final (IVA incluido) y se desglosa dividiendo entre 1.13.
 */
export function calcSale(tipoDoc: TipoDoc, monto: number, exenta = 0): SaleCalc {
  if (tipoDoc === "CCF") {
    const neto = r2(monto);
    const iva = r2(neto * IVA_RATE);
    const ex = r2(exenta);
    return { exenta: ex, neto, iva, total: r2(neto + iva + ex) };
  }
  const total = r2(monto);
  const neto = r2(total / (1 + IVA_RATE));
  return { exenta: 0, neto, iva: r2(total - neto), total };
}

export function buildSaleLines(condicion: Condicion, c: SaleCalc): JournalLine[] {
  const cobro = condicion === "Contado" ? CUENTAS.BANCOS : CUENTAS.CLIENTES;
  const lines: JournalLine[] = [
    { cuenta: cobro, debe: c.total, haber: 0 },
    { cuenta: CUENTAS.VENTAS, debe: 0, haber: r2(c.neto + c.exenta) },
  ];
  if (c.iva > 0) lines.push({ cuenta: CUENTAS.IVA_DF, debe: 0, haber: c.iva });
  return lines;
}

/* ------------------------------ COMPRAS ----------------------------- */

export interface PurchaseCalc {
  neto: number;
  iva: number;
  total: number;
}

export function calcPurchase(neto: number): PurchaseCalc {
  const n = r2(neto);
  const iva = r2(n * IVA_RATE);
  return { neto: n, iva, total: r2(n + iva) };
}

export function buildPurchaseLines(
  condicion: Condicion,
  cuentaDestino: string,
  c: PurchaseCalc
): JournalLine[] {
  const pago = condicion === "Contado" ? CUENTAS.BANCOS : CUENTAS.PROVEEDORES;
  return [
    { cuenta: cuentaDestino, debe: c.neto, haber: 0 },
    { cuenta: CUENTAS.IVA_CF, debe: c.iva, haber: 0 },
    { cuenta: pago, debe: 0, haber: c.total },
  ];
}

/* ------------------------------ MAYOR ------------------------------- */

export interface LedgerMovement {
  entryId: string;
  numero: number;
  fecha: string;
  concepto: string;
  debe: number;
  haber: number;
}

export interface LedgerAccount {
  account: Account;
  movimientos: LedgerMovement[];
  debe: number;
  haber: number;
  /** Saldo según la naturaleza de la cuenta (puede ser negativo = saldo contrario). */
  saldo: number;
  saldoDeudor: number;
  saldoAcreedor: number;
}

export function sortEntries(entries: JournalEntry[]): JournalEntry[] {
  return [...entries].sort((a, b) =>
    a.fecha === b.fecha ? a.numero - b.numero : a.fecha < b.fecha ? -1 : 1
  );
}

export function computeLedger(accounts: Account[], entries: JournalEntry[]): LedgerAccount[] {
  const sorted = sortEntries(entries);
  const map = new Map<string, LedgerMovement[]>();
  for (const e of sorted) {
    for (const l of e.lineas) {
      const arr = map.get(l.cuenta) ?? [];
      arr.push({
        entryId: e.id,
        numero: e.numero,
        fecha: e.fecha,
        concepto: e.concepto,
        debe: l.debe,
        haber: l.haber,
      });
      map.set(l.cuenta, arr);
    }
  }

  const result: LedgerAccount[] = [];
  const pool = accounts.filter((a) => a.tipo === "Detalle" || map.has(a.codigo));
  for (const account of pool) {
    const movimientos = map.get(account.codigo) ?? [];
    let d = 0;
    let h = 0;
    for (const m of movimientos) {
      d += cents(m.debe);
      h += cents(m.haber);
    }
    const debe = d / 100;
    const haber = h / 100;
    const neto = (d - h) / 100;
    result.push({
      account,
      movimientos,
      debe,
      haber,
      saldo: account.naturaleza === "Deudora" ? neto : -neto,
      saldoDeudor: neto > 0 ? neto : 0,
      saldoAcreedor: neto < 0 ? -neto : 0,
    });
  }
  return result.sort((a, b) => a.account.codigo.localeCompare(b.account.codigo));
}
