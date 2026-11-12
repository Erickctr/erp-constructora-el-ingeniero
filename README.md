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
| `/catalogo` | Catálogo de Cuentas jerárquico (1 / 11 / 1101 / 110101), CRUD, búsqueda y filtros |
| `/ventas` | Libro de Ventas (Art. 141 CT): CCF (IVA 13% sobre neto) y FAC (IVA ÷ 1.13), detalle por producto y costo de venta |
| `/compras` | Libro de Compras con CCF (IVA Crédito 13%); las compras a Inventario se detallan por producto |
| `/diario` | Libro Diario con partidas manuales y validación de partida doble |
| `/mayor` | Libro Mayor (Cuentas T) y Balance de Comprobación de Sumas y Saldos |
| `/inventario` | Productos y Kardex (inventario perpetuo, Costo Promedio Ponderado móvil) con conciliación contra la cuenta 1104 |

Ventas y compras generan automáticamente su partida en el Libro Diario; el Mayor se calcula en vivo desde el Diario.

## Inventario perpetuo (Kardex)

* Método de valuación: **Costo Promedio Ponderado móvil** (NIIF para las PYMES, Sección 13; Art. 142 CT).
* Cada compra a la cuenta 1104 registra entradas por producto (cantidad × costo unitario) y recalcula el promedio.
* Cada venta valida existencias, valúa la salida al promedio vigente y agrega a su partida: **Costo de Ventas (4101) a Inventario (1104)**.
* No se permiten registros retroactivos en el Kardex, ni eliminar documentos con movimientos posteriores del mismo producto.
* La cuenta 1104 no admite partidas manuales: solo se mueve por compras y ventas, de modo que siempre concilia con el Kardex.

## Datos de prueba

Cinco transacciones precargadas (fechadas en el mes en curso), cuadradas en **\$62,753.66**:

1. Apertura \$40,000 (Bancos \$25,000 + inventario inicial \$15,000 detallado en 4 productos).
2. Compra de cemento, CCF contado: 600 bolsas × \$5.00 = \$3,000 + IVA = \$3,390.
3. Compra de hierro, CCF crédito: 500 varillas 3/8" × \$4.40 + 250 varillas 1/2" × \$7.20 = \$4,000 + IVA = \$4,520.
4. Venta CCF crédito: \$5,000 + IVA = \$5,650; costo de venta \$3,603.33.
5. Venta FAC contado: \$3,277 (IVA incluido); costo de venta \$2,313.33.

Inventario final \$16,083.34 · Utilidad bruta \$1,983.34. Use «Restablecer datos de prueba» en la barra lateral para volver a ellos.

> Desde esta versión los datos se guardan con la clave `erp-el-ingeniero:v2`; los datos guardados con la versión anterior se reemplazan por los datos de prueba.

## Persistencia híbrida

* Por defecto todo se guarda en `localStorage` (no requiere conexión).
* Para sincronizar con Firebase Firestore, copie `.env.example` a `.env.local` y complete las variables `NEXT_PUBLIC_FIREBASE_*`. El estado se guarda en el documento `erp_el_ingeniero/estado`. Si Firestore falla, la app sigue en modo local.

## Despliegue en Vercel

Importe el repositorio en Vercel (preset Next.js, sin configuración adicional). Agregue las variables `NEXT_PUBLIC_FIREBASE_*` en *Project Settings → Environment Variables* si desea usar Firestore.

