import type { InvMovement, Product } from "./types";

const cents = (n: number): number => Math.round(n * 100);
const r2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
/** Costo unitario con 4 decimales (solo para presentación). */
export const r4 = (n: number): number => Math.round((n + Number.EPSILON) * 10000) / 10000;

export interface KardexRow {
  mov: InvMovement;
  entradaCant: number;
  entradaCU: number;
  entradaTotal: number;
  salidaCant: number;
  salidaCU: number;
  salidaTotal: number;
  saldoCant: number;
  saldoCU: number;
  saldoTotal: number;
}

export interface Kardex {
  product: Product;
  rows: KardexRow[];
  existencia: number;
  costoPromedio: number;
  valor: number;
  ultimaFecha: string | null;
}

export function sortMovements(m: InvMovement[]): InvMovement[] {
  return [...m].sort((a, b) => (a.fecha === b.fecha ? a.seq - b.seq : a.fecha < b.fecha ? -1 : 1));
}

/**
 * Reproduce el Kardex de un producto por el método de Costo Promedio Ponderado móvil:
 * cada entrada recalcula el costo promedio = valor del saldo / unidades en existencia;
 * cada salida se valúa al costo promedio vigente (NIIF para las PYMES, Sección 13).
 */
export function computeKardex(product: Product, movements: InvMovement[]): Kardex {
  const mine = sortMovements(movements.filter((m) => m.productoId === product.id));
  let cant = 0;
  let valorC = 0; // en centavos para evitar errores de redondeo
  const rows: KardexRow[] = [];
  for (const m of mine) {
    const row: KardexRow = {
      mov: m,
      entradaCant: 0,
      entradaCU: 0,
      entradaTotal: 0,
      salidaCant: 0,
      salidaCU: 0,
      salidaTotal: 0,
      saldoCant: 0,
      saldoCU: 0,
      saldoTotal: 0,
    };
    if (m.tipo === "Salida") {
      cant -= m.cantidad;
      valorC -= cents(m.costoTotal);
      row.salidaCant = m.cantidad;
      row.salidaTotal = m.costoTotal;
      row.salidaCU = m.cantidad ? r4(m.costoTotal / m.cantidad) : 0;
    } else {
      cant += m.cantidad;
      valorC += cents(m.costoTotal);
      row.entradaCant = m.cantidad;
      row.entradaCU = m.costoUnitario;
      row.entradaTotal = m.costoTotal;
    }
    row.saldoCant = cant;
    row.saldoTotal = valorC / 100;
    row.saldoCU = cant > 0 ? r4(valorC / 100 / cant) : 0;
    rows.push(row);
  }
  const valor = valorC / 100;
  return {
    product,
    rows,
    existencia: cant,
    costoPromedio: cant > 0 ? r4(valor / cant) : 0,
    valor,
    ultimaFecha: mine.length ? mine[mine.length - 1].fecha : null,
  };
}

/**
 * Costo de una salida al promedio vigente. Si se vende toda la existencia,
 * se toma el valor completo del saldo para no dejar residuos de centavos.
 */
export function costOfIssue(k: Kardex, cantidad: number): number {
  if (cantidad >= k.existencia) return r2(k.valor);
  return r2((k.valor / k.existencia) * cantidad);
}
