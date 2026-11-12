"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  buildPurchaseLines,
  buildSaleLines,
  calcPurchase,
  calcSale,
  CUENTAS,
  isBalanced,
  r2,
  sumLines,
} from "./accounting";
import { computeKardex, costOfIssue } from "./inventory";
import { firebaseConfigured, loadRemote, saveRemote } from "./firebase";
import { uid } from "./format";
import { seedData } from "./seed";
import type {
  Account,
  AppData,
  Condicion,
  InvMovement,
  JournalLine,
  Product,
  Purchase,
  PurchaseItem,
  Sale,
  SaleItem,
  TipoDoc,
} from "./types";

// v2: incorpora productos y Kardex (los datos v1 se reemplazan por los de prueba)
const STORAGE_KEY = "erp-el-ingeniero:v2";

export type SyncStatus = "local" | "conectando" | "firebase" | "error";

export interface SaleInput {
  fecha: string;
  tipoDoc: TipoDoc;
  numeroDoc: string;
  cliente: string;
  registro: string;
  condicion: Condicion;
  /** Detalle de productos vendidos. CCF: precios sin IVA. FAC: precios con IVA incluido. */
  items: { productoId: string; cantidad: number; precioUnitario: number }[];
  exenta: number;
}

export interface PurchaseInput {
  fecha: string;
  numeroDoc: string;
  proveedor: string;
  nrc: string;
  condicion: Condicion;
  concepto: string;
  cuentaDestino: string;
  /** Monto neto para compras que NO van a Inventario (gastos, activo fijo). */
  neto: number;
  /** Detalle de productos cuando la cuenta destino es Inventario. */
  items: { productoId: string; cantidad: number; costoUnitario: number }[];
}

export interface ProductInput {
  codigo: string;
  nombre: string;
  unidad: string;
}

export interface ManualEntryInput {
  fecha: string;
  concepto: string;
  lineas: JournalLine[];
}

interface Store {
  data: AppData;
  ready: boolean;
  sync: SyncStatus;
  addAccount: (a: Omit<Account, "id">) => string | null;
  updateAccount: (id: string, a: Omit<Account, "id">) => string | null;
  deleteAccount: (id: string) => string | null;
  addSale: (i: SaleInput) => string | null;
  deleteSale: (id: string) => string | null;
  addPurchase: (i: PurchaseInput) => string | null;
  deletePurchase: (id: string) => string | null;
  addProduct: (p: ProductInput) => string | null;
  updateProduct: (id: string, p: ProductInput) => string | null;
  deleteProduct: (id: string) => string | null;
  addManualEntry: (i: ManualEntryInput) => string | null;
  deleteEntry: (id: string) => string | null;
  resetData: () => void;
}

const StoreContext = createContext<Store | null>(null);

const EMPTY: AppData = { accounts: [], entries: [], sales: [], purchases: [], products: [], movements: [] };

function isValidData(x: unknown): x is AppData {
  const d = x as AppData;
  return (
    !!d &&
    Array.isArray(d.accounts) &&
    Array.isArray(d.entries) &&
    Array.isArray(d.sales) &&
    Array.isArray(d.purchases) &&
    Array.isArray(d.products) &&
    Array.isArray(d.movements)
  );
}

const nextSeq = (m: InvMovement[]) => m.reduce((x, y) => Math.max(x, y.seq), 0) + 1;

/**
 * Un documento con movimientos de inventario solo puede eliminarse si ninguno de sus
 * productos tiene movimientos posteriores (de lo contrario cambiarían los costos promedio
 * ya utilizados en otras salidas).
 */
function blockingMovement(d: AppData, refId: string): string | null {
  const own = d.movements.filter((m) => m.refId === refId);
  for (const m of own) {
    const later = d.movements.find(
      (x) =>
        x.productoId === m.productoId &&
        x.refId !== refId &&
        (x.fecha > m.fecha || (x.fecha === m.fecha && x.seq > m.seq))
    );
    if (later) {
      const p = d.products.find((x) => x.id === m.productoId);
      return `No se puede eliminar: el producto ${p?.codigo ?? ""} tiene movimientos posteriores en el Kardex (${later.documento}). Elimine primero los documentos más recientes.`;
    }
  }
  return null;
}

