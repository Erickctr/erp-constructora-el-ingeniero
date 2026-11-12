import {
  buildPurchaseLines,
  buildSaleLines,
  calcPurchase,
  calcSale,
  CUENTAS,
  r2,
} from "./accounting";
import { todayISO } from "./format";
import { computeKardex, costOfIssue } from "./inventory";
import type {
  Account,
  AppData,
  InvMovement,
  JournalEntry,
  Naturaleza,
  Product,
  Purchase,
  PurchaseItem,
  Rubro,
  Sale,
  SaleItem,
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
    acc("11", "ACTIVO CORRIENTE", "Activo", "Deudora", "Título"),
    acc("1101", "EFECTIVO Y EQUIVALENTES", "Activo", "Deudora", "Título"),
    acc("110101", "Caja General", "Activo", "Deudora", "Detalle"),
    acc("110102", "Bancos (Banco Agrícola)", "Activo", "Deudora", "Detalle"),
    acc("1102", "Clientes / Cuentas por Cobrar", "Activo", "Deudora", "Detalle"),
    acc("1103", "IVA Crédito Fiscal", "Activo", "Deudora", "Detalle"),
    acc("1104", "Inventario de Materiales de Construcción", "Activo", "Deudora", "Detalle"),
    acc("12", "ACTIVO NO CORRIENTE", "Activo", "Deudora", "Título"),
    acc("1201", "Propiedad Planta y Equipo", "Activo", "Deudora", "Detalle"),
    acc("2", "PASIVO", "Pasivo", "Acreedora", "Título"),
    acc("21", "PASIVO CORRIENTE", "Pasivo", "Acreedora", "Título"),
    acc("2101", "Proveedores / Cuentas por Pagar", "Pasivo", "Acreedora", "Detalle"),
    acc("2102", "IVA Débito Fiscal", "Pasivo", "Acreedora", "Detalle"),
    acc("3", "PATRIMONIO", "Patrimonio", "Acreedora", "Título"),
    acc("31", "CAPITAL CONTABLE", "Patrimonio", "Acreedora", "Título"),
    acc("3101", "Capital Social", "Patrimonio", "Acreedora", "Detalle"),
    acc("4", "COSTOS Y GASTOS", "Costos y Gastos", "Deudora", "Título"),
    acc("41", "COSTOS", "Costos y Gastos", "Deudora", "Título"),
    acc("4101", "Costo de Ventas", "Costos y Gastos", "Deudora", "Detalle"),
    acc("42", "GASTOS DE OPERACIÓN", "Costos y Gastos", "Deudora", "Título"),
    acc("4201", "Gastos de Administración", "Costos y Gastos", "Deudora", "Detalle"),
    acc("5", "INGRESOS", "Ingresos", "Acreedora", "Título"),
    acc("51", "INGRESOS DE OPERACIÓN", "Ingresos", "Acreedora", "Título"),
    acc("5101", "Ventas de Materiales", "Ingresos", "Acreedora", "Detalle"),
  ];
}

export function seedProducts(): Product[] {
  const p = (codigo: string, nombre: string, unidad: string): Product => ({
    id: `prod-${codigo}`,
    codigo,
    nombre,
    unidad,
  });
  return [
    p("CEM-001", "Cemento gris tipo GU (42.5 kg)", "Bolsa"),
    p("HIE-038", "Hierro corrugado 3/8\" (6 m)", "Varilla"),
    p("HIE-012", "Hierro corrugado 1/2\" (6 m)", "Varilla"),
    p("BLO-015", "Bloque de concreto 15x20x40 cm", "Unidad"),
  ];
}

/**
 * 5 transacciones de prueba (inventario perpetuo, costo promedio ponderado):
 *  1) Apertura: Bancos $25,000 + Inventario inicial $15,000 = Capital $40,000
 *  2) Compra de cemento, CCF contado         neto $3,000.00
 *  3) Compra de hierro, CCF crédito          neto $4,000.00
 *  4) Venta CCF crédito (cemento + hierro)   neto $5,000.00 + costo de venta
 *  5) Venta FAC contado (hierro + bloque)    total $3,277.00 + costo de venta
 */
