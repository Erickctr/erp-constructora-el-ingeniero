"use client";

import { Boxes, CheckCircle2, Pencil, Plus, Trash2, AlertTriangle } from "lucide-react";
import { useMemo, useState } from "react";
import { Alert, Badge, Modal, PageHeader } from "@/components/ui";
import { computeLedger, CUENTAS, isBalanced, r2 } from "@/lib/accounting";
import { fmtDate, money } from "@/lib/format";
import { computeKardex } from "@/lib/inventory";
import { useStore } from "@/lib/store";
import type { Product } from "@/lib/types";

const cu = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});
const qty = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

interface Form {
  codigo: string;
  nombre: string;
  unidad: string;
}
const emptyForm: Form = { codigo: "", nombre: "", unidad: "" };

export default function InventarioPage() {
  const { data, addProduct, updateProduct, deleteProduct } = useStore();
  const [selected, setSelected] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Product | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const kardexes = useMemo(
    () =>
      [...data.products]
        .sort((a, b) => a.codigo.localeCompare(b.codigo))
        .map((p) => computeKardex(p, data.movements)),
    [data.products, data.movements]
  );

  const totalKardex = r2(kardexes.reduce((a, k) => a + k.valor, 0));
  const saldoCuenta = useMemo(
    () =>
      computeLedger(data.accounts, data.entries).find((l) => l.account.codigo === CUENTAS.INVENTARIO)?.saldo ?? 0,
    [data.accounts, data.entries]
  );
  const conciliado = isBalanced(totalKardex, saldoCuenta);

  const current = kardexes.find((k) => k.product.id === selected) ?? kardexes[0];

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setError(null);
    setNotice(null);
    setOpen(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setForm({ codigo: p.codigo, nombre: p.nombre, unidad: p.unidad });
    setError(null);
    setNotice(null);
    setOpen(true);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const err = editing ? updateProduct(editing.id, form) : addProduct(form);
    if (err) return setError(err);
    setNotice(editing ? "Producto actualizado." : "Producto creado. Sus existencias ingresan mediante el Libro de Compras.");
    setOpen(false);
  }

  return (
    <>
      <PageHeader
        icon={Boxes}
        title="Inventario · Kardex"
        subtitle="Inventario perpetuo · Costo Promedio Ponderado móvil (NIIF para las PYMES, Sección 13 · Art. 142 CT)"
        actions={
          <button className="btn-primary" onClick={openNew}>
            <Plus className="h-4 w-4" /> Nuevo producto
          </button>
        }
      />

      {notice && (
        <div className="mb-4">
          <Alert tone="success">{notice}</Alert>
        </div>
      )}

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <div className="card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Valor total del Kardex</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-navy">{money(totalKardex)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Saldo cuenta {CUENTAS.INVENTARIO} (Libro Mayor)
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-navy">{money(saldoCuenta)}</p>
        </div>
        <div className="card flex items-center gap-3 p-4">
          {conciliado ? (
            <CheckCircle2 className="h-8 w-8 shrink-0 text-emerald-600" />
          ) : (
            <AlertTriangle className="h-8 w-8 shrink-0 text-red-600" />
          )}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Conciliación Kardex vs. Mayor</p>
            <p className={`font-bold ${conciliado ? "text-emerald-700" : "text-red-700"}`}>
              {conciliado ? "CONCILIADO" : `DIFERENCIA ${money(r2(saldoCuenta - totalKardex))}`}
            </p>
          </div>
        </div>
      </div>

      <div className="card mb-6 overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>Código</th>
              <th>Producto</th>
              <th>Unidad</th>
              <th className="num">Existencia</th>
              <th className="num">Costo promedio</th>
              <th className="num">Valor</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {kardexes.map((k) => (
              <tr
                key={k.product.id}
                className={`cursor-pointer ${current?.product.id === k.product.id ? "bg-steel-50" : ""}`}
                onClick={() => setSelected(k.product.id)}
              >
                <td className="font-mono">{k.product.codigo}</td>
                <td>{k.product.nombre}</td>
                <td>{k.product.unidad}</td>
                <td className="num">{qty.format(k.existencia)}</td>
                <td className="num">{cu.format(k.costoPromedio)}</td>
                <td className="num font-semibold">{money(k.valor)}</td>
                <td onClick={(e) => e.stopPropagation()}>
                  <div className="flex gap-1">
                    <button className="btn-icon" title="Editar" onClick={() => openEdit(k.product)}>
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      className="btn-icon hover:!text-red-600"
                      title={k.rows.length ? "Con movimientos: no se puede eliminar" : "Eliminar"}
                      onClick={() => {
                        setDeleteError(null);
                        setToDelete(k.product);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {kardexes.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-400">
                  No hay productos registrados.
                </td>
              </tr>
            )}
          </tbody>
          {kardexes.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={5}>TOTAL INVENTARIO</td>
                <td className="num">{money(totalKardex)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {current && (
        <div className="card overflow-x-auto">
          <div className="flex flex-col gap-1 border-b border-slate-200 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-base font-bold text-navy">
              Tarjeta de Kardex · {current.product.codigo} — {current.product.nombre}
            </h2>
            <span className="text-xs text-slate-500">Unidad: {current.product.unidad} · Método: Promedio Ponderado</span>
          </div>
          <table className="table-base">
            <thead>
              <tr>
                <th rowSpan={2}>Fecha</th>
                <th rowSpan={2}>Documento</th>
                <th rowSpan={2}>Movimiento</th>
                <th colSpan={3} className="!text-center">Entradas</th>
                <th colSpan={3} className="!text-center">Salidas</th>
                <th colSpan={3} className="!text-center">Saldo</th>
              </tr>
              <tr>
                <th className="num">Cant.</th>
                <th className="num">C. unit.</th>
                <th className="num">Total</th>
                <th className="num">Cant.</th>
                <th className="num">C. unit.</th>
                <th className="num">Total</th>
                <th className="num">Cant.</th>
                <th className="num">C. prom.</th>
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {current.rows.map((r) => (
                <tr key={r.mov.id}>
                  <td className="whitespace-nowrap">{fmtDate(r.mov.fecha)}</td>
                  <td className="whitespace-nowrap font-mono text-xs">{r.mov.documento}</td>
                  <td>
                    <Badge tone={r.mov.tipo === "Salida" ? "amber" : r.mov.tipo === "Inicial" ? "slate" : "green"}>
                      {r.mov.tipo}
                    </Badge>
                  </td>
                  <td className="num">{r.entradaCant ? qty.format(r.entradaCant) : ""}</td>
                  <td className="num">{r.entradaCant ? cu.format(r.entradaCU) : ""}</td>
                  <td className="num">{r.entradaCant ? money(r.entradaTotal) : ""}</td>
                  <td className="num">{r.salidaCant ? qty.format(r.salidaCant) : ""}</td>
                  <td className="num">{r.salidaCant ? cu.format(r.salidaCU) : ""}</td>
                  <td className="num">{r.salidaCant ? money(r.salidaTotal) : ""}</td>
                  <td className="num font-semibold">{qty.format(r.saldoCant)}</td>
                  <td className="num">{cu.format(r.saldoCU)}</td>
                  <td className="num font-semibold">{money(r.saldoTotal)}</td>
                </tr>
              ))}
              {current.rows.length === 0 && (
                <tr>
                  <td colSpan={12} className="py-8 text-center text-slate-400">
                    Este producto aún no tiene movimientos. Registre una compra para darle entrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Editar producto" : "Nuevo producto"}>
        <form onSubmit={submit} className="space-y-4">
          {error && <Alert tone="error">{error}</Alert>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Código</label>
              <input
                className="input font-mono"
                value={form.codigo}
                onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                placeholder="Ej. ARE-001"
                required
              />
            </div>
            <div>
              <label className="label">Unidad de medida</label>
              <input
                className="input"
                value={form.unidad}
                onChange={(e) => setForm({ ...form, unidad: e.target.value })}
                placeholder="Ej. Bolsa, Varilla, m³"
                required
              />
            </div>
          </div>
          <div>
            <label className="label">Nombre del producto</label>
            <input
              className="input"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              required
            />
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary">
              Guardar
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={!!toDelete} onClose={() => setToDelete(null)} title="Eliminar producto">
        {deleteError && (
          <div className="mb-3">
            <Alert tone="error">{deleteError}</Alert>
          </div>
        )}
        <p className="text-sm text-slate-700">
          ¿Eliminar el producto <strong>{toDelete?.codigo}</strong> — {toDelete?.nombre}?
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => setToDelete(null)}>
            Cancelar
          </button>
          <button
            className="btn-danger"
            onClick={() => {
              if (!toDelete) return;
              const err = deleteProduct(toDelete.id);
              if (err) return setDeleteError(err);
              setNotice("Producto eliminado.");
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
