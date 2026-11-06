"use client";

import {
  AlertTriangle,
  CheckCircle2,
  LayoutDashboard,
  Receipt,
  Scale,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { Badge, MonthFilter, PageHeader } from "@/components/ui";
import { computeLedger, CUENTAS, isBalanced, r2, sortEntries, sumLines } from "@/lib/accounting";
import { fmtDate, money, monthOf, todayISO } from "@/lib/format";
import { useStore } from "@/lib/store";

function Kpi({
  label,
  value,
  hint,
  icon,
  tone = "navy",
}: {
  label: string;
  value: string;
  hint?: ReactNode;
  icon: ReactNode;
  tone?: "navy" | "green" | "red" | "amber";
}) {
  const bar = {
    navy: "bg-navy",
    green: "bg-emerald-600",
    red: "bg-red-600",
    amber: "bg-amber-500",
  }[tone];
  return (
    <div className="card relative overflow-hidden p-5">
      <div className={`absolute inset-y-0 left-0 w-1.5 ${bar}`} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-navy">{value}</p>
        </div>
        <div className="rounded-lg bg-steel-50 p-2.5 text-steel">{icon}</div>
      </div>
      {hint && <div className="mt-2 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

export default function DashboardPage() {
  const { data } = useStore();
  const [month, setMonth] = useState(() => todayISO().slice(0, 7));

  const k = useMemo(() => {
    const inMonth = (f: string) => !month || monthOf(f) === month;
    const sales = data.sales.filter((s) => inMonth(s.fecha));
    const purchases = data.purchases.filter((p) => inMonth(p.fecha));
    const ventasTotal = r2(sales.reduce((a, s) => a + s.total, 0));
    const ventasNeto = r2(sales.reduce((a, s) => a + s.neto + s.exenta, 0));
    const comprasTotal = r2(purchases.reduce((a, p) => a + p.total, 0));
    const comprasNeto = r2(purchases.reduce((a, p) => a + p.neto, 0));
    const ivaDebito = r2(sales.reduce((a, s) => a + s.iva, 0));
    const ivaCredito = r2(purchases.reduce((a, p) => a + p.iva, 0));

    const all = data.entries.flatMap((e) => e.lineas);
    const t = sumLines(all);

    const ledger = computeLedger(data.accounts, data.entries);
    const bal = (rubro: string) =>
      r2(ledger.filter((l) => l.account.rubro === rubro).reduce((a, l) => a + l.saldo, 0));
    const get = (code: string) => ledger.find((l) => l.account.codigo === code)?.saldo ?? 0;

    return {
      ventasTotal,
      ventasNeto,
      comprasTotal,
      comprasNeto,
      ivaDebito,
      ivaCredito,
      ivaSaldo: r2(ivaDebito - ivaCredito),
      nSales: sales.length,
      nPurchases: purchases.length,
      debe: t.debe,
      haber: t.haber,
      cuadra: isBalanced(t.debe, t.haber),
      activo: bal("Activo"),
      pasivo: bal("Pasivo"),
      patrimonio: bal("Patrimonio"),
      resultado: r2(bal("Ingresos") - bal("Costos y Gastos")),
      bancos: get(CUENTAS.BANCOS),
      clientes: get(CUENTAS.CLIENTES),
      inventario: get(CUENTAS.INVENTARIO),
      proveedores: get(CUENTAS.PROVEEDORES),
    };
  }, [data, month]);

  const recent = useMemo(() => sortEntries(data.entries).slice(-5).reverse(), [data.entries]);
  const maxBar = Math.max(k.ventasTotal, k.comprasTotal, 1);

  return (
    <>
      <PageHeader
        icon={LayoutDashboard}
        title="Dashboard Principal"
        subtitle="Indicadores contables en vivo · Constructora El Ingeniero"
        actions={<MonthFilter value={month} onChange={setMonth} />}
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Total Ventas del Mes"
          value={money(k.ventasTotal)}
          icon={<TrendingUp className="h-5 w-5" />}
          hint={
            <>
              {k.nSales} documento(s) · Neto {money(k.ventasNeto)}
            </>
          }
        />
        <Kpi
          label="Total Compras del Mes"
          value={money(k.comprasTotal)}
          icon={<ShoppingCart className="h-5 w-5" />}
          hint={
            <>
              {k.nPurchases} CCF · Neto {money(k.comprasNeto)}
            </>
          }
        />
        <Kpi
          label="Saldo de IVA (Débito − Crédito)"
          value={money(k.ivaSaldo)}
          tone={k.ivaSaldo > 0 ? "amber" : "green"}
          icon={<Receipt className="h-5 w-5" />}
          hint={
            <>
              Débito {money(k.ivaDebito)} − Crédito {money(k.ivaCredito)} ·{" "}
              <strong>{k.ivaSaldo > 0 ? "IVA por pagar" : k.ivaSaldo < 0 ? "Remanente a favor" : "Sin saldo"}</strong>
            </>
          }
        />
        <Kpi
          label="Estado de Cuadre del Diario"
          value={k.cuadra ? "CUADRADO" : "DESCUADRADO"}
          tone={k.cuadra ? "green" : "red"}
          icon={
            k.cuadra ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />
          }
          hint={
            <>
              Debe {money(k.debe)} {k.cuadra ? "=" : "≠"} Haber {money(k.haber)}
            </>
          }
        />
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-1">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-navy">
            Ventas vs. Compras {month ? "del mes" : "(acumulado)"}
          </h2>
          <div className="space-y-4">
            <div>
              <div className="mb-1 flex justify-between text-sm">
                <span className="font-medium text-slate-600">Ventas</span>
                <span className="font-semibold tabular-nums text-navy">{money(k.ventasTotal)}</span>
              </div>
              <div className="h-3 rounded-full bg-slate-100">
                <div className="h-3 rounded-full bg-navy" style={{ width: `${(k.ventasTotal / maxBar) * 100}%` }} />
              </div>
            </div>
            <div>
              <div className="mb-1 flex justify-between text-sm">
                <span className="font-medium text-slate-600">Compras</span>
                <span className="font-semibold tabular-nums text-navy">{money(k.comprasTotal)}</span>
              </div>
              <div className="h-3 rounded-full bg-slate-100">
                <div className="h-3 rounded-full bg-steel/70" style={{ width: `${(k.comprasTotal / maxBar) * 100}%` }} />
              </div>
            </div>
          </div>

          <h2 className="mb-3 mt-7 text-sm font-bold uppercase tracking-wide text-navy">Posición actual</h2>
          <dl className="space-y-2 text-sm">
            {[
              ["Bancos", k.bancos],
              ["Clientes por cobrar", k.clientes],
              ["Inventario de materiales", k.inventario],
              ["Proveedores por pagar", k.proveedores],
            ].map(([l, v]) => (
              <div key={l as string} className="flex justify-between border-b border-slate-100 pb-1.5">
                <dt className="text-slate-600">{l}</dt>
                <dd className="font-semibold tabular-nums">{money(v as number)}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <Scale className="h-4 w-4 text-navy" />
            <h2 className="text-sm font-bold uppercase tracking-wide text-navy">Ecuación contable</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              ["Activo", k.activo],
              ["Pasivo", k.pasivo],
              ["Patrimonio", k.patrimonio],
              ["Resultado del período", k.resultado],
            ].map(([l, v]) => (
              <div key={l as string} className="rounded-lg bg-steel-50 p-3">
                <p className="text-xs font-semibold uppercase text-slate-500">{l}</p>
                <p className="mt-1 text-lg font-bold tabular-nums text-navy">{money(v as number)}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Activo {money(k.activo)} {isBalanced(k.activo, r2(k.pasivo + k.patrimonio + k.resultado)) ? "=" : "≠"} Pasivo + Patrimonio + Resultado{" "}
            {money(r2(k.pasivo + k.patrimonio + k.resultado))}
          </p>

          <div className="mb-3 mt-6 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wide text-navy">Últimas partidas del Diario</h2>
            <Link href="/diario" className="text-xs font-semibold text-steel hover:underline">
              Ver Libro Diario →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>N°</th>
                  <th>Fecha</th>
                  <th>Concepto</th>
                  <th className="num">Monto</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((e) => (
                  <tr key={e.id}>
                    <td className="font-semibold">{e.numero}</td>
                    <td className="whitespace-nowrap">{fmtDate(e.fecha)}</td>
                    <td>
                      <span className="mr-2">{e.concepto}</span>
                      <Badge tone={e.origen === "venta" ? "green" : e.origen === "compra" ? "amber" : "blue"}>
                        {e.origen}
                      </Badge>
                    </td>
                    <td className="num font-semibold">{money(sumLines(e.lineas).debe)}</td>
                  </tr>
                ))}
                {recent.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-400">
                      Sin partidas registradas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  );
}