export function seedData(): AppData {
  const ym = todayISO().slice(0, 7);
  const day = (d: number) => `${ym}-${String(d).padStart(2, "0")}`;

  const accounts = seedAccounts();
  const products = seedProducts();
  const P = (codigo: string) => `prod-${codigo}`;

  const entries: JournalEntry[] = [];
  const sales: Sale[] = [];
  const purchases: Purchase[] = [];
  const movements: InvMovement[] = [];
  let seq = 0;

  const entrada = (
    fecha: string,
    productoId: string,
    cantidad: number,
    costoUnitario: number,
    origen: InvMovement["origen"],
    documento: string,
    refId?: string
  ) =>
    movements.push({
      id: `m-${++seq}`,
      seq,
      fecha,
      productoId,
      tipo: origen === "apertura" ? "Inicial" : "Entrada",
      origen,
      refId,
      documento,
      cantidad,
      costoUnitario,
      costoTotal: r2(cantidad * costoUnitario),
    });

  const salida = (fecha: string, productoId: string, cantidad: number, documento: string, refId: string) => {
    const product = products.find((p) => p.id === productoId)!;
    const k = computeKardex(product, movements);
    const costo = costOfIssue(k, cantidad);
    movements.push({
      id: `m-${++seq}`,
      seq,
      fecha,
      productoId,
      tipo: "Salida",
      origen: "venta",
      refId,
      documento,
      cantidad,
      costoUnitario: 0,
      costoTotal: costo,
    });
    return costo;
  };

  // 1) Partida de apertura con inventario inicial detallado en el Kardex
  entrada(day(1), P("CEM-001"), 1000, 4.8, "apertura", "Inventario inicial");
  entrada(day(1), P("HIE-038"), 1000, 4.0, "apertura", "Inventario inicial");
  entrada(day(1), P("HIE-012"), 500, 7.0, "apertura", "Inventario inicial");
  entrada(day(1), P("BLO-015"), 2700, 1.0, "apertura", "Inventario inicial");
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
  const it1: PurchaseItem[] = [{ productoId: P("CEM-001"), cantidad: 600, costoUnitario: 5.0, costoTotal: 3000 }];
  const c1 = calcPurchase(3000);
  it1.forEach((i) => entrada(day(2), i.productoId, i.cantidad, i.costoUnitario, "compra", "CCF-000231", "p-1"));
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
    items: it1,
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
  const it2: PurchaseItem[] = [
    { productoId: P("HIE-038"), cantidad: 500, costoUnitario: 4.4, costoTotal: 2200 },
    { productoId: P("HIE-012"), cantidad: 250, costoUnitario: 7.2, costoTotal: 1800 },
  ];
  const c2 = calcPurchase(4000);
  it2.forEach((i) => entrada(day(3), i.productoId, i.cantidad, i.costoUnitario, "compra", "CCF-004518", "p-2"));
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
    items: it2,
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

  // 4) Venta con CCF (crédito): 400 bolsas de cemento a $7.50 + 400 varillas 3/8" a $5.00 (sin IVA)
  const si1: SaleItem[] = [
    { productoId: P("CEM-001"), cantidad: 400, precioUnitario: 7.5, costoTotal: 0 },
    { productoId: P("HIE-038"), cantidad: 400, precioUnitario: 5.0, costoTotal: 0 },
  ];
  si1.forEach((i) => (i.costoTotal = salida(day(4), i.productoId, i.cantidad, "CCF 000001", "s-1")));
  const cv1 = r2(si1.reduce((a, i) => a + i.costoTotal, 0));
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
    items: si1,
    costoVenta: cv1,
    asientoId: "e-4",
  });
  entries.push({
    id: "e-4",
    numero: 4,
    fecha: day(4),
    concepto: "Venta CCF N° 000001 - Inmobiliaria Los Almendros, S.A. de C.V. (Crédito)",
    origen: "venta",
    refId: "s-1",
    lineas: buildSaleLines("Crédito", s1, cv1),
  });

  // 5) Venta con Factura de Consumidor Final (contado): precios con IVA incluido
  const si2: SaleItem[] = [
    { productoId: P("HIE-012"), cantidad: 200, precioUnitario: 11.3, costoTotal: 0 },
    { productoId: P("BLO-015"), cantidad: 900, precioUnitario: 1.13, costoTotal: 0 },
  ];
  si2.forEach((i) => (i.costoTotal = salida(day(5), i.productoId, i.cantidad, "FAC 000001", "s-2")));
  const cv2 = r2(si2.reduce((a, i) => a + i.costoTotal, 0));
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
    items: si2,
    costoVenta: cv2,
    asientoId: "e-5",
  });
  entries.push({
    id: "e-5",
    numero: 5,
    fecha: day(5),
    concepto: "Venta FAC N° 000001 - Consumidor Final (Contado)",
    origen: "venta",
    refId: "s-2",
    lineas: buildSaleLines("Contado", s2, cv2),
  });

  return { accounts, entries, sales, purchases, products, movements };
}
