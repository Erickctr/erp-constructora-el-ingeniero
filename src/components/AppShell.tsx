"use client";

import {
  BookMarked,
  BookOpen,
  Cloud,
  HardDrive,
  LayoutDashboard,
  ListTree,
  Menu,
  RotateCcw,
  ShoppingCart,
  TrendingUp,
  TriangleAlert,
  X,
  HardHat,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useStore, type SyncStatus } from "@/lib/store";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/catalogo", label: "1. Catálogo de Cuentas", icon: ListTree },
  { href: "/ventas", label: "2. Libro de Ventas", icon: TrendingUp },
  { href: "/compras", label: "3. Libro de Compras", icon: ShoppingCart },
  { href: "/diario", label: "4. Libro Diario", icon: BookOpen },
  { href: "/mayor", label: "5. Libro Diario Mayor", icon: BookMarked },
];

const SYNC_LABEL: Record<SyncStatus, { text: string; icon: typeof Cloud }> = {
  local: { text: "Modo local (localStorage)", icon: HardDrive },
  conectando: { text: "Conectando a Firestore…", icon: Cloud },
  firebase: { text: "Sincronizado con Firestore", icon: Cloud },
  error: { text: "Firestore no disponible · modo local", icon: TriangleAlert },
};

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { ready, sync, resetData } = useStore();
  const S = SYNC_LABEL[sync];

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="min-h-screen">
      {/* Barra superior móvil */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-navy px-4 py-3 text-white lg:hidden">
        <div className="flex items-center gap-2 font-bold">
          <HardHat className="h-5 w-5" />
          <span className="text-sm">ERP El Ingeniero</span>
        </div>
        <button onClick={() => setOpen(true)} aria-label="Abrir menú" className="rounded-md p-1.5 hover:bg-steel">
          <Menu className="h-6 w-6" />
        </button>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 bg-navy-900/60 lg:hidden" onClick={() => setOpen(false)} />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-navy text-white shadow-xl transition-transform lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-start justify-between gap-2 border-b border-white/10 px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-white/10">
              <HardHat className="h-6 w-6" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-bold">ERP Contable</p>
              <p className="text-xs text-blue-200">Constructora El Ingeniero</p>
            </div>
          </div>
          <button className="rounded-md p-1 hover:bg-steel lg:hidden" onClick={() => setOpen(false)} aria-label="Cerrar menú">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                isActive(href) ? "bg-steel text-white shadow-inner" : "text-blue-100 hover:bg-white/10"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="space-y-3 border-t border-white/10 px-4 py-4 text-xs text-blue-200">
          <div className="flex items-center gap-2">
            <S.icon className="h-4 w-4 shrink-0" />
            <span>{S.text}</span>
          </div>
          <button
            onClick={() => {
              if (confirm("¿Restablecer todos los datos a los datos de prueba? Se perderán los cambios actuales."))
                resetData();
            }}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/20 px-3 py-2 font-semibold text-white transition hover:bg-white/10"
          >
            <RotateCcw className="h-4 w-4" />
            Restablecer datos de prueba
          </button>
          <p className="leading-snug text-blue-300">
            SIC115 · Universidad de El Salvador
            <br />
            Grupo 04 · NIIF para las PYMES
          </p>
        </div>
      </aside>

      <main className="lg:pl-72">
        <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
          {ready ? (
            children
          ) : (
            <div className="flex h-64 items-center justify-center text-sm text-slate-500">
              Cargando datos contables…
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

