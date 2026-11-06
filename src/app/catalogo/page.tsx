"use client";

import { ListTree, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Alert, Badge, Modal, PageHeader } from "@/components/ui";
import { useStore } from "@/lib/store";
import { RUBROS, type Account, type Naturaleza, type Rubro, type TipoCuenta } from "@/lib/types";

type Form = Omit<Account, "id">;

const EMPTY: Form = {
  codigo: "",
  nombre: "",
  rubro: "Activo",
  naturaleza: "Deudora",
  tipo: "Detalle",
};

const defaultNature = (r: Rubro): Naturaleza =>
  r === "Activo" || r === "Costos y Gastos" ? "Deudora" : "Acreedora";

export default function CatalogoPage() {
  const { data, addAccount, updateAccount, deleteAccount } = useStore();
  const [q, setQ] = useState("");
  const [rubro, setRubro] = useState<"" | Rubro>("");
  const [tipo, setTipo] = useState<"" | TipoCuenta>("");
  const [editing, setEditing] = useState<Account | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Account | null>(null);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return [...data.accounts]
      .filter((a) => (!rubro || a.rubro === rubro) && (!tipo || a.tipo === tipo))
      .filter((a) => !s || a.codigo.toLowerCase().includes(s) || a.nombre.toLowerCase().includes(s))
      .sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }));
  }, [data.accounts, q, rubro, tipo]);

  const usedCodes = useMemo(() => {
    const set = new Set<string>();
    data.entries.forEach((e) => e.lineas.forEach((l) => set.add(l.cuenta)));
    return set;
  }, [data.entries]);

  function openNew() {
    setEditing(null);
    setForm(EMPTY);
    setError(null);
    setOpen(true);
  }

  function openEdit(a: Account) {
    setEditing(a);
    setForm({ codigo: a.codigo, nombre: a.nombre, rubro: a.rubro, naturaleza: a.naturaleza, tipo: a.tipo });
    setError(null);
    setOpen(true);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const err = editing ? updateAccount(editing.id, form) : addAccount(form);
    if (err) return setError(err);
    setNotice(editing ? "Cuenta actualizada correctamente." : "Cuenta creada correctamente.");
    setOpen(false);
  }

  function confirmDelete() {
    if (!toDelete) return;
    const err = deleteAccount(toDelete.id);
    setNotice(null);
    if (err) setError(err);
    else setNotice(`Cuenta ${toDelete.codigo} eliminada.`);
    setToDelete(null);
  }

  return (
    <>
      <PageHeader
        icon={ListTree}
        title="Catálogo de Cuentas"
        subtitle={`${data.accounts.length} cuentas · Constructora El Ingeniero`}
        actions={
          <button className="btn-primary" onClick={openNew}>
            <Plus className="h-4 w-4" /> Nueva cuenta
          </button>
        }
      />

      {notice && (
        <div className="mb-4">
          <Alert tone="success">{notice}</Alert>
        </div>
      )}
      {error && !open && (
        <div className="mb-4">
          <Alert tone="error">{error}</Alert>
        </div>
      )}

      <div className="card mb-4 grid gap-3 p-4 sm:grid-cols-3">
        <div className="relative sm:col-span-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Buscar por código o nombre…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select className="input" value={rubro} onChange={(e) => setRubro(e.target.value as "" | Rubro)}>
          <option value="">Todos los rubros</option>
          {RUBROS.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
        <select className="input" value={tipo} onChange={(e) => setTipo(e.target.value as "" | TipoCuenta)}>
          <option value="">Todos los tipos</option>
          <option>Título</option>
          <option>Detalle</option>
        </select>
      </div>

      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>Código</th>
              <th>Nombre de la cuenta</th>
              <th>Rubro</th>
              <th>Naturaleza</th>
              <th>Tipo</th>
              <th className="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id} className={a.tipo === "Título" ? "bg-navy-50/60 font-bold text-navy" : ""}>
                <td className="whitespace-nowrap font-mono">{a.codigo}</td>
                <td>{a.nombre}</td>
                <td>{a.rubro}</td>
                <td>
                  <Badge tone={a.naturaleza === "Deudora" ? "blue" : "amber"}>{a.naturaleza}</Badge>
                </td>
                <td>
                  <Badge tone={a.tipo === "Título" ? "navy" : "slate"}>{a.tipo}</Badge>
                </td>
                <td>
                  <div className="flex justify-end gap-1">
                    <button className="btn-icon" title="Editar" onClick={() => openEdit(a)}>
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      className="btn-icon hover:!text-red-600"
                      title={usedCodes.has(a.codigo) ? "Con movimientos: no se puede eliminar" : "Eliminar"}
                      onClick={() => {
                        setError(null);
                        setNotice(null);
                        setToDelete(a);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400">
                  No hay cuentas que coincidan con el filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={open} onClose={() => { setOpen(false); setError(null); }} title={editing ? "Editar cuenta" : "Nueva cuenta contable"}>
        <form onSubmit={submit} className="space-y-4">
          {error && <Alert tone="error">{error}</Alert>}
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label">Código</label>
              <input
                className="input font-mono"
                value={form.codigo}
                onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                placeholder="Ej. 1105"
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Nombre</label>
              <input
                className="input"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Nombre de la cuenta"
                required
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label">Rubro</label>
              <select
                className="input"
                value={form.rubro}
                onChange={(e) => {
                  const r = e.target.value as Rubro;
                  setForm({ ...form, rubro: r, naturaleza: defaultNature(r) });
                }}
              >
                {RUBROS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Naturaleza</label>
              <select
                className="input"
                value={form.naturaleza}
                onChange={(e) => setForm({ ...form, naturaleza: e.target.value as Naturaleza })}
              >
                <option>Deudora</option>
                <option>Acreedora</option>
              </select>
            </div>
            <div>
              <label className="label">Tipo de cuenta</label>
              <select
                className="input"
                value={form.tipo}
                onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoCuenta })}
              >
                <option>Detalle</option>
                <option>Título</option>
              </select>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Las cuentas de <strong>Título</strong> agrupan saldos; solo las de <strong>Detalle</strong> reciben
            movimientos en el Libro Diario.
          </p>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" className="btn-secondary" onClick={() => { setOpen(false); setError(null); }}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary">
              {editing ? "Guardar cambios" : "Crear cuenta"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={!!toDelete} onClose={() => setToDelete(null)} title="Eliminar cuenta">
        <p className="text-sm text-slate-700">
          ¿Eliminar la cuenta{" "}
          <strong>
            {toDelete?.codigo} · {toDelete?.nombre}
          </strong>
          ? Esta acción no se puede deshacer.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => setToDelete(null)}>
            Cancelar
          </button>
          <button className="btn-danger" onClick={confirmDelete}>
            Eliminar
          </button>
        </div>
      </Modal>
    </>
  );
}