/** Valida que la fecha no sea anterior al último movimiento del producto (Kardex cronológico). */
function retroactive(d: AppData, productoId: string, fecha: string): string | null {
  const p = d.products.find((x) => x.id === productoId);
  if (!p) return "Producto no encontrado.";
  const k = computeKardex(p, d.movements);
  if (k.ultimaFecha && fecha < k.ultimaFecha)
    return `La fecha es anterior al último movimiento de ${p.codigo} en el Kardex (${k.ultimaFecha}). El Kardex no admite registros retroactivos.`;
  return null;
}

function missingAccounts(accounts: Account[], codes: string[]): string | null {
  for (const c of codes) {
    const a = accounts.find((x) => x.codigo === c && x.tipo === "Detalle");
    if (!a) return `Falta la cuenta ${c} en el catálogo (debe existir como cuenta de Detalle).`;
  }
  return null;
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(EMPTY);
  const [ready, setReady] = useState(false);
  const [sync, setSync] = useState<SyncStatus>("local");
  const dataRef = useRef<AppData>(EMPTY);
  const remoteReady = useRef(false);
  const localMutated = useRef(false);

  const applyState = useCallback((next: AppData) => {
    dataRef.current = next;
    setData(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* almacenamiento lleno o bloqueado */
    }
  }, []);

  const commit = useCallback(
    (next: AppData) => {
      localMutated.current = true;
      applyState(next);
    },
    [applyState]
  );

  // Carga inicial: localStorage -> (opcional) Firestore
  useEffect(() => {
    let initial: AppData | null = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (isValidData(parsed)) initial = parsed;
      }
    } catch {
      /* datos corruptos: se usan los de prueba */
    }
    const start = initial ?? seedData();
    applyState(start);
    setReady(true);

    if (firebaseConfigured) {
      setSync("conectando");
      loadRemote()
        .then(async (remote) => {
          if (!localMutated.current && !initial && remote && isValidData(remote)) {
            applyState(remote);
          } else {
            await saveRemote(dataRef.current);
          }
          remoteReady.current = true;
          setSync("firebase");
        })
        .catch(() => setSync("error"));
    }
  }, [applyState]);

  // Persistencia
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* almacenamiento lleno o bloqueado */
    }
    if (!firebaseConfigured || !remoteReady.current) return;
    const t = setTimeout(() => {
      saveRemote(data)
        .then(() => setSync("firebase"))
        .catch(() => setSync("error"));
    }, 300);
    return () => clearTimeout(t);
  }, [data, ready]);

  /* ----------------------------- CATÁLOGO ----------------------------- */
  const addAccount: Store["addAccount"] = useCallback(
    (a) => {
      const d = dataRef.current;
      const codigo = a.codigo.trim();
      const nombre = a.nombre.trim();
      if (!codigo || !nombre) return "El código y el nombre son obligatorios.";
      if (d.accounts.some((x) => x.codigo === codigo))
        return `Ya existe una cuenta con el código ${codigo}.`;
      commit({ ...d, accounts: [...d.accounts, { ...a, codigo, nombre, id: uid() }] });
      return null;
    },
    [commit]
  );

  const updateAccount: Store["updateAccount"] = useCallback(
    (id, a) => {
      const d = dataRef.current;
      const prev = d.accounts.find((x) => x.id === id);
      if (!prev) return "La cuenta no existe.";
      const codigo = a.codigo.trim();
      const nombre = a.nombre.trim();
      if (!codigo || !nombre) return "El código y el nombre son obligatorios.";
      if (d.accounts.some((x) => x.id !== id && x.codigo === codigo))
        return `Ya existe una cuenta con el código ${codigo}.`;
      const used =
        d.entries.some((e) => e.lineas.some((l) => l.cuenta === prev.codigo)) ||
        d.purchases.some((p) => p.cuentaDestino === prev.codigo);
      if (prev.codigo === CUENTAS.INVENTARIO || prev.codigo === CUENTAS.COSTO_VENTAS) {
        if (codigo !== prev.codigo || a.tipo !== "Detalle")
          return "Esta cuenta está integrada con el Kardex: no se puede cambiar su código ni su tipo.";
      }
      if (used && codigo !== prev.codigo)
        return "No se puede cambiar el código: la cuenta ya tiene movimientos registrados.";
      if (used && a.tipo === "Título")
        return "No se puede convertir a Título una cuenta con movimientos.";
      commit({
        ...d,
        accounts: d.accounts.map((x) => (x.id === id ? { ...a, codigo, nombre, id } : x)),
      });
      return null;
    },
    [commit]
  );

  const deleteAccount: Store["deleteAccount"] = useCallback(
    (id) => {
      const d = dataRef.current;
      const prev = d.accounts.find((x) => x.id === id);
      if (!prev) return "La cuenta no existe.";
      if (
        d.entries.some((e) => e.lineas.some((l) => l.cuenta === prev.codigo)) ||
        d.purchases.some((p) => p.cuentaDestino === prev.codigo)
      )
        return `La cuenta ${prev.codigo} tiene movimientos en el Libro Diario y no puede eliminarse.`;
      commit({ ...d, accounts: d.accounts.filter((x) => x.id !== id) });
      return null;
    },
    [commit]
  );

  /* ------------------------------ VENTAS ------------------------------ */
  const addSale: Store["addSale"] = useCallback(
    (i) => {
      const d = dataRef.current;
      const numeroDoc = i.numeroDoc.trim();
      const cliente = i.cliente.trim();
      if (!i.fecha) return "La fecha es obligatoria.";
      if (!numeroDoc) return "El número de documento es obligatorio.";
      if (!cliente) return "El nombre del cliente es obligatorio.";
      if (i.tipoDoc === "CCF" && !i.registro.trim())
        return "El Comprobante de Crédito Fiscal requiere el NRC/NIT del cliente.";
      const lines = i.items.filter((x) => x.productoId);
      if (lines.length === 0) return "Agregue al menos un producto a la venta.";
      const seen = new Set<string>();
      for (const it of lines) {
        if (seen.has(it.productoId)) return "Un producto no puede repetirse en el mismo documento.";
        seen.add(it.productoId);
        if (!(it.cantidad > 0)) return "Las cantidades deben ser mayores que cero.";
        if (!(it.precioUnitario > 0)) return "Los precios unitarios deben ser mayores que cero.";
      }
      if (d.sales.some((s) => s.tipoDoc === i.tipoDoc && s.numeroDoc === numeroDoc))
        return `Ya existe un ${i.tipoDoc} con el número ${numeroDoc}.`;
      const missing = missingAccounts(d.accounts, [
        i.condicion === "Contado" ? CUENTAS.BANCOS : CUENTAS.CLIENTES,
        CUENTAS.VENTAS,
        CUENTAS.IVA_DF,
        CUENTAS.COSTO_VENTAS,
        CUENTAS.INVENTARIO,
      ]);
      if (missing) return missing;

      // Kardex: validar existencias y calcular el costo de lo vendido al promedio vigente
      const saleId = uid();
      const entryId = uid();
      const numeroLabel = `${i.tipoDoc} ${numeroDoc}`;
      let seq = nextSeq(d.movements);
      const newMovs: InvMovement[] = [];
      const items: SaleItem[] = [];
      for (const it of lines) {
        const p = d.products.find((x) => x.id === it.productoId)!;
        const retro = retroactive(d, it.productoId, i.fecha);
        if (retro) return retro;
        const k = computeKardex(p, d.movements);
        if (it.cantidad > k.existencia)
          return `Existencia insuficiente de ${p.codigo} - ${p.nombre}: disponible ${k.existencia} ${p.unidad.toLowerCase()}(s), solicitado ${it.cantidad}.`;
        const costo = costOfIssue(k, it.cantidad);
        items.push({ ...it, costoTotal: costo });
        newMovs.push({
          id: uid(),
          seq: seq++,
          fecha: i.fecha,
          productoId: it.productoId,
          tipo: "Salida",
          origen: "venta",
          refId: saleId,
          documento: numeroLabel,
          cantidad: it.cantidad,
          costoUnitario: 0,
          costoTotal: costo,
        });
      }
      const costoVenta = r2(items.reduce((a, x) => a + x.costoTotal, 0));
      const monto = r2(lines.reduce((a, x) => a + x.cantidad * x.precioUnitario, 0));
      const calc = calcSale(i.tipoDoc, monto, i.exenta);
      const numero = d.entries.reduce((m, e) => Math.max(m, e.numero), 0) + 1;
      const correlativo = d.sales.reduce((m, s) => Math.max(m, s.correlativo), 0) + 1;
      const sale: Sale = {
        id: saleId,
        correlativo,
        fecha: i.fecha,
        tipoDoc: i.tipoDoc,
        numeroDoc,
        cliente,
        registro: i.registro.trim(),
        condicion: i.condicion,
        ...calc,
        items,
        costoVenta,
        asientoId: entryId,
      };
      commit({
        ...d,
        sales: [...d.sales, sale],
        movements: [...d.movements, ...newMovs],
        entries: [
          ...d.entries,
          {
            id: entryId,
            numero,
            fecha: i.fecha,
            concepto: `Venta ${i.tipoDoc} N° ${numeroDoc} - ${cliente} (${i.condicion})`,
            origen: "venta",
            refId: saleId,
            lineas: buildSaleLines(i.condicion, calc, costoVenta),
          },
        ],
      });
      return null;
    },
    [commit]
  );

  const deleteSale: Store["deleteSale"] = useCallback(
    (id) => {
      const d = dataRef.current;
      const s = d.sales.find((x) => x.id === id);
      if (!s) return "La venta no existe.";
      const block = blockingMovement(d, s.id);
      if (block) return block;
      commit({
        ...d,
        sales: d.sales.filter((x) => x.id !== id),
        entries: d.entries.filter((e) => e.id !== s.asientoId),
        movements: d.movements.filter((m) => m.refId !== s.id),
      });
      return null;
    },
    [commit]
  );

  /* ------------------------------ COMPRAS ----------------------------- */
  const addPurchase: Store["addPurchase"] = useCallback(
    (i) => {
      const d = dataRef.current;
      const numeroDoc = i.numeroDoc.trim();
      const proveedor = i.proveedor.trim();
      if (!i.fecha) return "La fecha es obligatoria.";
      if (!numeroDoc) return "El número de CCF es obligatorio.";
      if (!proveedor) return "El nombre del proveedor es obligatorio.";
      if (!i.nrc.trim()) return "El NRC del proveedor es obligatorio.";
      const toInventory = i.cuentaDestino === CUENTAS.INVENTARIO;
      const lines = toInventory ? i.items.filter((x) => x.productoId) : [];
      if (toInventory) {
        if (lines.length === 0) return "Agregue al menos un producto a la compra de inventario.";
        const seen = new Set<string>();
        for (const it of lines) {
          if (seen.has(it.productoId)) return "Un producto no puede repetirse en el mismo documento.";
          seen.add(it.productoId);
          if (!(it.cantidad > 0)) return "Las cantidades deben ser mayores que cero.";
          if (!(it.costoUnitario > 0)) return "Los costos unitarios deben ser mayores que cero.";
          const retro = retroactive(d, it.productoId, i.fecha);
          if (retro) return retro;
        }
      } else if (!(i.neto > 0)) return "El monto neto de la compra debe ser mayor que cero.";
      if (d.purchases.some((p) => p.numeroDoc === numeroDoc && p.proveedor === proveedor))
        return `Ya se registró el CCF ${numeroDoc} de este proveedor.`;
      const missing = missingAccounts(d.accounts, [
        i.cuentaDestino,
        i.condicion === "Contado" ? CUENTAS.BANCOS : CUENTAS.PROVEEDORES,
        CUENTAS.IVA_CF,
      ]);
      if (missing) return missing;

      const items: PurchaseItem[] = lines.map((it) => ({
        ...it,
        costoTotal: r2(it.cantidad * it.costoUnitario),
      }));
      const neto = toInventory ? r2(items.reduce((a, x) => a + x.costoTotal, 0)) : i.neto;
      const calc = calcPurchase(neto);
      const purchaseId = uid();
      let seq = nextSeq(d.movements);
      const newMovs: InvMovement[] = items.map((it) => ({
        id: uid(),
        seq: seq++,
        fecha: i.fecha,
        productoId: it.productoId,
        tipo: "Entrada",
        origen: "compra",
        refId: purchaseId,
        documento: /^CCF/i.test(numeroDoc) ? numeroDoc : `CCF ${numeroDoc}`,
        cantidad: it.cantidad,
        costoUnitario: it.costoUnitario,
        costoTotal: it.costoTotal,
      }));
      const entryId = uid();
      const numero = d.entries.reduce((m, e) => Math.max(m, e.numero), 0) + 1;
      const correlativo = d.purchases.reduce((m, p) => Math.max(m, p.correlativo), 0) + 1;
      const concepto = i.concepto.trim();
      const purchase: Purchase = {
        id: purchaseId,
        correlativo,
        fecha: i.fecha,
        numeroDoc,
        proveedor,
        nrc: i.nrc.trim(),
        condicion: i.condicion,
        concepto,
        cuentaDestino: i.cuentaDestino,
        ...calc,
        items,
        asientoId: entryId,
      };
      commit({
        ...d,
        purchases: [...d.purchases, purchase],
        movements: [...d.movements, ...newMovs],
        entries: [
          ...d.entries,
          {
            id: entryId,
            numero,
            fecha: i.fecha,
            concepto: `Compra CCF N° ${numeroDoc} - ${proveedor}${concepto ? ` - ${concepto}` : ""} (${i.condicion})`,
            origen: "compra",
            refId: purchaseId,
            lineas: buildPurchaseLines(i.condicion, i.cuentaDestino, calc),
          },
        ],
      });
      return null;
    },
    [commit]
  );

  const deletePurchase: Store["deletePurchase"] = useCallback(
    (id) => {
      const d = dataRef.current;
      const p = d.purchases.find((x) => x.id === id);
      if (!p) return "La compra no existe.";
      const block = blockingMovement(d, p.id);
      if (block) return block;
      // Si se elimina la entrada, la existencia no puede quedar negativa
      for (const it of p.items ?? []) {
        const prod = d.products.find((x) => x.id === it.productoId);
        if (!prod) continue;
        const k = computeKardex(prod, d.movements);
        if (k.existencia - it.cantidad < 0)
          return `No se puede eliminar: la existencia de ${prod.codigo} quedaría negativa.`;
      }
      commit({
        ...d,
        purchases: d.purchases.filter((x) => x.id !== id),
        entries: d.entries.filter((e) => e.id !== p.asientoId),
        movements: d.movements.filter((m) => m.refId !== p.id),
      });
      return null;
    },
    [commit]
  );

  /* ------------------------------ DIARIO ------------------------------ */
  const addManualEntry: Store["addManualEntry"] = useCallback(
    (i) => {
      const d = dataRef.current;
      const concepto = i.concepto.trim();
      if (!i.fecha) return "La fecha es obligatoria.";
      if (!concepto) return "El concepto de la partida es obligatorio.";
      const lineas = i.lineas.filter((l) => l.debe > 0 || l.haber > 0);
      if (lineas.length < 2) return "La partida debe tener al menos dos líneas con importe.";
      for (const l of lineas) {
        if (!d.accounts.some((a) => a.codigo === l.cuenta && a.tipo === "Detalle"))
          return "Todas las líneas deben tener una cuenta de Detalle válida.";
        if (l.debe > 0 && l.haber > 0)
          return "Una línea no puede tener Debe y Haber al mismo tiempo.";
        if (l.cuenta === CUENTAS.INVENTARIO)
          return "La cuenta de Inventario solo se mueve mediante compras y ventas (Kardex). Registre el documento en el libro correspondiente.";
      }
      const t = sumLines(lineas);
      if (!isBalanced(t.debe, t.haber))
        return `Partida descuadrada: Debe ${t.debe.toFixed(2)} ≠ Haber ${t.haber.toFixed(2)}.`;
      const numero = d.entries.reduce((m, e) => Math.max(m, e.numero), 0) + 1;
      commit({
        ...d,
        entries: [
          ...d.entries,
          { id: uid(), numero, fecha: i.fecha, concepto, origen: "manual", lineas },
        ],
      });
      return null;
    },
    [commit]
  );

  const deleteEntry: Store["deleteEntry"] = useCallback(
    (id) => {
      const d = dataRef.current;
      const e = d.entries.find((x) => x.id === id);
      if (!e) return "La partida no existe.";
      if (e.origen === "venta" || e.origen === "compra")
        return "Esta partida fue generada automáticamente; elimine el documento desde el Libro de Ventas/Compras.";
      commit({ ...d, entries: d.entries.filter((x) => x.id !== id) });
      return null;
    },
    [commit]
  );

  /* ----------------------------- PRODUCTOS ---------------------------- */
  const addProduct: Store["addProduct"] = useCallback(
    (p) => {
      const d = dataRef.current;
      const codigo = p.codigo.trim().toUpperCase();
      const nombre = p.nombre.trim();
      const unidad = p.unidad.trim();
      if (!codigo || !nombre || !unidad) return "Código, nombre y unidad de medida son obligatorios.";
      if (d.products.some((x) => x.codigo === codigo)) return `Ya existe un producto con el código ${codigo}.`;
      commit({ ...d, products: [...d.products, { id: uid(), codigo, nombre, unidad }] });
      return null;
    },
    [commit]
  );

  const updateProduct: Store["updateProduct"] = useCallback(
    (id, p) => {
      const d = dataRef.current;
      const prev = d.products.find((x) => x.id === id);
      if (!prev) return "El producto no existe.";
      const codigo = p.codigo.trim().toUpperCase();
      const nombre = p.nombre.trim();
      const unidad = p.unidad.trim();
      if (!codigo || !nombre || !unidad) return "Código, nombre y unidad de medida son obligatorios.";
      if (d.products.some((x) => x.id !== id && x.codigo === codigo))
        return `Ya existe un producto con el código ${codigo}.`;
      const product: Product = { id, codigo, nombre, unidad };
      commit({ ...d, products: d.products.map((x) => (x.id === id ? product : x)) });
      return null;
    },
    [commit]
  );

  const deleteProduct: Store["deleteProduct"] = useCallback(
    (id) => {
      const d = dataRef.current;
      if (d.movements.some((m) => m.productoId === id))
        return "El producto tiene movimientos en el Kardex y no puede eliminarse.";
      commit({ ...d, products: d.products.filter((x) => x.id !== id) });
      return null;
    },
    [commit]
  );

  const resetData = useCallback(() => {
    commit(seedData());
  }, [commit]);

  const value = useMemo<Store>(
    () => ({
      data,
      ready,
      sync,
      addAccount,
      updateAccount,
      deleteAccount,
      addSale,
      deleteSale,
      addPurchase,
      deletePurchase,
      addProduct,
      updateProduct,
      deleteProduct,
      addManualEntry,
      deleteEntry,
      resetData,
    }),
    [
      data,
      ready,
      sync,
      addAccount,
      updateAccount,
      deleteAccount,
      addSale,
      deleteSale,
      addPurchase,
      deletePurchase,
      addProduct,
      updateProduct,
      deleteProduct,
      addManualEntry,
      deleteEntry,
      resetData,
    ]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore debe usarse dentro de <DataProvider>");
  return ctx;
}

