"use client";

import { AlertTriangle, BookMarked, CheckCircle2, Scale, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Alert, Badge, PageHeader } from "@/components/ui";
import { computeLedger, isBalanced, r2, type LedgerAccount } from "@/lib/accounting";
import { fmtDate, money } from "@/lib/format";
import { useStore } from "@/lib/store";

function TAccount({ l }: { l: LedgerAccount }) {
  const deudora = l.account.naturaleza === "Deudora";
  const contrario = l.saldo < 0;
  const lado = (l.saldo >= 0 ? deudora : !deudora) ? "Deudor" : "Acreedor";
  return (
    <div className="card overflow-hidden">
      <div className="flex items-start justify-between gap-2 bg-navy px-4 py-2.5 text-white">
        <div>
          <p className="font-mono text-xs text-blue-200">{l.account.codigo}</p>
          <p className="text-sm font-bold leading-tight">{l.account.nombre}</p>
        </div>
        <Badge tone={deudora ? "blue" : "amber"}>{l.account.naturaleza}</Badge>
      </div>

      <div className="grid grid-cols-2 divide-x-2 divide-navy/70">
        <div>
          <p className="border-b-2 border-navy bg-navy-50 py-1 text-center text-xs font-bold uppercase text-navy">
            Debe (Cargos)
          </p>
          <ul className="min-h-[3.5rem] divide-y divide-slate-100 text-xs">
            {l.movimientos
              .filter((m) => m.debe > 0)
              .map((m, i) => (
                <li key={i} className="flex items-center justify-between gap-2 px-2.5 py-1.5" title={`${fmtDate(m.fecha)} · ${m.concepto}`}>
                  <span className="text-slate-500">P-{m.numero}</span>
                  <span className="font-semibold tabular-nums">{money(m.debe)}</span>
                </li>
              ))}
          </ul>
        </div>
        <div>
          <p className="border-b-2 border-navy bg-navy-50 py-1 text-center text-xs font-bold uppercase text-navy">
            Haber (Abonos)
          </p>
          <ul className="min-h-[3.5rem] divide-y divide-slate-100 text-xs">
            {l.movimientos
              .filter((m) => m.haber > 0)
              .map((m, i) => (
                <li key={i} className="flex items-center justify-between gap-2 px-2.5 py-1.5" title={`${fmtDate(m.fecha)} · ${m.concepto}`}>
                  <span className="text-slate-500">P-{m.numero}</span>
                  <span className="font-semibold tabular-nums">{money(m.haber)}</span>
                </li>
              ))}
          </ul>
        </div>
      </div>

      <div className="grid grid-cols-2 divide-x-2 divide-navy/70 border-t-2 border-navy bg-slate-50 text-sm font-bold tabular-nums">
        <p className="px-2.5 py-1.5 text-right">{money(l.debe)}</p>
        <p className="px-2.5 py-1.5 text-right">{money(l.haber)}</p>
      </div>
      <div className="flex items-center justify-between border-t border-slate-200 bg-steel-50 px-4 py-2.5">
        <span className="text-xs font-semibold uppercase text-slate-500">
          Saldo final {contrario ? `(contrario · ${lado})` : `(${lado})`}
        </span>
        <span className={`text-base font-bold tabular-nums ${contrario ? "text-red-600" : "text-navy"}`}>
          {money(Math.abs(l.saldo))}
        </span>
      </div>
    </div>
  );
}

export default function MayorPage() {
  const { data } = useStore();
  const [q, setQ] = useState("");
  const [showEmpty, setShowEmpty] = useState(false);

  const ledger = useMemo(() => computeLedger(data.accounts, data.entries), [data.accounts, data.entries]);
  const withMoves = ledger.filter((l) => l.movimientos.length > 0);
  const visible = (showEmpty ? ledger : withMoves).filter((l) => {
    const s = q.trim().toLowerCase();
    return !s || l.account.codigo.toLowerCase().includes(s) || l.account.nombre.toLowerCase().includes(s);
  });

  const totals = useMemo(() => {
    const sum = (f: (l: LedgerAccount) => number) => r2(withMoves.reduce((a, l) => a + f(l), 0));
    return {
      debe: sum((l) => l.debe),
      haber: sum((l) => l.haber),
      deudor: sum((l) => l.saldoDeudor),
      acreedor: sum((l) => l.saldoAcreedor),
    };
  }, [withMoves]);

  const sumasOk = isBalanced(totals.debe, totals.haber);
  const saldosOk = isBalanced(totals.deudor, totals.acreedor);

  return (
    <>
      <PageHeader
        icon={BookMarked}
        title="Libro Diario Mayor"
        subtitle="Mayorización automática a partir del Libro Diario · Cuentas T y Balance de Comprobación"
      />

      <div className="card mb-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Buscar cuenta…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={showEmpty} onChange={(e) => setShowEmpty(e.target.checked)} />
          Mostrar cuentas sin movimiento
        </label>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((l) => (
          <TAccount key={l.account.id} l={l} />
        ))}
      </section>
      {visible.length === 0 && (
        <div className="card p-10 text-center text-slate-400">No hay cuentas con movimientos para mostrar.</div>
      )}

      <section className="mt-8">
        <div className="mb-3 flex items-center gap-2">
          <Scale className="h-5 w-5 text-navy" />
          <h2 className="text-lg font-bold text-navy">Balance de Comprobación de Sumas y Saldos</h2>
        </div>

        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th rowSpan={2}>Código</th>
                <th rowSpan={2}>Cuenta</th>
                <th colSpan={2} className="num !text-center">
                  Sumas
                </th>
                <th colSpan={2} className="num !text-center">
                  Saldos
                </th>
              </tr>
              <tr>
                <th className="num">Debe</th>
                <th className="num">Haber</th>
                <th className="num">Deudor</th>
                <th className="num">Acreedor</th>
              </tr>
            </thead>
            <tbody>
              {withMoves.map((l) => (
                <tr key={l.account.id}>
                  <td className="font-mono">{l.account.codigo}</td>
                  <td>{l.account.nombre}</td>
                  <td className="num">{money(l.debe)}</td>
                  <td className="num">{money(l.haber)}</td>
                  <td className="num">{l.saldoDeudor > 0 ? money(l.saldoDeudor) : ""}</td>
                  <td className="num">{l.saldoAcreedor > 0 ? money(l.saldoAcreedor) : ""}</td>
                </tr>
              ))}
              {withMoves.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Sin movimientos en el Libro Diario.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}>SUMAS IGUALES</td>
                <td className="num">{money(totals.debe)}</td>
                <td className="num">{money(totals.haber)}</td>
                <td className="num">{money(totals.deudor)}</td>
                <td className="num">{money(totals.acreedor)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="mt-4">
          {sumasOk && saldosOk ? (
            <Alert tone="success">
              <CheckCircle2 className="mr-1 inline h-4 w-4" />
              Balance de comprobación cuadrado: Suma Debe = Suma Haber = {money(totals.debe)} · Saldos Deudores ={" "}
              Saldos Acreedores = {money(totals.deudor)}.
            </Alert>
          ) : (
            <Alert tone="error">
              <AlertTriangle className="mr-1 inline h-4 w-4" />
              El balance de comprobación NO cuadra. Revise las partidas del Libro Diario.
            </Alert>
          )}
        </div>
      </section>
    </>
  );
}

