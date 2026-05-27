# Analisis del Proyecto — Repositorio Grupo 2

**E-commerce frontend "AGUSTINA" · Proyecto Base de Datos Avanzada**

---

## Resumen general

Este repositorio es un **frontend estatico multi-pagina** para una tienda de moda/accesorios llamada "AGUSTINA". Se conecta a una API REST hosteada en Cloudflare Workers, usa Cloudinary para imagenes y Supabase como base de datos (el codigo del Worker y el schema de la DB no viven en este repo).

Demo en produccion: [https://web-agustina.vercel.app/](https://web-agustina.vercel.app/)

---

## Stack tecnologico


| Capa          | Tecnologia                                    |
| ------------- | --------------------------------------------- |
| Frontend      | HTML5, CSS3 vanilla, JavaScript (sin bundler) |
| Animaciones   | GSAP 3.12.5 + ScrollTrigger                   |
| API           | Cloudflare Workers (REST)                     |
| Imagenes      | Cloudinary                                    |
| Base de datos | Supabase (externo a este repo)                |
| Deploy        | Vercel                                        |
| Carrito       | localStorage                                  |


---

## Estructura del repositorio


| Archivo         | Rol                     | Notas                                           |
| --------------- | ----------------------- | ----------------------------------------------- |
| `index.html`    | Home + catalogo         | Hero animado, filtros, grilla de cards          |
| `producto.html` | Detalle de producto     | Galeria, gift cards, CTA WhatsApp               |
| `script.js`     | Logica del catalogo     | Fetch API, filtros, search, lazy load           |
| `producto.js`   | Logica de detalle       | Seleccion de talla/monto, carrito               |
| `cart.js`       | Carrito de compras      | localStorage, panel deslizante, mensaje WA      |
| `style.css`     | Estilos globales        | ~2600 lineas, design tokens en `:root`          |
| `admin.html`    | Panel de administracion | ⚠️ Login, CRUD, upload Cloudinary — todo inline |
| `README.md`     | Documentacion           | ⚠️ Parcial, falta guia de setup y API contract  |


---

## Modelo de datos inferido

No hay schema SQL en el repo. El modelo se infiere de las llamadas a la API:


| Campo             | Tipo            | Uso                                  |
| ----------------- | --------------- | ------------------------------------ |
| `id`              | string / number | Routing, PATCH, DELETE               |
| `name`            | string          | Display y busqueda                   |
| `price`           | number (ARS)    | Precio de lista                      |
| `precio_efectivo` | number | null   | Precio en efectivo (opcional)        |
| `cat`             | string slug     | Categoria (indumentaria, giftcards…) |
| `sub`             | string slug     | Subcategoria                         |
| `image_url`       | string URL      | Imagen principal (Cloudinary)        |
| `images`          | string[]        | Galeria adicional                    |
| `descripcion`     | string | null   | Descripcion del producto             |
| `activo`          | boolean         | Ocultar / mostrar en catalogo        |
| `created_at`      | timestamp       | Badge "NUEVO" (< 14 dias)            |


**Endpoints API utilizados:**

```
GET  /productos
GET  /producto?id=<id>
GET  /admin/productos
POST /guardar-producto
PATCH /producto        (body JSON con id + campos)
DELETE /producto       (body JSON con id)
```

---

## Problemas encontrados — por prioridad

### CRITICO


| #   | Area      | Problema                                                                                                                     |
| --- | --------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 1   | Seguridad | Password admin hardcodeada en el cliente: `ADMIN_PWD = "1234"` en `admin.html`. Cualquiera puede leerla en el codigo fuente. |
| 2   | Seguridad | Cloud name y upload preset de Cloudinary expuestos en el frontend.                                                           |


### ALTO


| #   | Area              | Problema                                                                   |
| --- | ----------------- | -------------------------------------------------------------------------- |
| 3   | Entrega academica | Sin schema SQL, diagrama ER ni migraciones en el repo (materia de DB).     |
| 4   | Documentacion     | README no explica setup local, variables de entorno ni contrato de la API. |


### MEDIO


| #   | Area           | Problema                                                           |
| --- | -------------- | ------------------------------------------------------------------ |
| 5   | Arquitectura   | `API_URL` y `cloudinaryUrl` duplicadas en 3 archivos distintos.    |
| 6   | Arquitectura   | `admin.html` tiene CSS y JS inline (~700 lineas mezcladas).        |
| 7   | Mantenibilidad | Funciones globales: `cartAdd`, `cartRemove`, `window._cartOpen`.   |
| 8   | Mantenibilidad | `onclick="..."` inline en HTML generado dinamicamente en el admin. |


### BAJO


| #   | Area    | Problema                                                 |
| --- | ------- | -------------------------------------------------------- |
| 9   | Assets  | Imagenes hero (`assets/hero*.jpeg`) no estan en el repo. |
| 10  | Calidad | Sin tests, sin linter, sin CI.                           |


---

## Plan de mejoras

### Corto plazo — antes de entregar

1. **Seguridad admin**: Mover la autenticacion al Worker (JWT o session). Eliminar la password del HTML y restringir `/admin/productos` con un header `Authorization`.
2. **Schema en el repo**: Agregar `schema.sql` con el DDL de la tabla `productos` en Supabase. Incluir diagrama ER en el README.
3. **README completo**: Agregar variables de entorno necesarias, instrucciones para correr localmente (server estatico), y contrato de la API.
4. **Assets**: Agregar las imagenes hero a `/assets/` o documentar que vienen de CDN externo.

### Mediano plazo — calidad de codigo

1. **Extraer config compartida**: Crear `config.js` con `API_URL` y `cloudinaryUrl`. Importarlo en `script.js`, `producto.js` y `admin.html`.
2. **Separar admin**: Mover CSS y JS de `admin.html` a `admin.css` y `admin.js`. Reemplazar `onclick` inline por `addEventListener`.
3. **Linter basico**: Agregar ESLint con `eslint:recommended` y correrlo antes de cada commit.
4. **CI en GitHub**: Workflow de GitHub Actions que valide HTML y JS en cada push o PR.

---

## Lo que ya esta bien


| Aspecto            | Detalle                                                           |
| ------------------ | ----------------------------------------------------------------- |
| Design tokens      | `:root` con colores, tipografia y spacing — facil de personalizar |
| Skeleton loaders   | Buena UX mientras carga el catalogo                               |
| Lazy loading       | `IntersectionObserver` para animar cards al hacer scroll          |
| Reduced motion     | Se detecta `prefers-reduced-motion` y se desactiva GSAP           |
| Carrito            | Persiste con `localStorage`; mensaje WhatsApp bien formateado     |
| Multi-imagen hover | Cicla imagenes en la card al hacer hover                          |
| Admin funcional    | CRUD completo con compresion a WebP antes de subir a Cloudinary   |
| Responsive         | Bottom sheet para filtros en mobile, drawer menu, media queries   |


---

