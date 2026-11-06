"use client";

import { Plus, Search, Trash2, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { Alert, Badge, Modal, MonthFilter, PageHeader } from "@/components/ui";
import { buildSaleLines, calcSale, r2 } from "@/lib/accounting";
import { fmtDate, money, monthOf, parseAmount, todayISO } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { Condicion, Sale, TipoDoc } from "@/lib/types";

interface Form {
  fecha: string;
  tipoDoc: TipoDoc;
  numeroDoc: string;
  cliente: string;
  registro: string;
  condicion: Condicion;
  monto: string;
  exenta: string;
}

const emptyForm = (): Form => ({
  fecha: todayISO(),
  tipoDoc: "CCF",
  numeroDoc: "",
  cliente: "",
  registro: "",
  condicion: "Contado",
  monto: "",
  exenta: "",
});

export default function VentasPage() {
  const { data, addSale, deleteSale } = useStore();
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
    }),
    [rows]
  );

  const preview = useMemo(() => {
    const monto = parseAmount(form.monto);
    if (monto <= 0) return null;
    const calc = calcSale(form.tipoDoc, monto, form.tipoDoc === "CCF" ? parseAmount(form.exenta) : 0);
    return { calc, lines: buildSaleLines(form.condicion, calc) };
  }, [form]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const err = addSale({
      fecha: form.fecha,
      tipoDoc: form.tipoDoc,
      numeroDoc: form.numeroDoc,
      cliente: form.tipoDoc === "FAC" && !form.cliente.trim() ? "Consumidor Final" : form.cliente,
      registro: form.registro,
      condicion: form.condicion,
      monto: parseAmount(form.monto),
      exenta: form.tipoDoc === "CCF" ? parseAmount(form.exenta) : 0,
    });
    if (err) return setError(err);
    setNotice("Venta registrada y partida generada automáticamente en el Libro Diario.");
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
                <td className="text-center font-semibold text-steel">#{entryNum(s.asientoId) ?? "—"}</td>
                <td>
                  <button
                    className="btn-icon hover:!text-red-600"
                    title="Eliminar venta y su partida"
                    onClick={() => setToDelete(s)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={13} className="py-8 text-center text-slate-400">
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

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">
                {form.tipoDoc === "CCF" ? "Venta neta gravada (sin IVA)" : "Total facturado (IVA incluido)"}
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="input"
                value={form.monto}
                onChange={(e) => setForm({ ...form, monto: e.target.value })}
                placeholder="0.00"
                required
              />
            </div>
            {form.tipoDoc === "CCF" && (
              <div>
                <label className="label">Venta exenta (opcional)</label>
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
            )}
          </div>

          <div className="rounded-lg border border-steel-100 bg-steel-50 p-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-navy">
              Cálculo fiscal y partida automática
            </p>
            {preview ? (
              <>
                <div className="mb-3 grid grid-cols-3 gap-3 text-sm">
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
              <p className="text-sm text-slate-500">Ingrese el monto para ver el desglose del IVA y la partida.</p>
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

      <Modal open={!!toDelete} onClose={() => setToDelete(null)} title="Eliminar venta">
        <p className="text-sm text-slate-700">
          ¿Eliminar {toDelete?.tipoDoc} N° <strong>{toDelete?.numeroDoc}</strong> de{" "}
          <strong>{toDelete?.cliente}</strong>? También se eliminará su partida en el Libro Diario.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => setToDelete(null)}>
            Cancelar
          </button>
          <button
            className="btn-danger"
            onClick={() => {
              if (toDelete) deleteSale(toDelete.id);
              setNotice("Venta y partida asociada eliminadas.");
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

