/* =============================================
   cart.js — Carrito de Agustina
   Incluir en index.html y producto.html
   ============================================= */
(function () {
  const CART_KEY  = "agustina_cart_v1";
  const WA_NUMBER = "5492604009647";

  // ── Persistencia ─────────────────────────────────────
  function getCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
    catch { return []; }
  }
  function saveCart(c) {
    localStorage.setItem(CART_KEY, JSON.stringify(c));
    updateBadge();
  }

  // ── Acciones (expuestas globalmente) ─────────────────
  window.cartAdd = function (product) {
    // product: { id, name, price, image, cat }
    const cart = getCart();
    const idx  = cart.findIndex(i => String(i.id) === String(product.id));
    if (idx > -1) { cart[idx].qty++; }
    else { cart.push({ ...product, qty: 1 }); }
    saveCart(cart);
    showToast(product.name);
    renderBody();
  };

  window.cartRemove = function (id) {
    saveCart(getCart().filter(i => String(i.id) !== String(id)));
    renderBody();
  };

  window.cartQty = function (id, delta) {
    const cart = getCart();
    const item = cart.find(i => String(i.id) === String(id));
    if (!item) return;
    item.qty = Math.max(1, item.qty + delta);
    saveCart(cart);
    renderBody();
  };

  // ── Contadores ───────────────────────────────────────
  function totalCount() { return getCart().reduce((s, i) => s + i.qty, 0); }
  function totalPrice() { return getCart().reduce((s, i) => s + i.price * i.qty, 0); }
  function totalEfectivo() {
    const cart = getCart();
    const hasEfectivo = cart.some(i => i.precio_efectivo > 0);
    if (!hasEfectivo) return 0;
    // Si un item no tiene precio efectivo, usa el precio normal
    return cart.reduce((s, i) => s + (i.precio_efectivo > 0 ? i.precio_efectivo : i.price) * i.qty, 0);
  }

  function updateBadge() {
    const n = totalCount();
    document.querySelectorAll(".cart-badge").forEach(el => {
      el.textContent = n;
      el.style.display = n > 0 ? "flex" : "none";
    });
    const fab = document.getElementById("cartFab");
    if (fab) fab.classList.toggle("cart-fab--active", n > 0);
  }

  // ── Toast ────────────────────────────────────────────
  function showToast(name) {
    const el = document.getElementById("cartToast");
    if (!el) return;
    el.innerHTML = `<svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 10 8 14 16 6"/></svg> <span>Agregado al carrito</span>`;
    el.classList.add("is-visible");
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove("is-visible"), 2400);
  }

  // ── Bloqueo de scroll del body (fix iOS) ─────────────
  let _scrollY = 0;

  function lockBodyScroll() {
    _scrollY = window.scrollY;
    document.documentElement.style.overflow = "hidden";
    document.documentElement.style.height   = "100%";
    document.body.style.overflow   = "hidden";
    document.body.style.height     = "100%";
    document.body.style.touchAction = "none";
  }

  function unlockBodyScroll() {
    document.documentElement.style.overflow = "";
    document.documentElement.style.height   = "";
    document.body.style.overflow   = "";
    document.body.style.height     = "";
    document.body.style.touchAction = "";
    window.scrollTo(0, _scrollY);
  }

  // ── Panel ────────────────────────────────────────────
  function openPanel() {
    renderBody();
    document.getElementById("cartPanel")?.classList.add("is-open");
    document.getElementById("cartOverlay")?.classList.add("is-open");
    lockBodyScroll();
  }

  function closePanel() {
    document.getElementById("cartPanel")?.classList.remove("is-open");
    document.getElementById("cartOverlay")?.classList.remove("is-open");
    unlockBodyScroll();
  }

  function renderBody() {
    const body   = document.getElementById("cartBody");
    const footer = document.getElementById("cartFooter");
    if (!body) return;

    const cart = getCart();

    if (cart.length === 0) {
      body.innerHTML = `
        <div class="cart-empty">
          <svg viewBox="0 0 48 48" width="48" height="48" fill="none" stroke="#ddd" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M8 8h4l5.5 22h17l4-14H14"/>
            <circle cx="20" cy="38" r="2.5"/><circle cx="33" cy="38" r="2.5"/>
          </svg>
          <p>Tu carrito está vacío</p>
          <span>Agregá algo que te guste 🌸</span>
        </div>`;
      if (footer) footer.hidden = true;
      return;
    }

    body.innerHTML = cart.map(item => `
      <div class="cart-item">
        <img class="cart-item__img" src="${item.image}" alt="${item.name}" loading="lazy">
        <div class="cart-item__info">
          <p class="cart-item__name">${item.name}</p>
          <p class="cart-item__price">$${(item.price * item.qty).toLocaleString("es-AR")}</p>
          ${item.precio_efectivo > 0 ? `<p class="cart-item__efectivo">💵 Efectivo: $${(item.precio_efectivo * item.qty).toLocaleString("es-AR")}</p>` : ""}
          <div class="cart-item__qty">
            <button class="cart-qty-btn" onclick="cartQty('${item.id}', -1)">−</button>
            <span class="cart-qty-num">${item.qty}</span>
            <button class="cart-qty-btn" onclick="cartQty('${item.id}', 1)">+</button>
          </div>
        </div>
        <button class="cart-item__rm" onclick="cartRemove('${item.id}')" aria-label="Eliminar">
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <line x1="3" y1="3" x2="13" y2="13"/><line x1="13" y1="3" x2="3" y2="13"/>
          </svg>
        </button>
      </div>
    `).join("");

    if (footer) {
      footer.hidden = false;
      const totalEl = document.getElementById("cartTotal");
      if (totalEl) totalEl.textContent = "$" + totalPrice().toLocaleString("es-AR");

      const ef = totalEfectivo();
      const efRow = document.getElementById("cartTotalEfectivo");
      if (efRow) {
        if (ef > 0 && ef !== totalPrice()) {
          efRow.hidden = false;
          const efEl = document.getElementById("cartTotalEfectivoVal");
          if (efEl) efEl.textContent = "$" + ef.toLocaleString("es-AR");
        } else {
          efRow.hidden = true;
        }
      }

      const waBtn = document.getElementById("cartWaBtn");
      if (waBtn) waBtn.href = buildWALink(cart);
    }
  }

  function buildWALink(cart) {
    const lines = cart.map(i =>
      `• _${i.name}_ x${i.qty}  →  $${(i.price * i.qty).toLocaleString("es-AR")}`
    );
    const total = totalPrice().toLocaleString("es-AR");
    const ef    = totalEfectivo();
    const efLine = (ef > 0 && ef !== totalPrice())
      ? `\n💵 *Total en efectivo: $${ef.toLocaleString("es-AR")}*`
      : "";
    const msg = [
      "Hola Agustina! 🛍️ Me gustaría consultar por estos productos:",
      "",
      ...lines,
      "",
      `💰 *Total estimado: $${total}*${efLine}`,
      "",
      "¿Están disponibles? ¡Gracias! 😊"
    ].join("\n");
    return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`;
  }

  // ── Init: inyectar HTML del carrito ──────────────────
  function init() {
    document.body.insertAdjacentHTML("beforeend", `
      <!-- Carrito overlay -->
      <div class="cart-overlay" id="cartOverlay"></div>

      <!-- Panel lateral -->
      <div class="cart-panel" id="cartPanel" aria-label="Carrito de compras">
        <div class="cart-panel__header">
          <div class="cart-panel__title">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/>
              <path d="M16 10a4 4 0 01-8 0"/>
            </svg>
            Mi carrito
          </div>
          <button class="cart-panel__close" id="cartClose" aria-label="Cerrar">
            <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <line x1="3" y1="3" x2="13" y2="13"/><line x1="13" y1="3" x2="3" y2="13"/>
            </svg>
          </button>
        </div>

        <div class="cart-panel__body" id="cartBody"></div>

        <div class="cart-panel__footer" id="cartFooter" hidden>
          <div class="cart-panel__total">
            <span>Total estimado</span>
            <strong id="cartTotal">$0</strong>
          </div>
          <div class="cart-panel__total cart-panel__total--efectivo" id="cartTotalEfectivo" hidden>
            <span>💵 Total en efectivo</span>
            <strong id="cartTotalEfectivoVal" style="color:#1a8f4a">$0</strong>
          </div>
          <a class="cart-panel__wa" id="cartWaBtn" target="_blank" rel="noopener">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M12 2a10 10 0 00-8.7 15l-1.1 4 4-1A10 10 0 1012 2zm0 18a8 8 0 01-4-1l-.3-.2-2.4.6.6-2.3-.2-.3A8 8 0 1112 20zm4.3-6.1c-.2-.1-1.4-.7-1.6-.8-.2-.1-.4-.1-.6.1-.2.2-.7.8-.9 1-.2.2-.3.2-.6.1-.3-.1-1.2-.5-2.2-1.4-.8-.7-1.4-1.6-1.5-1.9-.2-.3 0-.4.1-.6.1-.1.3-.3.4-.5.1-.2.1-.3 0-.5-.1-.1-.6-1.5-.8-2-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.4-.2.3-1 1-1 2.3 0 1.3 1 2.6 1.1 2.8.1.2 1.9 2.9 4.6 4.1 2.7 1.2 2.7.8 3.2.8.5 0 1.6-.7 1.8-1.3.2-.6.2-1.1.2-1.2 0-.1-.2-.2-.4-.3z"/>
            </svg>
            Enviar pedido por WhatsApp
          </a>
          <p class="cart-panel__note">Tu pedido se enviará a Agustina por WhatsApp. Ella te confirma disponibilidad y coordina el pago.</p>
        </div>
      </div>

      <!-- Botón flotante -->
      <button class="cart-fab" id="cartFab" aria-label="Ver carrito">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/>
          <path d="M16 10a4 4 0 01-8 0"/>
        </svg>
        <span class="cart-badge" id="cartBadge" style="display:none">0</span>
      </button>

      <!-- Toast notificación -->
      <div class="cart-toast" id="cartToast"></div>
    `);

    document.getElementById("cartFab")?.addEventListener("click", openPanel);
    document.getElementById("cartClose")?.addEventListener("click", closePanel);
    document.getElementById("cartOverlay")?.addEventListener("click", closePanel);

    // Swipe down en mobile para cerrar
    const panel = document.getElementById("cartPanel");
    if (panel) {
      let startY = 0;
      panel.addEventListener("touchstart", e => { startY = e.touches[0].clientY; }, { passive: true });
      panel.addEventListener("touchend",   e => {
        if (e.changedTouches[0].clientY - startY > 70) closePanel();
      }, { passive: true });
    }

    // Exponer para uso externo
    window._cartOpen  = openPanel;
    window._cartClose = closePanel;

    updateBadge();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
