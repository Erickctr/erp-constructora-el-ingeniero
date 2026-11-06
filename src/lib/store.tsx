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
  sumLines,
} from "./accounting";
import { firebaseConfigured, loadRemote, saveRemote } from "./firebase";
import { uid } from "./format";
import { seedData } from "./seed";
import type {
  Account,
  AppData,
  Condicion,
  JournalLine,
  Purchase,
  Sale,
  TipoDoc,
} from "./types";

const STORAGE_KEY = "erp-el-ingeniero:v1";

export type SyncStatus = "local" | "conectando" | "firebase" | "error";

export interface SaleInput {
  fecha: string;
  tipoDoc: TipoDoc;
  numeroDoc: string;
  cliente: string;
  registro: string;
  condicion: Condicion;
  /** CCF: venta neta (sin IVA). FAC: precio final con IVA incluido. */
  monto: number;
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
  neto: number;
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
  deleteSale: (id: string) => void;
  addPurchase: (i: PurchaseInput) => string | null;
  deletePurchase: (id: string) => void;
  addManualEntry: (i: ManualEntryInput) => string | null;
  deleteEntry: (id: string) => string | null;
  resetData: () => void;
}

const StoreContext = createContext<Store | null>(null);

const EMPTY: AppData = { accounts: [], entries: [], sales: [], purchases: [] };

function isValidData(x: unknown): x is AppData {
  const d = x as AppData;
  return (
    !!d &&
    Array.isArray(d.accounts) &&
    Array.isArray(d.entries) &&
    Array.isArray(d.sales) &&
    Array.isArray(d.purchases)
  );
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

  const commit = useCallback((next: AppData) => {
    dataRef.current = next;
    setData(next);
  }, []);

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
    commit(start);
    setReady(true);

    if (firebaseConfigured) {
      setSync("conectando");
      loadRemote()
        .then(async (remote) => {
          if (remote && isValidData(remote)) {
            commit(remote);
          } else {
            await saveRemote(dataRef.current);
          }
          remoteReady.current = true;
          setSync("firebase");
        })
        .catch(() => setSync("error"));
    }
  }, [commit]);

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
    }, 600);
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
      if (!(i.monto > 0)) return "El monto de la venta debe ser mayor que cero.";
      if (d.sales.some((s) => s.tipoDoc === i.tipoDoc && s.numeroDoc === numeroDoc))
        return `Ya existe un ${i.tipoDoc} con el número ${numeroDoc}.`;
      const missing = missingAccounts(d.accounts, [
        i.condicion === "Contado" ? CUENTAS.BANCOS : CUENTAS.CLIENTES,
        CUENTAS.VENTAS,
        CUENTAS.IVA_DF,
      ]);
      if (missing) return missing;

      const calc = calcSale(i.tipoDoc, i.monto, i.exenta);
      const saleId = uid();
      const entryId = uid();
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
        asientoId: entryId,
      };
      commit({
        ...d,
        sales: [...d.sales, sale],
        entries: [
          ...d.entries,
          {
            id: entryId,
            numero,
            fecha: i.fecha,
            concepto: `Venta ${i.tipoDoc} N° ${numeroDoc} - ${cliente} (${i.condicion})`,
            origen: "venta",
            refId: saleId,
            lineas: buildSaleLines(i.condicion, calc),
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
      if (!s) return;
      commit({
        ...d,
        sales: d.sales.filter((x) => x.id !== id),
        entries: d.entries.filter((e) => e.id !== s.asientoId),
      });
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
      if (!(i.neto > 0)) return "El monto neto de la compra debe ser mayor que cero.";
      if (d.purchases.some((p) => p.numeroDoc === numeroDoc && p.proveedor === proveedor))
        return `Ya se registró el CCF ${numeroDoc} de este proveedor.`;
      const missing = missingAccounts(d.accounts, [
        i.cuentaDestino,
        i.condicion === "Contado" ? CUENTAS.BANCOS : CUENTAS.PROVEEDORES,
        CUENTAS.IVA_CF,
      ]);
      if (missing) return missing;

      const calc = calcPurchase(i.neto);
      const purchaseId = uid();
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
        asientoId: entryId,
      };
      commit({
        ...d,
        purchases: [...d.purchases, purchase],
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
      if (!p) return;
      commit({
        ...d,
        purchases: d.purchases.filter((x) => x.id !== id),
        entries: d.entries.filter((e) => e.id !== p.asientoId),
      });
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

