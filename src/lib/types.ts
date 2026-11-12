export type Rubro = "Activo" | "Pasivo" | "Patrimonio" | "Costos y Gastos" | "Ingresos";
export type Naturaleza = "Deudora" | "Acreedora";
export type TipoCuenta = "Título" | "Detalle";
export type Condicion = "Contado" | "Crédito";
export type TipoDoc = "CCF" | "FAC";
export type Origen = "apertura" | "manual" | "venta" | "compra";
export type TipoMovimiento = "Inicial" | "Entrada" | "Salida";

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

/** Producto (material de construcción) controlado en el Kardex. */
export interface Product {
  id: string;
  codigo: string;
  nombre: string;
  unidad: string;
}

/**
 * Movimiento de inventario (Kardex). Método: Costo Promedio Ponderado móvil.
 * Entradas e inventario inicial guardan el costo unitario de adquisición;
 * las salidas guardan el costo total calculado al promedio vigente al registrarse.
 */
export interface InvMovement {
  id: string;
  seq: number; // orden de registro (desempate dentro de la misma fecha)
  fecha: string;
  productoId: string;
  tipo: TipoMovimiento;
  origen: Origen;
  refId?: string;
  documento: string;
  cantidad: number;
  costoUnitario: number;
  costoTotal: number;
}

export interface SaleItem {
  productoId: string;
  cantidad: number;
  /** CCF: precio unitario sin IVA. FAC: precio unitario con IVA incluido. */
  precioUnitario: number;
  costoTotal: number; // costo de lo vendido (promedio ponderado)
}

export interface PurchaseItem {
  productoId: string;
  cantidad: number;
  costoUnitario: number; // sin IVA
  costoTotal: number;
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
  items: SaleItem[];
  costoVenta: number;
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
  /** Solo cuando la cuenta destino es Inventario. */
  items: PurchaseItem[];
  asientoId: string;
}

export interface AppData {
  accounts: Account[];
  entries: JournalEntry[];
  sales: Sale[];
  purchases: Purchase[];
  products: Product[];
  movements: InvMovement[];
}

export const RUBROS: Rubro[] = ["Activo", "Pasivo", "Patrimonio", "Costos y Gastos", "Ingresos"];

