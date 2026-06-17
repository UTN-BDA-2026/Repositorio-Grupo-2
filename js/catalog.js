document.addEventListener("DOMContentLoaded", async () => {

  // ── Fetch productos ─────────────────────────────────
  async function fetchProducts() {
    const res = await fetch(`${API_URL}/productos`);
    if (!res.ok) return [];
    return await res.json();
  }

  // ── DOM refs ────────────────────────────────────────
  const grid             = document.getElementById("product-grid");
  const sectionTitle     = document.getElementById("section-title");
  const yearEl           = document.getElementById("year");
  const chips            = document.getElementById("catalogoChips");
  const chipGroups       = document.querySelectorAll(".chip-group");
  const chipGroup        = chipGroups[0]; // legacy compat
  const header           = document.querySelector(".header");
  const filterBurger     = document.getElementById("filterBurger");
  const filterBurgerBadge = document.getElementById("filterBurgerActive");
  const filterBackdrop   = document.getElementById("filterBackdrop");
  const mSheet           = document.getElementById("mSheet");
  const mSheetClose      = document.getElementById("mSheetClose");
  const mSheetList       = document.getElementById("mSheetList");

  // ── Drawer lateral mobile ────────────────────────────
  const menuBurger       = document.getElementById("menuBurger");
  const drawer           = document.getElementById("drawer");
  const drawerBackdrop   = document.getElementById("drawerBackdrop");
  const drawerClose      = document.getElementById("drawerClose");
  const drawerSearchInput = document.getElementById("drawerSearchInput");

  function openDrawer() {
    drawer?.classList.add("is-open");
    drawer?.removeAttribute("aria-hidden");
    drawerBackdrop?.classList.add("is-open");
    menuBurger?.classList.add("is-open");
    menuBurger?.setAttribute("aria-expanded", "true");
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    setTimeout(() => drawerSearchInput?.focus(), 320);
  }

  function closeDrawer() {
    drawer?.classList.remove("is-open");
    drawer?.setAttribute("aria-hidden", "true");
    drawerBackdrop?.classList.remove("is-open");
    menuBurger?.classList.remove("is-open");
    menuBurger?.setAttribute("aria-expanded", "false");
    document.documentElement.style.overflow = "";
    document.body.style.overflow = "";
  }

  menuBurger?.addEventListener("click", () => {
    drawer?.classList.contains("is-open") ? closeDrawer() : openDrawer();
  });
  drawerClose?.addEventListener("click", closeDrawer);
  drawerBackdrop?.addEventListener("click", closeDrawer);

  drawer?.querySelectorAll(".drawer__link").forEach(link => {
    link.addEventListener("click", () => setTimeout(closeDrawer, 120));
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && drawer?.classList.contains("is-open")) closeDrawer();
  });

  if (drawerSearchInput) {
    drawerSearchInput.addEventListener("input", () => {
      searchQuery = drawerSearchInput.value.trim().toLowerCase();
      if (searchInput) searchInput.value = drawerSearchInput.value;
      if (searchQuery) {
        const catalogoEl = document.getElementById("catalogo");
        if (catalogoEl) catalogoEl.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      renderProducts();
    });
  }

  // Swipe left to close drawer
  if (drawer) {
    let swipeStartX = 0;
    drawer.addEventListener("touchstart", e => { swipeStartX = e.touches[0].clientX; }, { passive: true });
    drawer.addEventListener("touchend", e => {
      if (swipeStartX - e.changedTouches[0].clientX > 60) closeDrawer();
    }, { passive: true });
  }

  // ── Catálogo link en drawer: abre filtros ────────────
  document.getElementById("drawerNavCatalogo")?.addEventListener("click", (e) => {
    if (isMobile()) {
      e.preventDefault();
      closeDrawer();
      setTimeout(() => {
        scrollToCatalogo();
        setTimeout(() => openSheet(), 300);
      }, 200);
    }
  });

  if (yearEl) yearEl.textContent = new Date().getFullYear();

  function isMobile() { return window.innerWidth <= 768; }

  // ── Buscador ────────────────────────────────────────
  const searchToggle = document.getElementById("searchToggle");
  const searchBox    = document.getElementById("searchBox");
  const searchInput  = document.getElementById("searchInput");
  const searchClear  = document.getElementById("searchClear");
  const headerSearch = document.getElementById("headerSearch");
  let   searchQuery  = "";

  if (searchToggle) {
    searchToggle.addEventListener("click", () => {
      headerSearch.classList.toggle("is-open");
      if (headerSearch.classList.contains("is-open")) {
        setTimeout(() => searchInput?.focus(), 300);
      } else {
        clearSearch();
      }
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      searchQuery = searchInput.value.trim().toLowerCase();
      renderProducts(activeFilter);
      // Scroll al catálogo si hay texto y el usuario está arriba
      if (searchQuery) {
        document.querySelector("#catalogo")?.scrollIntoView({ behavior: "smooth" });
      }
    });
    searchInput.addEventListener("keydown", e => {
      if (e.key === "Escape") {
        headerSearch.classList.remove("is-open");
        clearSearch();
      }
    });
  }

  if (searchClear) {
    searchClear.addEventListener("click", () => {
      clearSearch();
      searchInput?.focus();
    });
  }

  function clearSearch() {
    searchQuery = "";
    if (searchInput) searchInput.value = "";
    renderProducts(activeFilter);
  }

  // Cerrar al click fuera
  document.addEventListener("click", e => {
    if (headerSearch && !headerSearch.contains(e.target)) {
      if (headerSearch.classList.contains("is-open") && !searchQuery) {
        headerSearch.classList.remove("is-open");
      }
    }
  });

  // ── Construir lista del bottom sheet desde los chips ─
  let activeFilter = { type: "all", value: "all" };

  function buildSheetList() {
    if (!mSheetList || !chips) return;
    mSheetList.innerHTML = "";

    chips.querySelectorAll("[data-filter]").forEach(btn => {
      // Los sub-items se agregan cuando procesamos el chip-parent, no aquí
      if (btn.closest(".chip-sub")) return;

      const item = document.createElement("button");
      item.className = "m-sheet-item";
      item.dataset.filter = btn.dataset.filter;
      item.dataset.value  = btn.dataset.value;

      const label = btn.textContent.replace("▾","").trim();
      item.innerHTML = `
        <span>${label}</span>
        <span class="m-sheet-item__check"></span>
      `;

      if (btn.dataset.value === activeFilter.value) item.classList.add("is-active");

      item.addEventListener("click", () => {
        applyFilter(item.dataset.filter, item.dataset.value, label);
        setTimeout(() => closeSheet(), 180);
      });

      mSheetList.appendChild(item);

      // Si es chip-parent, agregar sus sub-items indentados debajo
      if (btn.classList.contains("chip-parent")) {
        btn.closest(".chip-group")?.querySelectorAll(".chip-sub .chip").forEach(sub => {
          const subItem = document.createElement("button");
          subItem.className = "m-sheet-item";
          subItem.dataset.filter = sub.dataset.filter;
          subItem.dataset.value  = sub.dataset.value;
          const subLabel = sub.textContent.trim();
          subItem.innerHTML = `
            <span style="padding-left:18px;color:#888;font-size:14px;">↳ ${subLabel}</span>
            <span class="m-sheet-item__check"></span>
          `;
          if (sub.dataset.value === activeFilter.value) subItem.classList.add("is-active");
          subItem.addEventListener("click", () => {
            applyFilter(sub.dataset.filter, sub.dataset.value, subLabel);
            setTimeout(() => closeSheet(), 180);
          });
          mSheetList.appendChild(subItem);
        });
      }
    });
  }

  function applyFilter(type, value, label, scroll = false) {
    activeFilter = { type, value };
    const displayLabel = type === "all" ? "Todo" : label;

    if (sectionTitle) sectionTitle.textContent = displayLabel;
    if (filterBurgerBadge) {
      filterBurgerBadge.textContent = type === "all" ? "" : displayLabel;
    }

    // Sync chips desktop
    if (chips) {
      chips.querySelectorAll(".chip").forEach(c =>
        c.classList.toggle("is-active", c.dataset.value === value)
      );
    }

    grid.classList.add("is-animating");
    setTimeout(() => {
      renderProducts({ type, value });
      requestAnimationFrame(() => grid.classList.remove("is-animating"));
    }, 140);

    if (scroll) {
      document.querySelector("#catalogo")?.scrollIntoView({ behavior: "smooth" });
    }
  }

  // ── Bottom sheet open/close ─────────────────────────
  function openSheet() {
    buildSheetList();
    mSheet?.classList.add("is-open");
    mSheet?.removeAttribute("aria-hidden");
    filterBackdrop?.classList.add("is-open");
    filterBurger?.setAttribute("aria-expanded", "true");
    // Bloquear scroll del body
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
  }

  function closeSheet() {
    mSheet?.classList.remove("is-open");
    mSheet?.setAttribute("aria-hidden", "true");
    filterBackdrop?.classList.remove("is-open");
    filterBurger?.setAttribute("aria-expanded", "false");
    document.documentElement.style.overflow = "";
    document.body.style.overflow = "";
  }

  if (filterBurger) {
    filterBurger.addEventListener("click", () => {
      isMobile() ? (mSheet?.classList.contains("is-open") ? closeSheet() : openSheet()) : null;
    });
  }
  mSheetClose?.addEventListener("click", closeSheet);
  filterBackdrop?.addEventListener("click", closeSheet);

  // Cerrar con swipe hacia abajo (touch)
  if (mSheet) {
    let startY = 0;
    mSheet.addEventListener("touchstart", e => { startY = e.touches[0].clientY; }, { passive: true });
    mSheet.addEventListener("touchend", e => {
      if (e.changedTouches[0].clientY - startY > 60) closeSheet();
    }, { passive: true });
  }

  // ── Submenús desktop (click) — soporta múltiples chip-groups ──
  chipGroups.forEach(group => {
    const parentChip = group.querySelector(".chip-parent");
    const subMenu    = group.querySelector(".chip-sub");
    if (parentChip) parentChip.addEventListener("click", (e) => {
      // Cerrar otros grupos abiertos
      chipGroups.forEach(g => { if (g !== group) g.classList.remove("open"); });
      group.classList.toggle("open");
    });
    if (subMenu) subMenu.addEventListener("click", () => group.classList.remove("open"));
  });
  document.addEventListener("click", (e) => {
    if (!isMobile()) {
      chipGroups.forEach(g => { if (!g.contains(e.target)) g.classList.remove("open"); });
    }
  });

  // ── Scroll exacto descontando el header ─────────────
  function scrollToCatalogo() {
    const el = document.getElementById("catalogo");
    if (!el) return;
    const headerH = header ? header.offsetHeight : 0;
    const top = el.getBoundingClientRect().top + window.scrollY - headerH;
    window.scrollTo({ top, behavior: "smooth" });
  }

  // ── Botón "Ver colección" del hero mobile ────────────
  document.querySelector(".hero-mobile__btn")?.addEventListener("click", (e) => {
    e.preventDefault();
    scrollToCatalogo();
  });

  // ── Nav "Catálogo" en mobile: abre el filter sheet ──
  const navCatalogo = document.getElementById("navCatalogo");
  if (navCatalogo) {
    navCatalogo.addEventListener("click", (e) => {
      if (isMobile()) {
        e.preventDefault();
        scrollToCatalogo();
        setTimeout(() => openSheet(), 300);
      }
    });
  }

  // ── Header shrink on scroll ─────────────────────────
  function setHeaderH() {
    if (!header) return;
    document.documentElement.style.setProperty("--headerH", header.offsetHeight + "px");
  }

  // ── Nav activo según sección visible ─────────────────
  function updateActiveNav() {
    if (!isMobile()) return;
    const sections = [
      { id: "inicio",   nav: "inicio"   },
      { id: "catalogo", nav: "catalogo" },
      { id: "contacto", nav: "contacto" },
    ];
    const scrollY = window.scrollY + window.innerHeight / 2;
    let active = "inicio";
    for (const s of sections) {
      const el = document.getElementById(s.id);
      if (el && el.offsetTop <= scrollY) active = s.nav;
    }
    document.querySelectorAll(".nav__link[data-nav]").forEach(a => {
      a.classList.toggle("is-active", a.dataset.nav === active);
    });
  }

  function onScroll() {
    if (!header) return;
    header.classList.toggle("header--compact", window.scrollY > 10);
    setHeaderH();
    updateActiveNav();
  }
  setHeaderH();
  updateActiveNav();
  window.addEventListener("resize", setHeaderH);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  if (!grid) return;

  // ── Scroll reveal ───────────────────────────────────
  const revealObserver = new IntersectionObserver(
    (entries) => entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add("is-visible"); revealObserver.unobserve(e.target); }
    }),
    { threshold: 0.12 }
  );

  function observeCards() {
    document.querySelectorAll(".card").forEach(c => {
      c.classList.remove("is-visible");
      revealObserver.observe(c);
    });
  }

  // ── Render ──────────────────────────────────────────
  let products = [];

  function renderProducts(filter = { type: "all", value: "all" }) {
    let list = products;
    if (filter.type === "cat") list = products.filter(p => p.cat === filter.value);
    if (filter.type === "sub") list = products.filter(p => p.sub === filter.value);

    // Filtro de búsqueda por texto
    if (searchQuery) {
      list = list.filter(p => p.name.toLowerCase().includes(searchQuery));
    }

    if (list.length === 0) {
      grid.innerHTML = `<p style="grid-column:1/-1;text-align:center;padding:3rem 1rem;color:#aaa;font-size:15px;">
        ${searchQuery ? `No encontramos "${searchInput.value}" 🔍` : "Todavía no hay productos en esta categoría 🌸"}</p>`;
      return;
    }

    grid.innerHTML = list.map(p => {
      // Todas las imágenes del producto (array `images` desde la API)
      const allImgs = (p.images && p.images.length) ? p.images : [p.image_url].filter(Boolean);

      const isNew = p.created_at
        ? (Date.now() - new Date(p.created_at).getTime()) < 14 * 24 * 60 * 60 * 1000
        : false;

      const catLabel = (p.cat || "").replace(/-/g, " ").replace(/\b\w/g, m => m.toUpperCase());

      // Indicadores de imagen (solo si hay más de 1)
      const dots = allImgs.length > 1
        ? `<div class="card__dots">${allImgs.map((_, i) =>
            `<span class="card__dot${i === 0 ? " is-active" : ""}"></span>`).join("")}</div>`
        : "";

      const imgEncoded  = encodeURIComponent(cloudinaryUrl(allImgs[0] || ""));
      const nameEncoded = encodeURIComponent(p.name);
      const hasSecond   = allImgs.length > 1;

      // Líneas indicadoras (estilo premium) — solo si hay 3+ imágenes
      const lines = allImgs.length >= 3
        ? `<div class="card__lines">${allImgs.map((_, i) =>
            `<span class="card__line${i === 0 ? " is-active" : ""}"></span>`).join("")}</div>`
        : "";

      return `
        <article class="card product-link"
          data-id="${p.id}"
          data-images="${encodeURIComponent(JSON.stringify(allImgs))}">
          <div class="card__media">
            ${isNew ? '<span class="card__badge">NUEVO</span>' : ""}
            <img src="${cloudinaryUrl(allImgs[0]) || ""}" class="card__img card__img--primary" alt="${p.name}" loading="lazy">
            ${hasSecond ? `<img data-src="${cloudinaryUrl(allImgs[1])}" class="card__img card__img--secondary" alt="${p.name}">` : ""}
            ${lines}
            <button class="card__add-btn"
              data-cart-id="${p.id}"
              data-cart-name="${nameEncoded}"
              data-cart-price="${p.price}"
              data-cart-efectivo="${p.precio_efectivo || 0}"
              data-cart-image="${imgEncoded}"
              data-cart-cat="${p.cat || ""}"
              aria-label="Agregar al carrito">
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
                <line x1="3" y1="6" x2="21" y2="6"/>
                <path d="M16 10a4 4 0 01-8 0"/>
              </svg>
            </button>
          </div>
          <div class="card__info">
            ${catLabel ? `<span class="card__cat">${catLabel}</span>` : ""}
            <h3 class="card__title">${p.name}</h3>
            <p class="card__price">$${p.price.toLocaleString("es-AR")}</p>
          </div>
        </article>`;
    }).join("");

    observeCards();
    attachImageCycle();
  }

  // ── Image cycling en hover ──────────────────────────────────────────────
  // La imagen secundaria usa data-src para no descargarse en el render inicial.
  // Imagen secundaria: se carga al hacer hover sobre la card.
  function attachImageCycle() {
    document.querySelectorAll(".product-link").forEach(card => {
      const allImgs   = JSON.parse(decodeURIComponent(card.dataset.images || "[]"));
      const secondary = card.querySelector(".card__img--secondary");

      if (allImgs.length < 2 || !secondary) return;

      // ── 2 imágenes: CSS maneja el cross-fade; JS solo dispara la carga ──
      if (allImgs.length === 2) {
        card.addEventListener("mouseenter", function loadSec() {
          if (!secondary.src) secondary.src = secondary.dataset.src || allImgs[1];
          card.removeEventListener("mouseenter", loadSec); // una sola carga
        });
        return;
      }

      // ── 3+ imágenes: ciclo automático ───────────────────────────────────
      const lines = card.querySelectorAll(".card__line");
      let timer = null;
      let idx = 1;

      function showImg(i) {
        idx = i;
        secondary.style.opacity = "0";
        setTimeout(() => {
          secondary.src = allImgs[idx];
          secondary.style.opacity = "1";
        }, 100);
        lines.forEach((l, j) => l.classList.toggle("is-active", j === idx));
      }

      card.addEventListener("mouseenter", () => {
        idx = 1;
        secondary.src = allImgs[1];
        clearInterval(timer);
        timer = setInterval(() => showImg(idx + 1 >= allImgs.length ? 1 : idx + 1), 900);
      });

      card.addEventListener("mouseleave", () => {
        clearInterval(timer);
        timer = null;
        lines.forEach((l, j) => l.classList.toggle("is-active", j === 0));
      });
    });
  }

  // ── Chips filtros (desktop) ─────────────────────────
  if (chips) {
    chips.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-filter]");
      if (!btn) return;
      const label = btn.textContent.trim().replace("▾", "").trim();
      applyFilter(btn.dataset.filter, btn.dataset.value, label);
    });
  }

  // ── Click en "+" → agregar al carrito ──────────────
  grid.addEventListener("click", (e) => {
    const addBtn = e.target.closest(".card__add-btn");
    if (addBtn) {
      e.stopPropagation();
      if (typeof cartAdd === "function") {
        cartAdd({
          id:             addBtn.dataset.cartId,
          name:           decodeURIComponent(addBtn.dataset.cartName),
          price:          Number(addBtn.dataset.cartPrice),
          precio_efectivo: Number(addBtn.dataset.cartEfectivo) || 0,
          image:          decodeURIComponent(addBtn.dataset.cartImage),
          cat:            addBtn.dataset.cartCat,
        });
      }
      return;
    }

    // ── Click en card → página de producto ────────────
    const card = e.target.closest(".product-link");
    if (!card) return;
    window.location.href = `producto.html?id=${card.dataset.id}`;
  });

  // ── Skeleton loader ─────────────────────────────────
  function showSkeletons(n = 8) {
    grid.innerHTML = Array.from({ length: n }, () => `
      <div class="skeleton-card">
        <div class="skeleton-media"></div>
        <div class="skeleton-info">
          <div class="skeleton-line skeleton-line--short"></div>
          <div class="skeleton-line"></div>
          <div class="skeleton-line skeleton-line--price"></div>
        </div>
      </div>`).join("");
  }

  // ── Init ────────────────────────────────────────────
  showSkeletons();
  products = await fetchProducts();

  // Si viene con ?cat=giftcards en la URL, filtrar directamente
  const urlCat = new URLSearchParams(window.location.search).get("cat");
  if (urlCat) {
    history.replaceState(null, '', window.location.pathname);
    const matchChip = chips?.querySelector(`[data-value="${urlCat}"]`);
    const label = matchChip ? matchChip.textContent.replace("▾","").trim() : urlCat;
    applyFilter("cat", urlCat, label, true);
  } else {
    renderProducts({ type: "all", value: "all" });
  }

});
