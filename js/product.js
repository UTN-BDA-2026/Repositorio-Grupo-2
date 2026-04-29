document.addEventListener("DOMContentLoaded", async () => {

  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  if (!id) { showEmpty(); return; }

  let product;
  try {
    const res = await fetch(`${API_URL}/producto?id=${id}`);
    const data = await res.json();
    product = data;
  } catch (e) { showEmpty(); return; }

  if (!product) { showEmpty(); return; }

  const name           = product.name           || "Producto";
  const price          = Number(product.price   || 0);
  const precioEfectivo = Number(product.precio_efectivo || 0);
  const image          = product.image_url      || "";
  const cat            = product.cat            || "";
  const sub            = product.sub            || "";
  const description    = product.descripcion    || "";
  const images         = (product.images && product.images.length) ? product.images : [image].filter(Boolean);

  // Título pestaña
  document.title = `${name} • AGUSTINA`;

  // Imagen
  const imgEl = document.getElementById("prdImage");
  imgEl.src = cloudinaryUrl(image);
  imgEl.alt = name;

  // Nombre y precio
  document.getElementById("prdName").textContent  = name;
  document.getElementById("prdPrice").textContent = "$" + price.toLocaleString("es-AR");

  // Precio efectivo (opcional)
  if (precioEfectivo > 0) {
    document.getElementById("prdPriceEfectivo").style.display = "block";
    document.getElementById("prdPriceEfectivoVal").textContent = "$" + precioEfectivo.toLocaleString("es-AR");
  }

  // Breadcrumbs
  const catLabel = prettify(cat);
  const subLabel = prettify(sub);
  document.getElementById("prdCrumbs").textContent =
    `Catálogo${catLabel ? " / " + catLabel : ""}${subLabel ? " / " + subLabel : ""}`;

  // Pills
  const pillsEl = document.getElementById("prdPills");
  if (catLabel) pillsEl.innerHTML += `<span class="prd-pill">${catLabel}</span>`;
  if (subLabel && subLabel !== catLabel) pillsEl.innerHTML += `<span class="prd-pill">${subLabel}</span>`;

  // Descripción
  if (description) {
    const descEl = document.getElementById("prdDesc");
    descEl.textContent = description;
    descEl.style.display = "block";
  }

  // ── Gift card: mostrar selector de monto si la categoría es giftcards ──
  const isGiftCard = cat === "giftcards";
  let gcSelectedAmount = 0;

  if (isGiftCard) {
    // Mostrar bloque y ocultar precio fijo
    document.getElementById("gcAmount").hidden = false;
    document.getElementById("prdPrice").style.display = "none";

    const presets = document.querySelectorAll(".gc-preset");
    const gcInput = document.getElementById("gcInput");

    // Click en preset
    presets.forEach(btn => {
      btn.addEventListener("click", () => {
        presets.forEach(b => b.classList.remove("selected"));
        btn.classList.add("selected");
        gcSelectedAmount = Number(btn.dataset.val);
        gcInput.value = "";
        updatePriceDisplay(gcSelectedAmount);
      });
    });

    // Escritura libre
    gcInput.addEventListener("input", () => {
      presets.forEach(b => b.classList.remove("selected"));
      const v = Number(gcInput.value);
      gcSelectedAmount = v > 0 ? v : 0;
      updatePriceDisplay(gcSelectedAmount);
    });

    function updatePriceDisplay(amount) {
      const priceEl = document.getElementById("prdPrice");
      if (amount > 0) {
        priceEl.textContent = "$" + amount.toLocaleString("es-AR");
        priceEl.style.display = "block";
      } else {
        priceEl.style.display = "none";
      }
    }
  }

  // ── WhatsApp directo (solo este producto) ──
  function buildWAMsg() {
    if (isGiftCard && gcSelectedAmount > 0) {
      return `Hola Agustina! 👋 Quiero una *Gift Card por $${gcSelectedAmount.toLocaleString("es-AR")}*. ¿Cómo la gestiono?`;
    }
    return `Hola Agustina! 👋 Quiero consultar por: *${name}*. ¿Está disponible?`;
  }

  const waBtn = document.getElementById("prdWA");
  waBtn.href = `https://wa.me/5492604009647?text=${encodeURIComponent(buildWAMsg())}`;
  // Actualizar link WA cuando cambia el monto
  if (isGiftCard) {
    document.getElementById("gcAmount").addEventListener("input", () => {
      waBtn.href = `https://wa.me/5492604009647?text=${encodeURIComponent(buildWAMsg())}`;
    });
    document.querySelectorAll(".gc-preset").forEach(btn => {
      btn.addEventListener("click", () => {
        waBtn.href = `https://wa.me/5492604009647?text=${encodeURIComponent(buildWAMsg())}`;
      });
    });
  }

  // ── Botón "Agregar al carrito" ──
  const cartBtn = document.getElementById("prdCartBtn");
  if (cartBtn) {
    cartBtn.addEventListener("click", () => {
      // Validar monto si es gift card
      if (isGiftCard && gcSelectedAmount <= 0) {
        const gcInput = document.getElementById("gcInput");
        gcInput.focus();
        gcInput.style.outline = "2px solid #c06080";
        setTimeout(() => gcInput.style.outline = "", 1500);
        return;
      }

      if (typeof cartAdd === "function") {
        const finalPrice = isGiftCard ? gcSelectedAmount : price;
        const finalName  = isGiftCard
          ? `${name} — $${gcSelectedAmount.toLocaleString("es-AR")}`
          : name;

        cartAdd({ id: String(product.id) + (isGiftCard ? `-${gcSelectedAmount}` : ""), name: finalName, price: finalPrice, precio_efectivo: isGiftCard ? 0 : precioEfectivo, image: images[0] || image, cat });

        cartBtn.classList.add("added");
        cartBtn.innerHTML = `
          <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 10 8 14 16 6"/></svg>
          Agregado al carrito`;
        setTimeout(() => {
          cartBtn.classList.remove("added");
          cartBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0">
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/>
              <path d="M16 10a4 4 0 01-8 0"/>
            </svg>
            Agregar al carrito`;
        }, 2000);
      }
    });
  }

  // Galería thumbnails
  const thumbsEl = document.getElementById("prdThumbs");

  if (images.length > 1) {
    images.forEach((url, i) => {
      const thumb = document.createElement("img");
      thumb.src = cloudinaryUrl(url, 300);
      thumb.className = "prd-thumb" + (i === 0 ? " active" : "");
      thumb.addEventListener("click", () => {
        imgEl.src = cloudinaryUrl(url);
        thumbsEl.querySelectorAll(".prd-thumb").forEach(t => t.classList.remove("active"));
        thumb.classList.add("active");
      });
      thumbsEl.appendChild(thumb);
    });
  }

  // Error imagen
  imgEl.addEventListener("error", () => {
    imgEl.closest(".prd-imgwrap").style.minHeight = "200px";
  });

  function showEmpty() {
    document.getElementById("prdEmpty").hidden  = false;
    document.getElementById("prdLayout").hidden = true;
  }

  function prettify(str) {
    if (!str) return "";
    return str.replace(/-/g, " ").replace(/\b\w/g, m => m.toUpperCase());
  }
});
