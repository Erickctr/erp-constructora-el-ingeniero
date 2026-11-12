"use client";

import { Plus, Search, ShoppingCart, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Alert, Badge, Modal, MonthFilter, PageHeader } from "@/components/ui";
import { buildPurchaseLines, calcPurchase, CUENTAS, r2 } from "@/lib/accounting";
import { fmtDate, money, monthOf, parseAmount, todayISO } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { Condicion, Purchase } from "@/lib/types";

interface Form {
  fecha: string;
  numeroDoc: string;
  proveedor: string;
  nrc: string;
  condicion: Condicion;
  concepto: string;
  cuentaDestino: string;
  neto: string;
  items: { productoId: string; cantidad: string; costo: string }[];
}

const emptyItem = () => ({ productoId: "", cantidad: "", costo: "" });

const emptyForm = (): Form => ({
  fecha: todayISO(),
  numeroDoc: "",
  proveedor: "",
  nrc: "",
  condicion: "Contado",
  concepto: "",
  cuentaDestino: CUENTAS.INVENTARIO,
  neto: "",
  items: [emptyItem()],
});

export default function ComprasPage() {
  const { data, addPurchase, deletePurchase } = useStore();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [month, setMonth] = useState("");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Purchase | null>(null);
  const toInventory = form.cuentaDestino === CUENTAS.INVENTARIO;
  const products = useMemo(
    () => [...data.products].sort((a, b) => a.codigo.localeCompare(b.codigo)),
    [data.products]
  );
  const setItem = (idx: number, patch: Partial<Form["items"][number]>) =>
    setForm({ ...form, items: form.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) });

  const nameOf = (code: string) => data.accounts.find((a) => a.codigo === code)?.nombre ?? "";
  const entryNum = (id: string) => data.entries.find((e) => e.id === id)?.numero;

  const destinos = useMemo(
    () =>
      data.accounts
        .filter(
          (a) =>
            a.tipo === "Detalle" &&
            (a.rubro === "Activo" || a.rubro === "Costos y Gastos") &&
            a.codigo !== CUENTAS.IVA_CF &&
            a.codigo !== CUENTAS.BANCOS &&
            a.codigo !== CUENTAS.CAJA &&
            a.codigo !== CUENTAS.CLIENTES
        )
        .sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true })),
    [data.accounts]
  );

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return [...data.purchases]
      .filter((x) => !month || monthOf(x.fecha) === month)
      .filter(
        (x) =>
          !s ||
          x.proveedor.toLowerCase().includes(s) ||
          x.numeroDoc.toLowerCase().includes(s) ||
          x.nrc.toLowerCase().includes(s)
      )
      .sort((a, b) => (a.fecha === b.fecha ? a.correlativo - b.correlativo : a.fecha < b.fecha ? -1 : 1));
  }, [data.purchases, month, q]);

  const tot = useMemo(
    () => ({
      neto: r2(rows.reduce((a, x) => a + x.neto, 0)),
      iva: r2(rows.reduce((a, x) => a + x.iva, 0)),
      total: r2(rows.reduce((a, x) => a + x.total, 0)),
    }),
    [rows]
  );

  const preview = useMemo(() => {
    const neto =
      form.cuentaDestino === CUENTAS.INVENTARIO
        ? r2(form.items.reduce((a, it) => a + r2(parseAmount(it.cantidad) * parseAmount(it.costo)), 0))
        : parseAmount(form.neto);
    if (neto <= 0) return null;
    const calc = calcPurchase(neto);
    return { calc, lines: buildPurchaseLines(form.condicion, form.cuentaDestino, calc) };
  }, [form]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const err = addPurchase({
      fecha: form.fecha,
      numeroDoc: form.numeroDoc,
      proveedor: form.proveedor,
      nrc: form.nrc,
      condicion: form.condicion,
      concepto: form.concepto,
      cuentaDestino: form.cuentaDestino,
      neto: parseAmount(form.neto),
      items: form.items
        .filter((it) => it.productoId)
        .map((it) => ({
          productoId: it.productoId,
          cantidad: parseAmount(it.cantidad),
          costoUnitario: parseAmount(it.costo),
        })),
    });
    if (err) return setError(err);
    setNotice(
      toInventory
        ? "Compra registrada: asiento generado en el Libro Diario y entradas cargadas al Kardex (costo promedio recalculado)."
        : "Compra registrada y asiento generado automáticamente en el Libro Diario."
    );
    setOpen(false);
  }

  return (
    <>
      <PageHeader
        icon={ShoppingCart}
        title="Libro de Compras"
        subtitle="Comprobantes de Crédito Fiscal · IVA Crédito Fiscal 13% · Integración automática con el Libro Diario"
        actions={
          <button
            className="btn-primary"
            onClick={() => {
              setForm(emptyForm());
              setError(null);
              setNotice(null);
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Registrar compra
          </button>
        }
      />

      {notice && (
        <div className="mb-4">
          <Alert tone="success">{notice}</Alert>
        </div>
      )}

      <div className="card mb-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Buscar proveedor, CCF o NRC…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <MonthFilter value={month} onChange={setMonth} />
      </div>

      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>Corr.</th>
              <th>Fecha</th>
              <th>N° CCF</th>
              <th>Proveedor</th>
              <th>NRC</th>
              <th>Concepto</th>
              <th>Pago</th>
              <th className="num">Compra neta</th>
              <th className="num">Crédito Fiscal</th>
              <th className="num">Total</th>
              <th>Partida</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td>{p.correlativo}</td>
                <td className="whitespace-nowrap">{fmtDate(p.fecha)}</td>
                <td className="font-mono">{p.numeroDoc}</td>
                <td>{p.proveedor}</td>
                <td className="whitespace-nowrap">{p.nrc}</td>
                <td className="text-slate-600">{p.concepto || "—"}</td>
                <td>
                  <Badge tone={p.condicion === "Contado" ? "green" : "amber"}>{p.condicion}</Badge>
                </td>
                <td className="num">{money(p.neto)}</td>
                <td className="num">{money(p.iva)}</td>
                <td className="num font-semibold">{money(p.total)}</td>
                <td className="text-center font-semibold text-steel">#{entryNum(p.asientoId) ?? "—"}</td>
                <td>
                  <button
                    className="btn-icon hover:!text-red-600"
                    title="Eliminar compra y su partida"
                    onClick={() => { setDeleteError(null); setToDelete(p); }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={12} className="py-8 text-center text-slate-400">
                  No hay compras registradas para este filtro.
                </td>
              </tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={7}>TOTALES ({rows.length})</td>
                <td className="num">{money(tot.neto)}</td>
                <td className="num">{money(tot.iva)}</td>
                <td className="num">{money(tot.total)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Registrar compra a proveedor (CCF)" wide>
        <form onSubmit={submit} className="space-y-4">
          {error && <Alert tone="error">{error}</Alert>}
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label">Fecha</label>
              <input
                type="date"
                className="input"
                value={form.fecha}
                onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label">N° de CCF</label>
              <input
                className="input font-mono"
                value={form.numeroDoc}
                onChange={(e) => setForm({ ...form, numeroDoc: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label">Condición de pago</label>
              <select
                className="input"
                value={form.condicion}
                onChange={(e) => setForm({ ...form, condicion: e.target.value as Condicion })}
              >
                <option value="Contado">Contado (Bancos)</option>
                <option value="Crédito">Crédito (Proveedores)</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="label">Proveedor</label>
              <input
                className="input"
                value={form.proveedor}
                onChange={(e) => setForm({ ...form, proveedor: e.target.value })}
                placeholder="Razón social del proveedor"
                required
              />
            </div>
            <div>
              <label className="label">NRC del proveedor</label>
              <input
                className="input"
                value={form.nrc}
                onChange={(e) => setForm({ ...form, nrc: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Cuenta a cargar (destino de la compra)</label>
              <select
                className="input"
                value={form.cuentaDestino}
                onChange={(e) => setForm({ ...form, cuentaDestino: e.target.value })}
              >
                {destinos.map((a) => (
                  <option key={a.id} value={a.codigo}>
                    {a.codigo} — {a.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Concepto</label>
              <input
                className="input"
                value={form.concepto}
                onChange={(e) => setForm({ ...form, concepto: e.target.value })}
                placeholder="Ej. Compra de cemento"
              />
            </div>
          </div>

          {toInventory ? (
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="label !mb-0">Detalle de productos (entradas al Kardex) · costo unitario sin IVA</label>
                <button
                  type="button"
                  className="btn-secondary !px-2.5 !py-1 text-xs"
                  onClick={() => setForm({ ...form, items: [...form.items, emptyItem()] })}
                >
                  <Plus className="h-3.5 w-3.5" /> Agregar producto
                </button>
              </div>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-2 py-2 text-left">Producto</th>
                      <th className="px-2 py-2 text-right">Cantidad</th>
                      <th className="px-2 py-2 text-right">Costo unit.</th>
                      <th className="px-2 py-2 text-right">Subtotal</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {form.items.map((it, idx) => (
                      <tr key={idx} className="border-t border-slate-100">
                        <td className="min-w-[220px] px-2 py-1.5">
                          <select
                            className="input"
                            value={it.productoId}
                            onChange={(e) => setItem(idx, { productoId: e.target.value })}
                          >
                            <option value="">Seleccione…</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.codigo} · {p.nombre}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="w-28 px-2 py-1.5">
                          <input
                            type="number"
                            step="1"
                            min="0"
                            className="input text-right"
                            value={it.cantidad}
                            onChange={(e) => setItem(idx, { cantidad: e.target.value })}
                          />
                        </td>
                        <td className="w-32 px-2 py-1.5">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="input text-right"
                            value={it.costo}
                            onChange={(e) => setItem(idx, { costo: e.target.value })}
                            placeholder="0.00"
                          />
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">
                          {money(r2(parseAmount(it.cantidad) * parseAmount(it.costo)))}
                        </td>
                        <td className="px-1">
                          {form.items.length > 1 && (
                            <button
                              type="button"
                              className="btn-icon"
                              title="Quitar producto"
                              onClick={() => setForm({ ...form, items: form.items.filter((_, i) => i !== idx) })}
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {products.length === 0 && (
                <p className="mt-2 text-xs text-amber-700">No hay productos: créelos primero en el módulo de Inventario.</p>
              )}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="label">Compra neta (sin IVA)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="input"
                  value={form.neto}
                  onChange={(e) => setForm({ ...form, neto: e.target.value })}
                  placeholder="0.00"
                  required
                />
              </div>
            </div>
          )}

          <div className="rounded-lg border border-steel-100 bg-steel-50 p-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-navy">
              Cálculo fiscal y asiento automático
            </p>
            {preview ? (
              <>
                <div className="mb-3 grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <span className="text-xs text-slate-500">Compra neta</span>
                    <p className="font-semibold tabular-nums">{money(preview.calc.neto)}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">IVA Crédito 13%</span>
                    <p className="font-semibold tabular-nums">{money(preview.calc.iva)}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">Total a pagar</span>
                    <p className="font-bold tabular-nums text-navy">{money(preview.calc.total)}</p>
                  </div>
                </div>
                <table className="w-full text-xs">
                  <tbody>
                    {preview.lines.map((l, i) => (
                      <tr key={i} className="border-t border-steel-100">
                        <td className="py-1 font-mono">{l.cuenta}</td>
                        <td className={l.haber > 0 ? "pl-6" : ""}>{nameOf(l.cuenta)}</td>
                        <td className="num">{l.debe > 0 ? money(l.debe) : ""}</td>
                        <td className="num">{l.haber > 0 ? money(l.haber) : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : (
              <p className="text-sm text-slate-500">Ingrese el detalle de la compra para ver el IVA y el asiento.</p>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary">
              Guardar compra y generar asiento
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={!!toDelete} onClose={() => { setToDelete(null); setDeleteError(null); }} title="Eliminar compra">
        {deleteError && (
          <div className="mb-3">
            <Alert tone="error">{deleteError}</Alert>
          </div>
        )}
        <p className="text-sm text-slate-700">
          ¿Eliminar el CCF N° <strong>{toDelete?.numeroDoc}</strong> de <strong>{toDelete?.proveedor}</strong>?
          También se eliminarán su asiento en el Libro Diario y, si aplica, sus entradas en el Kardex.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => setToDelete(null)}>
            Cancelar
          </button>
          <button
            className="btn-danger"
            onClick={() => {
              if (!toDelete) return;
              const err = deletePurchase(toDelete.id);
              if (err) return setDeleteError(err);
              setNotice("Compra, asiento asociado y entradas del Kardex eliminados.");
              setToDelete(null);
            }}
          >
            Eliminar
          </button>
        </div>
      </Modal>
    </>
  );
}

