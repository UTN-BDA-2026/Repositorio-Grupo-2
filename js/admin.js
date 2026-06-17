const ADMIN_TOKEN_KEY = "agustina_admin_token";

function authHeaders(extra = {}) {
  const token = sessionStorage.getItem(ADMIN_TOKEN_KEY);
  const headers = { ...extra };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function adminFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: authHeaders(options.headers || {}),
  });
  if (res.status === 401) {
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    document.getElementById("login-screen").style.display = "block";
    document.getElementById("admin-panel").style.display = "none";
    throw new Error("Sesión expirada. Volvé a iniciar sesión.");
  }
  return res;
}

// ---- LOGIN ----
document.getElementById("pwd-input").addEventListener("keydown", e => {
  if (e.key === "Enter") doLogin();
});

async function restoreSession() {
  const token = sessionStorage.getItem(ADMIN_TOKEN_KEY);
  if (!token) return;
  try {
    const res = await fetch(`${API_URL}/admin/session`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("invalid");
    document.getElementById("login-screen").style.display = "none";
    document.getElementById("admin-panel").style.display = "block";
  } catch {
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  }
}

document.addEventListener("DOMContentLoaded", restoreSession);

async function doLogin() {
  const val = document.getElementById("pwd-input").value;
  const errEl = document.getElementById("login-err");
  try {
    const res = await fetch(`${API_URL}/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: val }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Contraseña incorrecta");
    sessionStorage.setItem(ADMIN_TOKEN_KEY, data.token);
    document.getElementById("login-screen").style.display = "none";
    document.getElementById("admin-panel").style.display = "block";
    errEl.style.display = "none";
  } catch (e) {
    errEl.textContent = e.message;
    errEl.style.display = "block";
  }
}

// ---- INPUT IMÁGENES (múltiples) ----
let selectedFiles = [];

document.getElementById("f-img-file").addEventListener("change", function() {
  selectedFiles = Array.from(this.files);
  const previews = document.getElementById("img-previews");
  previews.innerHTML = "";
  selectedFiles.forEach((file, i) => {
    const wrap = document.createElement("div");
    wrap.style.cssText = "position:relative;display:inline-block";
    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    img.style.cssText = "width:70px;height:70px;object-fit:cover;border-radius:8px;border:1px solid #f0d6e0";
    if (i === 0) {
      const badge = document.createElement("span");
      badge.textContent = "Principal";
      badge.style.cssText = "position:absolute;bottom:2px;left:2px;background:#c06080;color:#fff;font-size:9px;padding:1px 4px;border-radius:4px";
      wrap.appendChild(badge);
    }
    wrap.appendChild(img);
    previews.appendChild(wrap);
  });
  document.getElementById("upload-zone").textContent = `✓ ${selectedFiles.length} foto${selectedFiles.length > 1 ? "s" : ""} seleccionada${selectedFiles.length > 1 ? "s" : ""}`;
});
// ---- TABS ----
function switchTab(name) {
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
  document.getElementById("tab-" + name).classList.add("active");
  event.target.classList.add("active");
  if (name === "lista") loadProducts();
}

// ---- IMAGEN PREVIEW ----
function previewImg(input) {
  const file = input.files[0];
  if (!file) return;
  const preview = document.getElementById("img-preview");
  preview.src = URL.createObjectURL(file);
  preview.style.display = "block";
  document.getElementById("upload-zone").textContent = "✓ " + file.name;
}

// ---- COMPRIMIR ANTES DE SUBIR (reduce storage y ancho de banda) ----
function compressImage(file, maxWidth = 1200, quality = 0.82) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let w = img.naturalWidth, h = img.naturalHeight;
      if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      canvas.toBlob(blob => resolve(blob || file), "image/webp", quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

// ---- SUBIR IMAGEN A CLOUDINARY ----
const CLOUDINARY_CLOUD  = "dk7nxmdcg";
const CLOUDINARY_PRESET = "productos";

async function uploadImage(file) {
  const blob = await compressImage(file);
  const form = new FormData();
  form.append("file", blob, `${Date.now()}.webp`);
  form.append("upload_preset", CLOUDINARY_PRESET);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`,
    { method: "POST", body: form }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || "Error subiendo imagen a Cloudinary");
  }

  const data = await res.json();
  return data.secure_url;
}

// ---- GUARDAR PRODUCTO ----
async function saveProduct() {
  const name = document.getElementById("f-name").value.trim();
  const price = parseInt(document.getElementById("f-price").value);
  const cat = document.getElementById("f-cat").value;
  const sub = document.getElementById("f-sub").value;
  const precioEfectivoRaw = document.getElementById("f-price-efectivo").value;
  const precio_efectivo = precioEfectivoRaw ? parseInt(precioEfectivoRaw) : null;
  const descripcion = document.getElementById("f-descripcion").value.trim() || null;
  if (!name || !price || !cat || !selectedFiles.length) {
    showMsg("err", "Completá nombre, precio, categoría e imagen");
    return;
  }

  const btn = document.getElementById("btn-save");
  btn.disabled = true;
  btn.textContent = "Guardando...";

  try {
    const imageUrls = await Promise.all(selectedFiles.map(f => uploadImage(f)));
    const imageUrl = imageUrls[0];
    const images = imageUrls;

    const res = await adminFetch(`${API_URL}/guardar-producto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, price, image_url: imageUrl, images, cat, sub, precio_efectivo, descripcion })
    });

    if (!res.ok) throw new Error((await res.json()).error || "Error al guardar");

    showMsg("ok", "✓ Producto guardado correctamente");
    clearForm();

  } catch (e) {
    showMsg("err", e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Guardar producto";
  }
}

// ---- CARGAR LISTA ----
let allProducts = []; // cache en memoria

async function loadProducts() {
  const list = document.getElementById("product-list");
  list.innerHTML = `<div class="loading">Cargando...</div>`;

  const res = await adminFetch(`${API_URL}/admin/productos`);
  allProducts = await res.json();

  // Resetear filtros
  const si = document.getElementById("search-input");
  const fc = document.getElementById("filter-cat");
  const fe = document.getElementById("filter-estado");
  if (si) si.value = "";
  if (fc) fc.value = "";
  if (fe) fe.value = "";

  filterList();
}

function filterList() {
  const query  = document.getElementById("search-input")?.value.toLowerCase().trim() || "";
  const cat    = document.getElementById("filter-cat")?.value || "";
  const estado = document.getElementById("filter-estado")?.value || "";

  const filtered = allProducts.filter(p => {
    const matchName   = !query  || p.name.toLowerCase().includes(query);
    const matchCat    = !cat    || p.cat === cat;
    const matchEstado = !estado || (estado === "activo" ? p.activo : !p.activo);
    return matchName && matchCat && matchEstado;
  });

  const countEl = document.getElementById("list-count");
  if (countEl) countEl.textContent = `${filtered.length} producto${filtered.length !== 1 ? "s" : ""}`;

  renderList(filtered);
}

function renderList(products) {
  const list = document.getElementById("product-list");
  if (!products.length) {
    list.innerHTML = `<div class="loading">Sin resultados.</div>`;
    return;
  }
  list.innerHTML = products.map(p => {
    const imgs = p.images && p.images.length ? p.images : (p.image_url ? [p.image_url] : []);
    const safeName = p.name.replace(/'/g, "\\'").replace(/"/g, "&quot;");

    return `
    <div class="product-item-wrap" id="wrap-${p.id}">
      <div class="product-item">
        <img src="${p.image_url}" alt="${p.name}" onerror="this.src=''" />
        <div class="product-item__info">
          <div class="product-item__name">
            ${p.name}
            ${!p.activo ? '<span class="badge-inactivo">Inactivo</span>' : ''}
          </div>
          <div class="product-item__meta" id="meta-${p.id}">${p.cat}${p.sub ? ' · ' + p.sub : ''} · ${imgs.length} foto${imgs.length !== 1 ? 's' : ''}</div>
        </div>
        <div class="product-item__price" id="price-display-${p.id}">$${p.price.toLocaleString("es-AR")}</div>
        <div class="product-item__actions">
          <button class="btn btn--ghost btn--sm" onclick="toggleEditPanel(${p.id})">✏️ Editar</button>
          <button class="btn btn--ghost btn--sm" onclick="toggleImgPanel(${p.id})">📸 Fotos</button>
          <button class="btn btn--ghost btn--sm" onclick="toggleActivo(${p.id}, ${p.activo})">${p.activo ? '🙈 Ocultar' : '👁 Mostrar'}</button>
          <button class="btn btn--danger btn--sm" onclick="deleteProduct(${p.id}, '${safeName}')">🗑</button>
        </div>
      </div>

      <!-- Panel inline de EDICIÓN -->
      <div id="edit-panel-${p.id}" class="edit-panel" style="display:none">
        <div class="edit-panel__grid">
          <div class="form-group full">
            <label>Nombre</label>
            <input type="text" id="edit-name-${p.id}" value="${p.name.replace(/"/g, '&quot;')}" />
          </div>
          <div class="form-group">
            <label>Precio (ARS)</label>
            <input type="number" id="edit-price-${p.id}" value="${p.price}" min="0" />
          </div>
          <div class="form-group">
            <label>Categoría</label>
            <select id="edit-cat-${p.id}">
              <option value="">— Elegir —</option>
              <option value="indumentaria" ${p.cat==='indumentaria'?'selected':''}>Indumentaria</option>
              <option value="maquillaje" ${p.cat==='maquillaje'?'selected':''}>Maquillaje</option>
              <option value="skincare" ${p.cat==='skincare'?'selected':''}>Skincare</option>
              <option value="tazas" ${p.cat==='tazas'?'selected':''}>Tazas</option>
              <option value="botellas-y-vasos" ${p.cat==='botellas-y-vasos'?'selected':''}>Botellas y vasos</option>
              <option value="regaleria" ${p.cat==='regaleria'?'selected':''}>Regalería</option>
              <option value="necesers" ${p.cat==='necesers'||p.cat==='portacosmeticos'?'selected':''}>Necesers</option>
              <option value="marroquineria" ${p.cat==='marroquineria'?'selected':''}>Marroquinería</option>
              <option value="accesorios" ${p.cat==='accesorios'?'selected':''}>Accesorios</option>
              <option value="giftcards" ${p.cat==='giftcards'?'selected':''}>🎁 Gift Cards</option>
            </select>
          </div>
          <div class="form-group">
            <label>Subcategoría</label>
            <select id="edit-sub-${p.id}">
              <option value="">— Ninguna —</option>
              <option value="tazas" ${p.sub==='tazas'?'selected':''}>Tazas</option>
              <option value="botellas-y-vasos" ${p.sub==='botellas-y-vasos'?'selected':''}>Botellas y vasos</option>
              <option value="libreria" ${p.sub==='libreria'?'selected':''}>Librería</option>
              <option value="para-el-cabello" ${p.sub==='para-el-cabello'?'selected':''}>Para el cabello</option>
              <option value="bijou" ${p.sub==='bijou'?'selected':''}>Bijou</option>
              <option value="llaveros" ${p.sub==='llaveros'?'selected':''}>Llaveros</option>
              <option value="acero-quirurgico" ${p.sub==='acero-quirurgico'?'selected':''}>Acero quirúrgico</option>
            </select>
          </div>
          <div class="form-group">
            <label>Precio en efectivo (ARS) <span style="color:#aaa;font-weight:400">— opcional</span></label>
            <input type="number" id="edit-precio-efectivo-${p.id}" value="${p.precio_efectivo || ''}" placeholder="Ej: 8500" min="0" />
          </div>
          <div class="form-group full">
            <label>Descripción <span style="color:#aaa;font-weight:400">— opcional</span></label>
            <textarea id="edit-descripcion-${p.id}" rows="3" placeholder="Descripción del producto..." style="resize:vertical;min-height:70px">${p.descripcion ? p.descripcion.replace(/</g,'&lt;') : ''}</textarea>
          </div>
        </div>
        <div class="edit-panel__actions">
          <button class="btn btn--primary btn--sm" id="btn-save-edit-${p.id}" onclick="saveEdit(${p.id})">Guardar cambios</button>
          <button class="btn btn--ghost btn--sm" onclick="toggleEditPanel(${p.id})">Cancelar</button>
          <span class="img-panel__status" id="edit-status-${p.id}"></span>
        </div>
      </div>

      <!-- Panel inline de FOTOS -->
      <div id="img-panel-${p.id}" class="img-panel" style="display:none">
        <p class="img-panel__label">Fotos actuales (${imgs.length}) — tocá × para eliminar una:</p>
        <div class="img-panel__thumbs" id="thumbs-${p.id}">${renderThumbs(p.id, imgs)}</div>

        <p class="img-panel__label" style="margin-top:12px">Agregar más fotos:</p>
        <input type="file" id="img-input-${p.id}" accept="image/*" multiple style="display:none"
               onchange="previewNewImgs(${p.id}, this)" />
        <div class="upload-zone" style="padding:14px" onclick="document.getElementById('img-input-${p.id}').click()">
          📷 Hacé click para elegir fotos (podés seleccionar varias)
        </div>
        <div id="new-previews-${p.id}" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px"></div>

        <div class="img-panel__actions">
          <button class="btn btn--primary btn--sm" id="btn-save-imgs-${p.id}" onclick="saveNewImages(${p.id})">
            Guardar fotos nuevas
          </button>
          <button class="btn btn--ghost btn--sm" onclick="toggleImgPanel(${p.id})">Cerrar</button>
          <span class="img-panel__status" id="img-status-${p.id}"></span>
        </div>
      </div>
    </div>`;
  }).join("");
}

// ---- RENDER THUMBS CON BOTÓN × ----
function renderThumbs(id, imgs) {
  if (!imgs || !imgs.length) return '<span style="color:#aaa;font-size:13px">Sin imágenes</span>';
  return imgs.map((url, i) => `
    <div class="img-panel__thumb-wrap">
      <img src="${url}" class="img-panel__thumb" onerror="this.style.display='none'" />
      ${i === 0 ? '<span class="img-panel__badge">Principal</span>' : ''}
      <button class="img-panel__thumb-del" title="Eliminar esta foto" onclick="deleteImage(${id}, '${encodeURIComponent(url)}')">×</button>
    </div>`).join("");
}

// ---- ELIMINAR FOTO INDIVIDUAL ----
async function deleteImage(id, encodedUrl) {
  const url = decodeURIComponent(encodedUrl);
  if (!confirm("¿Eliminás esta foto del producto?")) return;

  const status = document.getElementById(`img-status-${id}`);
  if (status) status.textContent = "Eliminando...";

  try {
    const res = await adminFetch(`${API_URL}/producto?id=${id}`);
    const prod = await res.json();
    let imgs = (prod.images && prod.images.length) ? [...prod.images] : (prod.image_url ? [prod.image_url] : []);
    imgs = imgs.filter(u => u !== url);

    const patch = await adminFetch(`${API_URL}/producto`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, images: imgs, image_url: imgs[0] || "" })
    });

    if (!patch.ok) throw new Error("Error al guardar");

    // Actualizar thumbs en el panel sin recargar todo
    const thumbsEl = document.getElementById(`thumbs-${id}`);
    if (thumbsEl) thumbsEl.innerHTML = renderThumbs(id, imgs);
    if (status) status.textContent = `✓ Foto eliminada`;

    // Actualizar imagen del producto-item
    const itemImg = document.querySelector(`#wrap-${id} .product-item > img`);
    if (itemImg) itemImg.src = imgs[0] || "";

  } catch (e) {
    if (status) { status.textContent = "Error: " + e.message; status.style.color = "#c0392b"; }
  }
}

