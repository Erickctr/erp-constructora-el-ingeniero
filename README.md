# ERP Contable – Constructora El Ingeniero

Proyecto de Cátedra **SIC115** · Universidad de El Salvador · Grupo 04.
Next.js (App Router) + Tailwind CSS + Lucide React. NIIF para las PYMES, Código de Comercio y Código Tributario de El Salvador.

## Ejecutar

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # compilación de producción
```

## Módulos

| Ruta | Módulo |
|------|--------|
| `/` | Dashboard: Ventas del mes, Compras del mes, Saldo de IVA, Cuadre del Diario |
| `/catalogo` | Catálogo de Cuentas (CRUD, búsqueda y filtros) |
| `/ventas` | Libro de Ventas (Art. 141 CT): CCF (IVA 13% sobre neto) y FAC (IVA ÷ 1.13) |
| `/compras` | Libro de Compras con CCF (IVA Crédito 13%) |
| `/diario` | Libro Diario con partidas manuales y validación de partida doble |
| `/mayor` | Libro Mayor (Cuentas T) y Balance de Comprobación de Sumas y Saldos |

Ventas y compras generan automáticamente su partida en el Libro Diario; el Mayor se calcula en vivo desde el Diario.

## Datos de prueba

Cinco transacciones precargadas, cuadradas en **\$56,837.00**: apertura \$40,000, compra de cemento \$3,390 (contado), compra de hierro \$4,520 (crédito), venta CCF \$5,650 (crédito) y factura \$3,277 (contado). Use «Restablecer datos de prueba» en la barra lateral para volver a ellos.

## Persistencia híbrida

* Por defecto todo se guarda en `localStorage` (no requiere conexión).
* Para sincronizar con Firebase Firestore, copie `.env.example` a `.env.local` y complete las variables `NEXT_PUBLIC_FIREBASE_*`. El estado se guarda en el documento `erp_el_ingeniero/estado`. Si Firestore falla, la app sigue en modo local.

## Despliegue en Vercel

Importe el repositorio en Vercel (preset Next.js, sin configuración adicional). Agregue las variables `NEXT_PUBLIC_FIREBASE_*` en *Project Settings → Environment Variables* si desea usar Firestore.

