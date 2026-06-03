# Referencia EXPLAIN ANALYZE — Persona D

Guía de apoyo para interpretar los planes generados por Persona C (`01_baseline.sql` y `03_with_indexes.sql`). El informe formal del grupo está en `informe/seccion_D.md`.

---

## Nodos del plan — tabla de referencia

| Nodo | Cuándo aparece | Qué significa | Qué mirar |
|------|----------------|---------------|-----------|
| **Seq Scan** | El optimizador estima que leer la tabla entera es más barato que usar un índice: tabla pequeña, baja selectividad del filtro, estadísticas desactualizadas o ausencia de índice alineado con el predicado. | Escaneo secuencial del heap: PostgreSQL recorre todas las páginas de la relación y evalúa las condiciones `WHERE` fila a fila. No utiliza estructuras de acceso secundarias. | `rows` y `actual rows`; `Rows Removed by Filter` (cuántas filas se descartan); `actual time`; `Buffers: shared read` (lecturas desde disco) frente a `hit` (cache). En tablas de catálogo con miles de filas suele indicar plan subóptimo si el filtro es selectivo. |
| **Index Scan** | Existe un índice B-tree (u otro) cuya clave coincide con un predicado de igualdad o rango, o con el `ORDER BY`, y el coste estimado es menor que un seq scan. | Recorrido ordenado del índice; por cada entrada relevante puede acceder al heap para obtener columnas no incluidas en el índice (random I/O). | Nombre del índice (`Index Name`); coherencia entre `rows` estimadas y `actual rows`; tiempo del nodo; buffers. Verificar si el índice usado es el diseñado para la query (p. ej. `idx_productos_activos`). |
| **Index Only Scan** | Todas las columnas solicitadas están en el índice (índice covering) y el mapa de visibilidad (visibility map) permite evitar lecturas al heap en la mayoría de las páginas. | Lectura únicamente desde las páginas del índice, sin consultar el heap salvo excepciones. Es la forma más eficiente de acceso indexado cuando aplica. | Valor de `Heap Fetches`: si es alto, muchas filas requirieron ir al heap (VM desactualizado o índice no cubre del todo). Comparar `actual time` con Index Scan sobre la misma query. |
| **Bitmap Index Scan** | Selectividad intermedia: muchas filas cumplen el predicado pero no conviene un Index Scan fila a fila; también en combinación de varios índices (Bitmap AND/OR). | El motor recorre el índice y arma un bitmap de páginas del heap que potencialmente contienen filas candidatas. Es un paso previo al acceso al heap. | Cantidad de páginas en el bitmap; índice utilizado; discrepancia entre filas estimadas y reales. Aparece a menudo con `IN (...)` o rangos amplios sobre columnas indexadas. |
| **Bitmap Heap Scan** | Siempre como hijo de uno o más Bitmap Index Scan: se leen del heap solo las páginas marcadas en el bitmap. | Acceso al heap por páginas, no secuencial completo. Puede aplicar `Recheck Cond` si el índice no es lossless (p. ej. GIN/GiST o condiciones no exactas). | `Recheck Cond` y filas recheckadas; `Buffers: shared read`; relación costo/beneficio frente a Seq Scan (menos páginas leídas). |
| **Nested Loop** | Un lado del join es pequeño (suele ser el exterior) y el interior tiene acceso barato por fila, típicamente Index Scan sobre FK. Muy habitual en joins con `categorias` / `subcategorias` pequeñas. | Por cada fila del plan externo se busca coincidencia en el interno. Complejidad aproximada O(n × m) en el peor caso si el interno es seq scan repetido. | Número de `loops`; tiempo por iteración en el nodo interno; tipo de acceso al hijo derecho (Index Scan vs Seq Scan). Un Nested Loop con Seq Scan interno sobre `productos` es señal de problema en joins grandes. |
| **Hash Join** | Un join donde no hay orden preexistente en ambas entradas, o el optimizador prefiere construir una tabla hash del lado más pequeño. Común cuando faltan índices en la clave de join o ambas tablas son grandes. | Se materializa una tabla hash de la relación interna (build) y se sondea (probe) con la externa. Puede usar memoria `work_mem` o volcar a disco si excede el presupuesto. | `Hash Buckets`, `Batches` (más de 1 implica spill a disco); memoria reportada; `actual rows` en build y probe. Spill o tiempos altos sugieren presión de memoria o cardinalidades mal estimadas. |