// ---- TOGGLE PANEL DE EDICIÓN ----
function toggleEditPanel(id) {
  const panel = document.getElementById(`edit-panel-${id}`);
  if (!panel) return;
  const isOpen = panel.style.display !== "none";
  // Cerrar el otro panel si está abierto
  const imgPanel = document.getElementById(`img-panel-${id}`);
  if (imgPanel) imgPanel.style.display = "none";
  panel.style.display = isOpen ? "none" : "block";
  // Limpiar status
  const st = document.getElementById(`edit-status-${id}`);
  if (st) { st.textContent = ""; st.style.color = "#065f46"; }
}

// ---- GUARDAR EDICIÓN ----
async function saveEdit(id) {
  const name  = document.getElementById(`edit-name-${id}`).value.trim();
  const price = parseInt(document.getElementById(`edit-price-${id}`).value);
  const cat   = document.getElementById(`edit-cat-${id}`).value;
  const sub   = document.getElementById(`edit-sub-${id}`).value;
  const peRaw = document.getElementById(`edit-precio-efectivo-${id}`).value;
  const precio_efectivo = peRaw ? parseInt(peRaw) : null;
  const descripcion = document.getElementById(`edit-descripcion-${id}`).value.trim() || null;
  const status = document.getElementById(`edit-status-${id}`);

  if (!name || isNaN(price) || price < 0 || !cat) {
    if (status) { status.textContent = "Completá nombre, precio y categoría"; status.style.color = "#c0392b"; }
    return;
  }

  const btn = document.getElementById(`btn-save-edit-${id}`);
  btn.disabled = true; btn.textContent = "Guardando...";
  if (status) status.textContent = "";

  try {
    const patch = await adminFetch(`${API_URL}/producto`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name, price, cat, sub, precio_efectivo, descripcion })
    });

    if (!patch.ok) throw new Error("Error al guardar");

    // Actualizar UI sin recargar todo
    const nameEl = document.querySelector(`#wrap-${id} .product-item__name`);
    if (nameEl) nameEl.childNodes[0].textContent = name + " ";
    const metaEl = document.getElementById(`meta-${id}`);
    if (metaEl) {
      const parts = metaEl.textContent.split("·");
      const fotos = parts[parts.length - 1].trim();
      metaEl.textContent = `${cat}${sub ? ' · ' + sub : ''} · ${fotos}`;
    }
    const priceEl = document.getElementById(`price-display-${id}`);
    if (priceEl) priceEl.textContent = "$" + price.toLocaleString("es-AR");

    if (status) { status.textContent = "✓ Guardado"; status.style.color = "#065f46"; }
    setTimeout(() => toggleEditPanel(id), 1200);

  } catch (e) {
    if (status) { status.textContent = "Error: " + e.message; status.style.color = "#c0392b"; }
  } finally {
    btn.disabled = false; btn.textContent = "Guardar cambios";
  }
}

