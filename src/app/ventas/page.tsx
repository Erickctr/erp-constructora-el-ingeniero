"use client";

import { Plus, Search, Trash2, TrendingUp, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Alert, Badge, Modal, MonthFilter, PageHeader } from "@/components/ui";
import { buildSaleLines, calcSale, r2 } from "@/lib/accounting";
import { fmtDate, money, monthOf, parseAmount, todayISO } from "@/lib/format";
import { computeKardex, costOfIssue } from "@/lib/inventory";
import { useStore } from "@/lib/store";
import type { Condicion, Sale, TipoDoc } from "@/lib/types";

interface Form {
  fecha: string;
  tipoDoc: TipoDoc;
  numeroDoc: string;
  cliente: string;
  registro: string;
  condicion: Condicion;
  items: { productoId: string; cantidad: string; precio: string }[];
  exenta: string;
}

const emptyItem = () => ({ productoId: "", cantidad: "", precio: "" });

const emptyForm = (): Form => ({
  fecha: todayISO(),
  tipoDoc: "CCF",
  numeroDoc: "",
  cliente: "",
  registro: "",
  condicion: "Contado",
  items: [emptyItem()],
  exenta: "",
});

export default function VentasPage() {
  const { data, addSale, deleteSale } = useStore();
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [month, setMonth] = useState("");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Sale | null>(null);

  const nameOf = (code: string) => data.accounts.find((a) => a.codigo === code)?.nombre ?? "";
  const entryNum = (id: string) => data.entries.find((e) => e.id === id)?.numero;

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return [...data.sales]
      .filter((x) => !month || monthOf(x.fecha) === month)
      .filter(
        (x) =>
          !s ||
          x.cliente.toLowerCase().includes(s) ||
          x.numeroDoc.toLowerCase().includes(s) ||
          x.registro.toLowerCase().includes(s)
      )
      .sort((a, b) => (a.fecha === b.fecha ? a.correlativo - b.correlativo : a.fecha < b.fecha ? -1 : 1));
  }, [data.sales, month, q]);

  const tot = useMemo(
    () => ({
      exenta: r2(rows.reduce((a, x) => a + x.exenta, 0)),
      neto: r2(rows.reduce((a, x) => a + x.neto, 0)),
      iva: r2(rows.reduce((a, x) => a + x.iva, 0)),
      total: r2(rows.reduce((a, x) => a + x.total, 0)),
      costo: r2(rows.reduce((a, x) => a + (x.costoVenta ?? 0), 0)),
    }),
    [rows]
  );

  const kardex = useMemo(
    () => new Map(data.products.map((p) => [p.id, computeKardex(p, data.movements)])),
    [data.products, data.movements]
  );
  const products = useMemo(
    () => [...data.products].sort((a, b) => a.codigo.localeCompare(b.codigo)),
    [data.products]
  );
  const prodLabel = (id: string) => {
    const p = data.products.find((x) => x.id === id);
    return p ? `${p.codigo} · ${p.nombre}` : "—";
  };

  const preview = useMemo(() => {
    const items = form.items
      .map((it) => ({ ...it, q: parseAmount(it.cantidad), pu: parseAmount(it.precio) }))
      .filter((it) => it.productoId && it.q > 0 && it.pu > 0);
    if (items.length === 0) return null;
    const monto = r2(items.reduce((a, it) => a + it.q * it.pu, 0));
    let costo = 0;
    for (const it of items) {
      const k = kardex.get(it.productoId);
      if (k && it.q <= k.existencia) costo += costOfIssue(k, it.q);
    }
    costo = r2(costo);
    const calc = calcSale(form.tipoDoc, monto, form.tipoDoc === "CCF" ? parseAmount(form.exenta) : 0);
    return { calc, costo, lines: buildSaleLines(form.condicion, calc, costo) };
  }, [form, kardex]);

  const setItem = (idx: number, patch: Partial<Form["items"][number]>) =>
    setForm({ ...form, items: form.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const err = addSale({
      fecha: form.fecha,
      tipoDoc: form.tipoDoc,
      numeroDoc: form.numeroDoc,
      cliente: form.tipoDoc === "FAC" && !form.cliente.trim() ? "Consumidor Final" : form.cliente,
      registro: form.registro,
      condicion: form.condicion,
      items: form.items
        .filter((it) => it.productoId)
        .map((it) => ({
          productoId: it.productoId,
          cantidad: parseAmount(it.cantidad),
          precioUnitario: parseAmount(it.precio),
        })),
      exenta: form.tipoDoc === "CCF" ? parseAmount(form.exenta) : 0,
    });
    if (err) return setError(err);
    setNotice("Venta registrada: partida generada en el Libro Diario y salida valuada al costo promedio en el Kardex.");
    setOpen(false);
  }

  return (
    <>
      <PageHeader
        icon={TrendingUp}
        title="Libro de Ventas"
        subtitle="Art. 141 del Código Tributario · IVA Débito Fiscal 13% · Integración automática con el Libro Diario"
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
            <Plus className="h-4 w-4" /> Registrar venta
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
            placeholder="Buscar cliente, N° documento o NRC…"
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
              <th>Doc.</th>
              <th>N° Documento</th>
              <th>Cliente</th>
              <th>NRC / NIT</th>
              <th>Condición</th>
              <th className="num">Exentas</th>
              <th className="num">Gravadas</th>
              <th className="num">Débito Fiscal</th>
              <th className="num">Total</th>
              <th className="num">Costo de venta</th>
              <th>Partida</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id}>
                <td>{s.correlativo}</td>
                <td className="whitespace-nowrap">{fmtDate(s.fecha)}</td>
                <td>
                  <Badge tone={s.tipoDoc === "CCF" ? "blue" : "slate"}>{s.tipoDoc}</Badge>
                </td>
                <td className="font-mono">{s.numeroDoc}</td>
                <td>{s.cliente}</td>
                <td className="whitespace-nowrap">{s.registro || "—"}</td>
                <td>
                  <Badge tone={s.condicion === "Contado" ? "green" : "amber"}>{s.condicion}</Badge>
                </td>
                <td className="num">{money(s.exenta)}</td>
                <td className="num">{money(s.neto)}</td>
                <td className="num">{money(s.iva)}</td>
                <td className="num font-semibold">{money(s.total)}</td>
                <td
                  className="num text-slate-600"
                  title={(s.items ?? []).map((it) => `${prodLabel(it.productoId)}: ${it.cantidad} u · costo ${money(it.costoTotal)}`).join("\n")}
                >
                  {money(s.costoVenta ?? 0)}
                </td>
                <td className="text-center font-semibold text-steel">#{entryNum(s.asientoId) ?? "—"}</td>
                <td>
                  <button
                    className="btn-icon hover:!text-red-600"
                    title="Eliminar venta y su partida"
                    onClick={() => { setDeleteError(null); setToDelete(s); }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={14} className="py-8 text-center text-slate-400">
                  No hay ventas registradas para este filtro.
                </td>
              </tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={7}>TOTALES ({rows.length})</td>
                <td className="num">{money(tot.exenta)}</td>
                <td className="num">{money(tot.neto)}</td>
                <td className="num">{money(tot.iva)}</td>
                <td className="num">{money(tot.total)}</td>
                <td className="num">{money(tot.costo)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Registrar venta" wide>
        <form onSubmit={submit} className="space-y-4">
          {error && <Alert tone="error">{error}</Alert>}
          <div className="grid gap-4 sm:grid-cols-4">
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
              <label className="label">Tipo de documento</label>
              <select
                className="input"
                value={form.tipoDoc}
                onChange={(e) => setForm({ ...form, tipoDoc: e.target.value as TipoDoc })}
              >
                <option value="CCF">CCF · Crédito Fiscal</option>
                <option value="FAC">FAC · Consumidor Final</option>
              </select>
            </div>
            <div>
              <label className="label">N° de documento</label>
              <input
                className="input font-mono"
                value={form.numeroDoc}
                onChange={(e) => setForm({ ...form, numeroDoc: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label">Condición de cobro</label>
              <select
                className="input"
                value={form.condicion}
                onChange={(e) => setForm({ ...form, condicion: e.target.value as Condicion })}
              >
                <option value="Contado">Contado (Bancos)</option>
                <option value="Crédito">Crédito (Clientes)</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="label">{form.tipoDoc === "CCF" ? "Cliente" : "Cliente (opcional)"}</label>
              <input
                className="input"
                value={form.cliente}
                onChange={(e) => setForm({ ...form, cliente: e.target.value })}
                placeholder={form.tipoDoc === "FAC" ? "Consumidor Final" : "Razón social del cliente"}
                required={form.tipoDoc === "CCF"}
              />
            </div>
            <div>
              <label className="label">{form.tipoDoc === "CCF" ? "NRC / NIT" : "DUI / NIT (opcional)"}</label>
              <input
                className="input"
                value={form.registro}
                onChange={(e) => setForm({ ...form, registro: e.target.value })}
              />
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="label !mb-0">
                Detalle de productos ·{" "}
                {form.tipoDoc === "CCF" ? "precio unitario sin IVA" : "precio unitario con IVA incluido"}
              </label>
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
                    <th className="px-2 py-2 text-right">Existencia</th>
                    <th className="px-2 py-2 text-right">Cantidad</th>
                    <th className="px-2 py-2 text-right">Precio unit.</th>
                    <th className="px-2 py-2 text-right">Subtotal</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {form.items.map((it, idx) => {
                    const k = it.productoId ? kardex.get(it.productoId) : undefined;
                    const q = parseAmount(it.cantidad);
                    const over = !!k && q > k.existencia;
                    return (
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
                        <td className={`px-2 py-1.5 text-right tabular-nums ${over ? "font-semibold text-red-600" : "text-slate-500"}`}>
                          {k ? `${k.existencia} ${k.product.unidad.toLowerCase()}` : "—"}
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
                            value={it.precio}
                            onChange={(e) => setItem(idx, { precio: e.target.value })}
                            placeholder="0.00"
                          />
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">
                          {money(r2(q * parseAmount(it.precio)))}
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {form.tipoDoc === "CCF" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Venta exenta no inventariable (opcional)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="input"
                  value={form.exenta}
                  onChange={(e) => setForm({ ...form, exenta: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>
          )}

          <div className="rounded-lg border border-steel-100 bg-steel-50 p-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-navy">
              Cálculo fiscal y partida automática
            </p>
            {preview ? (
              <>
                <div className="mb-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <div>
                    <span className="text-xs text-slate-500">Venta neta</span>
                    <p className="font-semibold tabular-nums">{money(preview.calc.neto)}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">IVA Débito 13%</span>
                    <p className="font-semibold tabular-nums">{money(preview.calc.iva)}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">Total</span>
                    <p className="font-bold tabular-nums text-navy">{money(preview.calc.total)}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">Costo de venta (promedio)</span>
                    <p className="font-semibold tabular-nums">{money(preview.costo)}</p>
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
              <p className="text-sm text-slate-500">Seleccione productos, cantidades y precios para ver el IVA, el costo de venta y la partida.</p>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary">
              Guardar venta y generar partida
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={!!toDelete} onClose={() => { setToDelete(null); setDeleteError(null); }} title="Eliminar venta">
        {deleteError && (
          <div className="mb-3">
            <Alert tone="error">{deleteError}</Alert>
          </div>
        )}
        <p className="text-sm text-slate-700">
          ¿Eliminar {toDelete?.tipoDoc} N° <strong>{toDelete?.numeroDoc}</strong> de{" "}
          <strong>{toDelete?.cliente}</strong>? También se eliminarán su partida en el Libro Diario y sus salidas en el Kardex.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => setToDelete(null)}>
            Cancelar
          </button>
          <button
            className="btn-danger"
            onClick={() => {
              if (!toDelete) return;
              const err = deleteSale(toDelete.id);
              if (err) return setDeleteError(err);
              setNotice("Venta, partida asociada y salidas del Kardex eliminadas.");
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

