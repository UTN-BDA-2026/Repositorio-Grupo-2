# Análisis del Proyecto — Repositorio Grupo 2

**AGUSTINA · Trabajo Final — Base de Datos Avanzada**

Integrantes: Conforti Angelo · Contreras Facundo · Perez Juan Ignacio · Romero Tomas · Vergara Juan Ignacio

Referencia operativa: `npm run dev` → http://127.0.0.1:5173/

---

## Resumen ejecutivo

Aplicación **full-stack** de catálogo e-commerce: **PostgreSQL** + **API Node local** + frontend vanilla. Cubre **6 temas** de la cursada (mínimo requerido: 4): índices, backup/restore, transacciones, ORM/SQL, seguridad y decisión NoSQL documentada.

**Estado de entrega:** listo para demo académica local. Pendiente menor: consolidar informes C–E en PDF final del grupo.

---

## Cumplimiento de temas — Trabajo Final


| Tema | Estado | Evidencia |
|------|--------|-----------|
| **Índices** | ✅ | Migración, `db/experiments/`, `informe/seccion_C.md`, `seccion_D.md`, `seccion_E.md` |
| **Backup & Restore** | ✅ | `lib/backup/`, `docs/BACKUP_RESTORE.md`, `npm run db:backup*` |
| **Transacciones** | ✅ | `lib/catalog/product-service.js`, seeders, `tests/transactions.test.js` |
| **ORM / Sin ORM** | ✅ | Modelos Sequelize + SQL parametrizado en servicio |
| **Seguridad** | ✅ | `.env`, SSL, `bind`/`$1`, auth admin server-side (`lib/auth/admin-auth.js`) |
| **NoSQL (decisión)** | ✅ | [`docs/DECISION_NOSQL.md`](docs/DECISION_NOSQL.md) |
| **Particionado** | ❌ Opcional | No implementado; volumen actual no lo exige |


---

## Stack tecnológico


| Capa | Tecnología |
|------|------------|
| Base de datos | PostgreSQL (Railway) |
| Backend | Node.js 18+ (`server.js`) |
| ORM | Sequelize 6 + SQL crudo |
| Frontend | HTML/CSS/JS vanilla + GSAP |
| Imágenes | Cloudinary |
| Backup | `pg_dump` / `pg_restore` |
| Tests | `node --test` |


---

## Estructura clave


| Ruta | Rol |
|------|-----|
| `server.js` | API `/api/*` + estáticos |
| `lib/catalog/` | CRUD transaccional |
| `lib/backup/` | Backup/restore |
| `lib/auth/admin-auth.js` | Login admin + tokens |
| `db/` | Schema, migraciones, seeds, experimentos |
| `informe/` | Secciones C, D, E completas |
| `docs/` | BACKUP_RESTORE, DECISION_NOSQL |
| `tests/` | Backup + transacciones |


---

## Informe académico


| Sección | Estado |
|---------|--------|
| C — EXPLAIN ANALYZE | ✅ 15k filas, salidas literales |
| D — Planes y disco | ✅ Completada con análisis nodo a nodo |
| E — Optimización | ✅ Tabla `idx_scan` + checklist parcial (falta PDF/PR) |


---

## Seguridad admin (implementada)

- `ADMIN_PASSWORD` en `.env` (ver `.env.example`).
- `POST /api/admin/login` → token Bearer (sesión en memoria, 8 h).
- Rutas protegidas: `/api/admin/productos`, POST/PATCH/DELETE producto.
- Frontend: `js/admin.js` usa `adminFetch` con token en `sessionStorage`.
- **Acción del grupo:** agregar `ADMIN_PASSWORD=1234` (o la que acuerden) al `.env` local si aún no está.

---

## Pendientes menores (no bloquean entrega)


| # | Item | Responsable |
|---|------|-------------|
| 1 | Exportar informes C–E al PDF/PPT final | Grupo |
| 2 | PR de cierre del informe | Grupo |
| 3 | Cloudinary upload preset sigue en cliente (aceptable para demo) | Opcional |
| 4 | CI GitHub Actions | Opcional |
| 5 | Particionado como 7.º tema | Opcional |


---

## Lo que está bien


| Aspecto | Detalle |
|---------|---------|
| Arquitectura | Monorepo coherente: DB + API + frontend |
| README | Setup, temas cursada, scripts npm |
| Reproducibilidad | `db:setup`, experimentos 00–05, `npm run informe:c` |
| Q2 índices | Mejora ~100× con `idx_productos_created_at_desc` |
| Backup | Checksum SHA-256, retención, tests |
| Transacciones | CRUD + tests de rollback |
| Limpieza | Referencias Supabase eliminadas del frontend |


---

*Última actualización: junio 2026 — post-cierre de pendientes del análisis.*