// ---- TOGGLE ACTIVO ----
async function toggleActivo(id, currentActivo) {
  await adminFetch(`${API_URL}/producto`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, activo: !currentActivo })
  });
  // Actualizar cache y re-filtrar sin recargar todo
  const p = allProducts.find(x => x.id === id);
  if (p) p.activo = !currentActivo;
  filterList();
  // Refrescar solo el badge visual del item
  const nameEl = document.querySelector(`#wrap-${id} .product-item__name`);
  if (nameEl) {
    const badge = nameEl.querySelector(".badge-inactivo");
    if (!currentActivo && badge) badge.remove();
    else if (currentActivo && !badge) {
      const b = document.createElement("span");
      b.className = "badge-inactivo"; b.textContent = "Inactivo";
      nameEl.appendChild(b);
    }
  }
  // Cambiar texto del botón
  const btn = document.querySelector(`#wrap-${id} .product-item__actions .btn--ghost:nth-child(3)`);
  if (btn) btn.textContent = !currentActivo ? "🙈 Ocultar" : "👁 Mostrar";
  btn?.setAttribute("onclick", `toggleActivo(${id}, ${!currentActivo})`);
}

// ---- ELIMINAR ----
async function deleteProduct(id, name) {
  if (!confirm(`¿Segura que querés eliminar "${name}"?`)) return;

  await adminFetch(`${API_URL}/producto`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id })
  });
  // Quitar del cache y del DOM
  allProducts = allProducts.filter(x => x.id !== id);
  document.getElementById(`wrap-${id}`)?.remove();
  const countEl = document.getElementById("list-count");
  if (countEl) {
    const visible = document.querySelectorAll(".product-item-wrap").length;
    countEl.textContent = `${visible} producto${visible !== 1 ? "s" : ""}`;
  }
}