---

## Cómo leer el costo y el tiempo

### `cost=X..Y`

En cada nodo del plan, `cost` es una estimación **adimensional** del optimizador, no milisegundos. El primer valor (`X`, startup cost) es el coste de arrancar el nodo (por ejemplo, abrir el índice o crear la tabla hash). El segundo (`Y`, total cost) incluye el procesamiento de todas las filas que el planificador espera producir en ese nodo. Los costes se suman a lo largo del árbol según la jerarquía del plan. Sirven para **comparar planes alternativos** entre sí en la misma versión de PostgreSQL; no deben interpretarse como tiempo real de CPU ni de disco. Un plan con menor `cost` total en el nodo raíz es el que el optimizador eligió, pero puede no ser el más rápido en la práctica si las estadísticas fallan.

### `actual time=X..Y`

Aparece solo con `EXPLAIN ANALYZE`. Indica el tiempo **real** acumulado en milisegundos para ese nodo: `X` al empezar a producir la primera fila y `Y` al terminar. La diferencia aproxima el coste dominante del nodo. El `Execution Time` final del bloque es el tiempo total de la consulta (incluye planificación ya ejecutada y todos los nodos). Para detectar cuellos de botella, identificar el nodo con mayor incremento de `actual time` entre inicio y fin, especialmente en accesos a `productos`.

### `rows=N` frente a `actual rows=N`

`rows=N` es la cardinalidad **estimada** que el planificador infiere a partir de `pg_statistic` (histogramas, MCV, correlaciones). `actual rows=N` es la cantidad **real** de filas que ese nodo procesó o devolvió en la ejecución medida. Cuando `actual rows` difiere en uno o más órdenes de magnitud de `rows`, el plan elegido puede ser subóptimo: el optimizador preparó un camino para pocas filas y encontró muchas (o al revés). En tablas con carga masiva reciente conviene ejecutar `ANALYZE productos;` antes de repetir los experimentos. En el informe conviene anotar ambos valores en el nodo de acceso a `productos` y en cualquier `Sort` o `Join` crítico.

### `Buffers: shared hit=N read=N`

Requiere la opción `BUFFERS` en el `EXPLAIN`. Cuenta páginas de 8 KB del buffer pool compartido tocadas por el nodo. `shared hit` son lecturas satisfechas desde cache en RAM (baratas). `shared read` son lecturas que debieron traer la página desde disco (más costosas en latencia). Un plan eficiente en tablas grandes tiende a aumentar `hit` y minimizar `read` en el nodo que accede a `productos`. Comparar los totales del nodo raíz o del Seq Scan / Index Scan principal entre la corrida sin índice y con índice permite cuantificar la mejora de localidad de acceso.

### Señales de un plan deficiente

Un plan merece revisión cuando se observan varias de estas condiciones en conjunto. Primero, **desalineación estadística**: `actual rows` muy superior a `rows` en Seq Scan o en el join con `productos`, lo que suele preceder a elección de Nested Loop o Hash Join inadecuados. Segundo, **acceso masivo al heap**: Seq Scan sobre `productos` con alto `Rows Removed by Filter` cuando la query filtra por `activo` o por rango de fechas, indicando que se leyó casi toda la tabla para devolver pocas filas. Tercero, **ordenamiento redundante**: nodo `Sort` con muchas filas y tiempo alto cuando existe un índice que podría proveer el `ORDER BY` (`created_at DESC`). Cuarto, **presión de I/O**: `shared read` elevado en el nodo dominante, señal de cold cache o de plan que no aprovecha índices. Quinto, **tiempo real vs coste**: `Execution Time` alto pese a costes estimados bajos, lo que confirma que las estimaciones no reflejan la carga real. Estas señales deben contrastarse siempre con la segunda corrida (con índices) y con los tamaños reportados en `D_disk_sizing.sql`.
