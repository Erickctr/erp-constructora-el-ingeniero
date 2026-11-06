"use client";

import { AlertTriangle, BookOpen, CheckCircle2, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Alert, Badge, Modal, MonthFilter, PageHeader } from "@/components/ui";
import { isBalanced, r2, sortEntries, sumLines } from "@/lib/accounting";
import { fmtDate, money, monthOf, parseAmount, todayISO } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { JournalEntry } from "@/lib/types";

interface FormLine {
  cuenta: string;
  debe: string;
  haber: string;
}

const blankLines = (): FormLine[] => [
  { cuenta: "", debe: "", haber: "" },
  { cuenta: "", debe: "", haber: "" },
];

const ORIGEN_TONE = { apertura: "navy", manual: "blue", venta: "green", compra: "amber" } as const;

export default function DiarioPage() {
  const { data, addManualEntry, deleteEntry } = useStore();
  const [month, setMonth] = useState("");
  const [open, setOpen] = useState(false);
  const [fecha, setFecha] = useState(todayISO());
  const [concepto, setConcepto] = useState("");
  const [lines, setLines] = useState<FormLine[]>(blankLines);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [toDelete, setToDelete] = useState<JournalEntry | null>(null);

  const detalle = useMemo(
    () =>
      data.accounts
        .filter((a) => a.tipo === "Detalle")
        .sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true })),
    [data.accounts]
  );
  const nameOf = (code: string) => data.accounts.find((a) => a.codigo === code)?.nombre ?? "(cuenta eliminada)";

  const entries = useMemo(
    () => sortEntries(data.entries).filter((e) => !month || monthOf(e.fecha) === month),
    [data.entries, month]
  );
  const shown = useMemo(() => sumLines(entries.flatMap((e) => e.lineas)), [entries]);
  const global = useMemo(() => sumLines(data.entries.flatMap((e) => e.lineas)), [data.entries]);
  const globalOk = isBalanced(global.debe, global.haber);

  // Totales del formulario
  const parsed = lines.map((l) => ({ cuenta: l.cuenta, debe: parseAmount(l.debe), haber: parseAmount(l.haber) }));
  const ft = sumLines(parsed);
  const hasAmounts = ft.debe > 0 || ft.haber > 0;
  const formBalanced = hasAmounts && isBalanced(ft.debe, ft.haber);
  const diff = r2(Math.abs(ft.debe - ft.haber));

  function openForm() {
    setFecha(todayISO());
    setConcepto("");
    setLines(blankLines());
    setError(null);
    setNotice(null);
    setOpen(true);
  }

  function setLine(i: number, patch: Partial<FormLine>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!formBalanced) {
      setError(
        hasAmounts
          ? `PARTIDA DESCUADRADA: Debe ${money(ft.debe)} ≠ Haber ${money(ft.haber)} (diferencia ${money(diff)}). No se puede guardar.`
          : "Ingrese los importes de la partida."
      );
      return;
    }
    const err = addManualEntry({ fecha, concepto, lineas: parsed });
    if (err) return setError(err);
    setNotice({ tone: "success", text: "Partida registrada correctamente (Debe = Haber)." });
    setOpen(false);
  }

  return (
    <>
      <PageHeader
        icon={BookOpen}
        title="Libro Diario"
        subtitle="Partidas cronológicas en partida doble · Debe = Haber"
        actions={
          <button className="btn-primary" onClick={openForm}>
            <Plus className="h-4 w-4" /> Nueva partida manual
          </button>
        }
      />

      {notice && (
        <div className="mb-4">
          <Alert tone={notice.tone}>{notice.text}</Alert>
        </div>
      )}

      <div
        className={`card mb-4 flex flex-col gap-3 border-l-4 p-4 sm:flex-row sm:items-center sm:justify-between ${
          globalOk ? "border-l-emerald-600" : "border-l-red-600"
        }`}
      >
        <div className="flex items-center gap-3">
          {globalOk ? (
            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
          ) : (
            <AlertTriangle className="h-6 w-6 text-red-600" />
          )}
          <div>
            <p className="font-bold text-navy">{globalOk ? "Diario cuadrado" : "Diario DESCUADRADO"}</p>
            <p className="text-sm text-slate-600">
              Sumas totales: Debe {money(global.debe)} {globalOk ? "=" : "≠"} Haber {money(global.haber)} ·{" "}
              {data.entries.length} partida(s)
            </p>
          </div>
        </div>
        <MonthFilter value={month} onChange={setMonth} />
      </div>

      <div className="space-y-4">
        {entries.map((e) => {
          const t = sumLines(e.lineas);
          return (
            <div key={e.id} className="card overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-navy-50 px-4 py-2.5">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="rounded bg-navy px-2 py-0.5 text-xs font-bold text-white">Partida N° {e.numero}</span>
                  <span className="font-semibold text-navy">{fmtDate(e.fecha)}</span>
                  <Badge tone={ORIGEN_TONE[e.origen]}>{e.origen}</Badge>
                </div>
                {e.origen === "manual" || e.origen === "apertura" ? (
                  <button
                    className="btn-icon hover:!text-red-600"
                    title="Eliminar partida"
                    onClick={() => setToDelete(e)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : (
                  <span className="text-xs text-slate-400">Generada automáticamente</span>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th className="w-28">Código</th>
                      <th>Cuenta</th>
                      <th className="num w-36">Debe</th>
                      <th className="num w-36">Haber</th>
                    </tr>
                  </thead>
                  <tbody>
                    {e.lineas.map((l, i) => (
                      <tr key={i}>
                        <td className="font-mono">{l.cuenta}</td>
                        <td className={l.haber > 0 ? "pl-10" : ""}>{nameOf(l.cuenta)}</td>
                        <td className="num">{l.debe > 0 ? money(l.debe) : ""}</td>
                        <td className="num">{l.haber > 0 ? money(l.haber) : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={2} className="!font-normal italic">
                        V/ {e.concepto}
                      </td>
                      <td className="num">{money(t.debe)}</td>
                      <td className="num">{money(t.haber)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          );
        })}
        {entries.length === 0 && (
          <div className="card p-10 text-center text-slate-400">No hay partidas para el filtro seleccionado.</div>
        )}
      </div>

      {entries.length > 0 && (
        <div className="card mt-4 overflow-x-auto">
          <table className="table-base">
            <tfoot>
              <tr>
                <td>SUMAS {month ? "DEL PERÍODO" : "TOTALES"}</td>
                <td className="num w-40">DEBE {money(shown.debe)}</td>
                <td className="num w-40">HABER {money(shown.haber)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Nueva partida manual" wide>
        <form onSubmit={submit} className="space-y-4">
          {error && <Alert tone="error">{error}</Alert>}
          <div className="grid gap-4 sm:grid-cols-4">
            <div>
              <label className="label">Fecha</label>
              <input type="date" className="input" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
            </div>
            <div className="sm:col-span-3">
              <label className="label">Concepto de la partida</label>
              <input
                className="input"
                value={concepto}
                onChange={(e) => setConcepto(e.target.value)}
                placeholder="Ej. Pago de planilla administrativa"
                required
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-500">
                  <th className="pb-1 pr-2">Cuenta</th>
                  <th className="w-32 pb-1 pr-2 text-right">Debe</th>
                  <th className="w-32 pb-1 pr-2 text-right">Haber</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={i}>
                    <td className="py-1 pr-2">
                      <select className="input" value={l.cuenta} onChange={(e) => setLine(i, { cuenta: e.target.value })}>
                        <option value="">Seleccione cuenta…</option>
                        {detalle.map((a) => (
                          <option key={a.id} value={a.codigo}>
                            {a.codigo} — {a.nombre}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-1 pr-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="input text-right"
                        value={l.debe}
                        onChange={(e) => setLine(i, { debe: e.target.value, haber: e.target.value ? "" : l.haber })}
                        placeholder="0.00"
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="input text-right"
                        value={l.haber}
                        onChange={(e) => setLine(i, { haber: e.target.value, debe: e.target.value ? "" : l.debe })}
                        placeholder="0.00"
                      />
                    </td>
                    <td className="py-1">
                      <button
                        type="button"
                        className="btn-icon hover:!text-red-600"
                        disabled={lines.length <= 2}
                        onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}
                        title="Quitar línea"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-navy font-bold text-navy">
                  <td className="pt-2">
                    <button
                      type="button"
                      className="btn-secondary !py-1.5"
                      onClick={() => setLines((ls) => [...ls, { cuenta: "", debe: "", haber: "" }])}
                    >
                      <Plus className="h-4 w-4" /> Agregar línea
                    </button>
                  </td>
                  <td className="pr-2 pt-2 text-right tabular-nums">{money(ft.debe)}</td>
                  <td className="pr-2 pt-2 text-right tabular-nums">{money(ft.haber)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          {hasAmounts &&
            (formBalanced ? (
              <Alert tone="success">
                <CheckCircle2 className="mr-1 inline h-4 w-4" />
                Partida cuadrada: Debe = Haber = {money(ft.debe)}
              </Alert>
            ) : (
              <Alert tone="error">
                <AlertTriangle className="mr-1 inline h-4 w-4" />
                <strong>Partida descuadrada.</strong> Debe {money(ft.debe)} ≠ Haber {money(ft.haber)} · Diferencia{" "}
                {money(diff)}. El guardado está bloqueado hasta que ambas sumas sean idénticas.
              </Alert>
            ))}

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={!formBalanced}>
              Guardar partida
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={!!toDelete} onClose={() => setToDelete(null)} title="Eliminar partida">
        <p className="text-sm text-slate-700">
          ¿Eliminar la partida N° <strong>{toDelete?.numero}</strong>? {toDelete?.concepto}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => setToDelete(null)}>
            Cancelar
          </button>
          <button
            className="btn-danger"
            onClick={() => {
              if (toDelete) {
                const err = deleteEntry(toDelete.id);
                setNotice(err ? { tone: "error", text: err } : { tone: "success", text: "Partida eliminada." });
              }
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