// ---- HELPERS ----
function clearForm() {
  document.getElementById("f-name").value = "";
  document.getElementById("f-price").value = "";
  document.getElementById("f-cat").value = "";
  document.getElementById("f-sub").value = "";
  document.getElementById("f-img-file").value = "";
  document.getElementById("img-previews").innerHTML = "";
  document.getElementById("upload-zone").textContent = "📷 Hacé click para subir fotos (podés elegir varias a la vez)";
  selectedFiles = [];
}

function showMsg(type, text) {
  const ok = document.getElementById("ok-msg");
  const err = document.getElementById("err-msg");
  ok.style.display = "none";
  err.style.display = "none";
  if (type === "ok") { ok.textContent = text; ok.style.display = "block"; }
  else { err.textContent = text; err.style.display = "block"; }
  setTimeout(() => { ok.style.display = "none"; err.style.display = "none"; }, 4000);
}

// ---- PANEL INLINE DE IMÁGENES ----
const pendingImgFiles = {};

function toggleImgPanel(id) {
  const panel = document.getElementById(`img-panel-${id}`);
  if (!panel) return;
  const isOpen = panel.style.display !== "none";
  panel.style.display = isOpen ? "none" : "block";
  // Limpiar estado si se cierra
  if (isOpen) {
    pendingImgFiles[id] = [];
    const prev = document.getElementById(`new-previews-${id}`);
    if (prev) prev.innerHTML = "";
    const inp = document.getElementById(`img-input-${id}`);
    if (inp) inp.value = "";
    const zone = panel.querySelector(".upload-zone");
    if (zone) zone.textContent = "📷 Hacé click para elegir fotos (podés seleccionar varias)";
  }
}

