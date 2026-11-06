import {
  buildPurchaseLines,
  buildSaleLines,
  calcPurchase,
  calcSale,
  CUENTAS,
} from "./accounting";
import { todayISO } from "./format";
import type {
  Account,
  AppData,
  JournalEntry,
  Naturaleza,
  Purchase,
  Rubro,
  Sale,
  TipoCuenta,
} from "./types";

function acc(
  codigo: string,
  nombre: string,
  rubro: Rubro,
  naturaleza: Naturaleza,
  tipo: TipoCuenta
): Account {
  return { id: `acc-${codigo}`, codigo, nombre, rubro, naturaleza, tipo };
}

export function seedAccounts(): Account[] {
  return [
    acc("1", "ACTIVO", "Activo", "Deudora", "Título"),
    acc("110101", "Caja General", "Activo", "Deudora", "Detalle"),
    acc("110102", "Bancos (Banco Agrícola)", "Activo", "Deudora", "Detalle"),
    acc("1102", "Clientes / Cuentas por Cobrar", "Activo", "Deudora", "Detalle"),
    acc("1103", "IVA Crédito Fiscal", "Activo", "Deudora", "Detalle"),
    acc("1104", "Inventario de Materiales de Construcción", "Activo", "Deudora", "Detalle"),
    acc("1201", "Propiedad Planta y Equipo", "Activo", "Deudora", "Detalle"),
    acc("2", "PASIVO", "Pasivo", "Acreedora", "Título"),
    acc("2101", "Proveedores / Cuentas por Pagar", "Pasivo", "Acreedora", "Detalle"),
    acc("2102", "IVA Débito Fiscal", "Pasivo", "Acreedora", "Detalle"),
    acc("3", "PATRIMONIO", "Patrimonio", "Acreedora", "Título"),
    acc("3101", "Capital Social", "Patrimonio", "Acreedora", "Detalle"),
    acc("4", "COSTOS Y GASTOS", "Costos y Gastos", "Deudora", "Título"),
    acc("4101", "Costo de Ventas", "Costos y Gastos", "Deudora", "Detalle"),
    acc("4201", "Gastos de Administración", "Costos y Gastos", "Deudora", "Detalle"),
    acc("5", "INGRESOS", "Ingresos", "Acreedora", "Título"),
    acc("5101", "Ventas de Materiales", "Ingresos", "Acreedora", "Detalle"),
  ];
}

/**
 * 5 transacciones de prueba. Total Debe = Total Haber = $56,837.00
 *  1) Apertura                       40,000.00
 *  2) Compra cemento (CCF, contado)   3,390.00
 *  3) Compra hierro (CCF, crédito)    4,520.00
 *  4) Venta CCF (crédito)             5,650.00
 *  5) Venta Factura consumidor final  3,277.00
 *                                    ---------
 *                                    56,837.00
 */
export function seedData(): AppData {
  const ym = todayISO().slice(0, 7);
  const day = (d: number) => `${ym}-${String(d).padStart(2, "0")}`;

  const entries: JournalEntry[] = [];
  const sales: Sale[] = [];
  const purchases: Purchase[] = [];

  // 1) Partida de apertura
  entries.push({
    id: "e-1",
    numero: 1,
    fecha: day(1),
    concepto: "Partida de apertura - Aporte inicial de capital (Bancos e Inventario)",
    origen: "apertura",
    lineas: [
      { cuenta: CUENTAS.BANCOS, debe: 25000, haber: 0 },
      { cuenta: CUENTAS.INVENTARIO, debe: 15000, haber: 0 },
      { cuenta: CUENTAS.CAPITAL, debe: 0, haber: 40000 },
    ],
  });

  // 2) Compra de cemento (contado)
  const c1 = calcPurchase(3000);
  purchases.push({
    id: "p-1",
    correlativo: 1,
    fecha: day(2),
    numeroDoc: "CCF-000231",
    proveedor: "Cemento Cuscatlán, S.A. de C.V.",
    nrc: "123456-7",
    condicion: "Contado",
    concepto: "Compra de cemento (600 bolsas)",
    cuentaDestino: CUENTAS.INVENTARIO,
    ...c1,
    asientoId: "e-2",
  });
  entries.push({
    id: "e-2",
    numero: 2,
    fecha: day(2),
    concepto: "Compra CCF N° CCF-000231 - Cemento Cuscatlán, S.A. de C.V. - Compra de cemento (Contado)",
    origen: "compra",
    refId: "p-1",
    lineas: buildPurchaseLines("Contado", CUENTAS.INVENTARIO, c1),
  });

  // 3) Compra de hierro (crédito)
  const c2 = calcPurchase(4000);
  purchases.push({
    id: "p-2",
    correlativo: 2,
    fecha: day(3),
    numeroDoc: "CCF-004518",
    proveedor: "Aceros y Hierros Centroamericanos, S.A. de C.V.",
    nrc: "234567-8",
    condicion: "Crédito",
    concepto: "Compra de hierro corrugado 3/8\" y 1/2\"",
    cuentaDestino: CUENTAS.INVENTARIO,
    ...c2,
    asientoId: "e-3",
  });
  entries.push({
    id: "e-3",
    numero: 3,
    fecha: day(3),
    concepto:
      "Compra CCF N° CCF-004518 - Aceros y Hierros Centroamericanos, S.A. de C.V. - Compra de hierro corrugado (Crédito)",
    origen: "compra",
    refId: "p-2",
    lineas: buildPurchaseLines("Crédito", CUENTAS.INVENTARIO, c2),
  });

  // 4) Venta con CCF (crédito)
  const s1 = calcSale("CCF", 5000);
  sales.push({
    id: "s-1",
    correlativo: 1,
    fecha: day(4),
    tipoDoc: "CCF",
    numeroDoc: "000001",
    cliente: "Inmobiliaria Los Almendros, S.A. de C.V.",
    registro: "345678-9",
    condicion: "Crédito",
    ...s1,
    asientoId: "e-4",
  });
  entries.push({
    id: "e-4",
    numero: 4,
    fecha: day(4),
    concepto: "Venta CCF N° 000001 - Inmobiliaria Los Almendros, S.A. de C.V. (Crédito)",
    origen: "venta",
    refId: "s-1",
    lineas: buildSaleLines("Crédito", s1),
  });

  // 5) Venta con Factura de Consumidor Final (contado)
  const s2 = calcSale("FAC", 3277);
  sales.push({
    id: "s-2",
    correlativo: 2,
    fecha: day(5),
    tipoDoc: "FAC",
    numeroDoc: "000001",
    cliente: "Consumidor Final",
    registro: "",
    condicion: "Contado",
    ...s2,
    asientoId: "e-5",
  });
  entries.push({
    id: "e-5",
    numero: 5,
    fecha: day(5),
    concepto: "Venta FAC N° 000001 - Consumidor Final (Contado)",
    origen: "venta",
    refId: "s-2",
    lineas: buildSaleLines("Contado", s2),
  });

  return { accounts: seedAccounts(), entries, sales, purchases };
}

