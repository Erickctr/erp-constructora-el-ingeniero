export type Rubro = "Activo" | "Pasivo" | "Patrimonio" | "Costos y Gastos" | "Ingresos";
export type Naturaleza = "Deudora" | "Acreedora";
export type TipoCuenta = "Título" | "Detalle";
export type Condicion = "Contado" | "Crédito";
export type TipoDoc = "CCF" | "FAC";
export type Origen = "apertura" | "manual" | "venta" | "compra";

export interface Account {
  id: string;
  codigo: string;
  nombre: string;
  rubro: Rubro;
  naturaleza: Naturaleza;
  tipo: TipoCuenta;
}

export interface JournalLine {
  cuenta: string; // código de cuenta
  debe: number;
  haber: number;
}

export interface JournalEntry {
  id: string;
  numero: number;
  fecha: string; // YYYY-MM-DD
  concepto: string;
  origen: Origen;
  refId?: string;
  lineas: JournalLine[];
}

export interface Sale {
  id: string;
  correlativo: number;
  fecha: string;
  tipoDoc: TipoDoc;
  numeroDoc: string;
  cliente: string;
  registro: string; // NRC / NIT / DUI
  condicion: Condicion;
  exenta: number;
  neto: number; // venta gravada neta (sin IVA)
  iva: number; // débito fiscal
  total: number;
  asientoId: string;
}

export interface Purchase {
  id: string;
  correlativo: number;
  fecha: string;
  numeroDoc: string;
  proveedor: string;
  nrc: string;
  condicion: Condicion;
  concepto: string;
  cuentaDestino: string; // código de la cuenta que se carga (inventario, gasto, etc.)
  neto: number;
  iva: number; // crédito fiscal
  total: number;
  asientoId: string;
}

export interface AppData {
  accounts: Account[];
  entries: JournalEntry[];
  sales: Sale[];
  purchases: Purchase[];
}

export const RUBROS: Rubro[] = ["Activo", "Pasivo", "Patrimonio", "Costos y Gastos", "Ingresos"];