function previewNewImgs(id, input) {
  const files = Array.from(input.files);
  pendingImgFiles[id] = files;
  const container = document.getElementById(`new-previews-${id}`);
  container.innerHTML = "";
  files.forEach((f, i) => {
    const wrap = document.createElement("div");
    wrap.style.cssText = "position:relative;display:inline-block";
    const img = document.createElement("img");
    img.src = URL.createObjectURL(f);
    img.style.cssText = "width:60px;height:60px;object-fit:cover;border-radius:8px;border:1px solid #f0d6e0";
    wrap.appendChild(img);
    container.appendChild(wrap);
  });
  const zone = document.querySelector(`#img-panel-${id} .upload-zone`);
  if (zone) zone.textContent = `✓ ${files.length} foto${files.length > 1 ? "s" : ""} lista${files.length > 1 ? "s" : ""} para subir`;
}

async function saveNewImages(id) {
  const files = pendingImgFiles[id];
  if (!files || !files.length) {
    alert("Seleccioná al menos una foto para agregar.");
    return;
  }

  const btn = document.getElementById(`btn-save-imgs-${id}`);
  const status = document.getElementById(`img-status-${id}`);
  btn.disabled = true;
  btn.textContent = "Subiendo...";
  if (status) status.textContent = "";

  try {
    // Obtener imágenes actuales del producto
    const res = await adminFetch(`${API_URL}/producto?id=${id}`);
    const prod = await res.json();
    const existing = (prod.images && prod.images.length) ? prod.images : (prod.image_url ? [prod.image_url] : []);

    // Subir nuevas imágenes
    const newUrls = await Promise.all(files.map(f => uploadImage(f)));
    const allImages = [...existing, ...newUrls];

    // Actualizar producto
    const patch = await adminFetch(`${API_URL}/producto`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, images: allImages, image_url: allImages[0] })
    });

    if (!patch.ok) throw new Error("Error al guardar");

    if (status) status.textContent = `✓ ${newUrls.length} foto${newUrls.length > 1 ? "s" : ""} agregada${newUrls.length > 1 ? "s" : ""}`;
    pendingImgFiles[id] = [];

    // Refrescar solo los thumbs del panel sin recargar toda la lista
    const thumbsContainer = document.getElementById(`thumbs-${id}`);
    if (thumbsContainer) thumbsContainer.innerHTML = renderThumbs(id, allImages);

    // Actualizar el contador en la meta
    const meta = document.querySelector(`#img-panel-${id}`)?.previousElementSibling?.querySelector(".product-item__meta");
    if (meta) {
      const parts = meta.textContent.split("·");
      if (parts.length >= 2) meta.textContent = parts.slice(0, -1).join("·") + ` · ${allImages.length} foto${allImages.length !== 1 ? "s" : ""}`;
    }

    // Limpiar input y preview
    const inp = document.getElementById(`img-input-${id}`);
    if (inp) inp.value = "";
    const prev = document.getElementById(`new-previews-${id}`);
    if (prev) prev.innerHTML = "";
    const zone = document.querySelector(`#img-panel-${id} .upload-zone`);
    if (zone) zone.textContent = "📷 Hacé click para elegir fotos (podés seleccionar varias)";

  } catch (e) {
    if (status) { status.textContent = "Error: " + e.message; status.style.color = "#c0392b"; }
  } finally {
    btn.disabled = false;
    btn.textContent = "Guardar fotos";
  }
}
