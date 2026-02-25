/* ══════════════════════════════════════════════════════════
   TeleVe Chile — app.js
   Base de datos: canales.json  (edita ese archivo)
   ══════════════════════════════════════════════════════════ */

// ── CONFIG & STATE ──────────────────────────────────────────
const DB_FILE = 'canales.json'; // ← APUNTA A TU ARCHIVO JSON
let DATA        = null;
let filtered    = [];
let currentPage = 1;
let perPage     = 6;
let currentChannel = null;
let favorites   = JSON.parse(localStorage.getItem('televe_favorites') || '[]');

// ── LOAD DATABASE ───────────────────────────────────────────
async function loadData() {
  try {
    const res = await fetch(DB_FILE);
    if (!res.ok) throw new Error('No se pudo cargar ' + DB_FILE);
    DATA = await res.json();
    perPage = DATA.configuracion?.canales_por_pagina || 6;
    init();
  } catch (e) {
    console.warn('[TeleVe] Usando datos locales de muestra:', e.message);
    DATA    = getFallbackData();
    perPage = 6;
    init();
  }
}

function getFallbackData() {
  return {
    sitio: { nombre: 'TeleVe Chile', slogan: 'Tu TV nacional' },
    categorias: ['Noticias', 'Entretenimiento', 'Deportes', 'Cultura'],
    calidades:  ['4K', 'FHD', 'HD', 'SD'],
    canales: [
      {
        id: 1, nombre: 'Mega', slug: 'mega',
        logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f0/Mega_Chile_logo.svg/2560px-Mega_Chile_logo.svg.png',
        descripcion: 'Canal líder en Chile con entretenimiento, noticias y programas de farándula para toda la familia.',
        url_embed: 'https://www.youtube.com/embed/live_stream?channel=UCdSoqpNuGerAcXxFjcHnXsg',
        url_stream: '',
        categoria: 'Entretenimiento', calidad: 'HD',
        año_fundacion: 1990, region: 'Nacional',
        activo: true, destacado: true,
        tags: ['entretenimiento', 'noticias', 'farándula'],
        descripcion_corta: 'Entretenimiento para toda Chile',
        rating: 4.5, vistas: 125430
      }
    ],
    configuracion: { canales_por_pagina: 6, canal_destacado_id: 1 }
  };
}

// ── INIT ────────────────────────────────────────────────────
function init() {
  document.title = DATA.sitio.nombre + ' — TV Nacional en Vivo';
  populateFilters();
  setupHero();
  setupTicker();
  setupFooter();
  renderCatBrowse();
  filterAndRender();
  document.getElementById('stat-canales').textContent =
    DATA.canales.filter(c => c.activo).length;
  setupEventListeners();
}

// ── HERO FEATURED ────────────────────────────────────────────
function setupHero() {
  const destId = DATA.configuracion?.canal_destacado_id;
  const dest   = DATA.canales.find(c => c.id === destId) || DATA.canales[0];
  if (!dest) return;

  document.getElementById('hero-logo').src          = dest.logo;
  document.getElementById('hero-logo').alt          = dest.nombre;
  document.getElementById('hero-canal-nombre').textContent = dest.nombre;
  document.getElementById('hero-canal-cat').textContent    = dest.categoria;
  document.getElementById('hero-canal-cal').textContent    = dest.calidad;
  document.getElementById('hero-preview-card').onclick = () => openChannel(dest);
}

// ── TICKER ──────────────────────────────────────────────────
function setupTicker() {
  const names = DATA.canales.filter(c => c.activo).map(c => c.nombre);
  const text  = names.map(n => `📺 ${n} — Señal en vivo`).join('   ·   ');
  const el    = document.getElementById('ticker-text');
  el.textContent = text + '   ·   ' + text;
}

// ── FOOTER CANALES LIST ──────────────────────────────────────
function setupFooter() {
  // Canales
  const ul = document.getElementById('footer-canales');
  DATA.canales.slice(0, 6).forEach(c => {
    const li = document.createElement('li');
    li.innerHTML = `<a href="#">${c.nombre}</a>`;
    li.querySelector('a').onclick = e => { e.preventDefault(); openChannel(c); };
    ul.appendChild(li);
  });

  // Categorías dinámicas
  const ulCats = document.getElementById('footer-cats');
  const catIcons = { Noticias:'📰', Entretenimiento:'📺', Deportes:'⚽', Cultura:'🎭', Infantil:'👶', Regional:'🗺️', Internacional:'🌍' };
  DATA.categorias.forEach(cat => {
    const li = document.createElement('li');
    li.innerHTML = `<a href="#">${catIcons[cat] || '📡'} ${cat}</a>`;
    li.querySelector('a').onclick = e => {
      e.preventDefault();
      document.getElementById('cat-filter').value = cat;
      filterAndRender();
      scrollToCanales();
    };
    ulCats.appendChild(li);
  });

  // Calidades dinámicas
  const ulCals = document.getElementById('footer-cals');
  const calIcons = { '4K':'✦', 'FHD':'◈', 'HD':'◇', 'SD':'○' };
  DATA.calidades.forEach(cal => {
    const li = document.createElement('li');
    li.innerHTML = `<a href="#">${calIcons[cal] || '·'} ${cal}</a>`;
    li.querySelector('a').onclick = e => {
      e.preventDefault();
      document.getElementById('cal-filter').value = cal;
      filterAndRender();
      scrollToCanales();
    };
    ulCals.appendChild(li);
  });
}

// ── CATEGORY BROWSE SECTION ──────────────────────────────────
function renderCatBrowse() {
  const grid = document.getElementById('cat-browse-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const catIcons = {
    Noticias: '📰', Entretenimiento: '📺', Deportes: '⚽',
    Cultura: '🎭', Infantil: '👶', Regional: '🗺️', Internacional: '🌍'
  };

  // Botón "Todos"
  const allBtn = document.createElement('button');
  allBtn.className = 'cat-browse-btn cat-browse-btn-all selected';
  allBtn.dataset.cat = '';
  allBtn.innerHTML = `
    <span class="cb-icon">📡</span>
    <div class="cb-info">
      <span class="cb-name">Todos</span>
      <span class="cb-count">${DATA.canales.filter(c=>c.activo).length} canales</span>
    </div>`;
  allBtn.onclick = () => selectCatBrowse('', allBtn);
  grid.appendChild(allBtn);

  // Un botón por categoría
  DATA.categorias.forEach(cat => {
    const count = DATA.canales.filter(c => c.activo && c.categoria === cat).length;
    if (count === 0) return;
    const btn = document.createElement('button');
    btn.className = 'cat-browse-btn';
    btn.dataset.cat = cat;
    btn.innerHTML = `
      <span class="cb-icon">${catIcons[cat] || '📡'}</span>
      <div class="cb-info">
        <span class="cb-name">${cat}</span>
        <span class="cb-count">${count} canal${count !== 1 ? 'es' : ''}</span>
      </div>`;
    btn.onclick = () => selectCatBrowse(cat, btn);
    grid.appendChild(btn);
  });
}

function selectCatBrowse(cat, btn) {
  // Actualizar estado visual
  document.querySelectorAll('.cat-browse-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  // Disparar filtro
  document.getElementById('cat-filter').value = cat;
  filterAndRender();
  scrollToCanales();
}

// ── POPULATE FILTERS ─────────────────────────────────────────
function populateFilters() {
  const catSel = document.getElementById('cat-filter');
  DATA.categorias.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat; opt.textContent = cat;
    catSel.appendChild(opt);
  });

  const calSel = document.getElementById('cal-filter');
  DATA.calidades.forEach(cal => {
    const opt = document.createElement('option');
    opt.value = cal; opt.textContent = cal;
    calSel.appendChild(opt);
  });
}

// ── GET FILTERS STATE ────────────────────────────────────────
function getFilters() {
  return {
    search: document.getElementById('search-input').value.toLowerCase().trim(),
    cat:    document.getElementById('cat-filter').value,
    cal:    document.getElementById('cal-filter').value,
    sort:   document.getElementById('sort-filter').value,
    region: document.querySelector('.chip.active[data-region]')?.dataset.region || ''
  };
}

// ── FILTER & RENDER ──────────────────────────────────────────
function filterAndRender() {
  const f = getFilters();

  filtered = DATA.canales.filter(c => {
    if (!c.activo) return false;
    if (f.search) {
      const hay = (c.nombre + c.descripcion + (c.tags || []).join(' ')).toLowerCase();
      if (!hay.includes(f.search)) return false;
    }
    if (f.cat    && c.categoria !== f.cat)    return false;
    if (f.cal    && c.calidad   !== f.cal)    return false;
    if (f.region && c.region    !== f.region) return false;
    return true;
  });

  // Ordenar
  filtered.sort((a, b) => {
    if (f.sort === 'rating')  return (b.rating  || 0) - (a.rating  || 0);
    if (f.sort === 'año')     return (a.año_fundacion || 0) - (b.año_fundacion || 0);
    if (f.sort === 'vistas')  return (b.vistas  || 0) - (a.vistas  || 0);
    return a.nombre.localeCompare(b.nombre, 'es');
  });

  document.getElementById('count-num').textContent = filtered.length;
  currentPage = 1;
  // Sync cat-browse visual state
  const activeCat = f.cat;
  document.querySelectorAll('.cat-browse-btn').forEach(b => {
    b.classList.toggle('selected', b.dataset.cat === activeCat);
  });
  renderGrid();
  renderPagination();
}

// ── RENDER CARDS ─────────────────────────────────────────────
function renderGrid() {
  const grid  = document.getElementById('channels-grid');
  grid.innerHTML = '';

  const start = (currentPage - 1) * perPage;
  const slice = filtered.slice(start, start + perPage);

  if (slice.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="icon">📺</div>
        <h3>No se encontraron canales</h3>
        <p>Intenta con otros filtros o palabras de búsqueda.</p>
      </div>`;
    return;
  }

  slice.forEach((canal, idx) => {
    const isFav  = favorites.includes(canal.id);
    const card   = document.createElement('div');
    card.className = 'channel-card' + (canal.destacado ? ' featured' : '');
    card.style.animationDelay = (idx * 0.07) + 's';

    card.innerHTML = `
      <div class="card-thumb">
        <div class="thumb-bg"></div>
        <img class="card-logo"
             src="${canal.logo}"
             alt="${canal.nombre}"
             loading="lazy"
             onerror="this.style.display='none'" />
        <div class="card-play-overlay">
          <div class="play-btn"><i class="fas fa-play"></i></div>
        </div>
        <div class="card-quality-badge">${canal.calidad}</div>
        <div class="card-live-dot"><span class="dot"></span> EN VIVO</div>
      </div>
      <div class="card-body">
        <div class="card-cat">${canal.categoria}</div>
        <div class="card-name">${canal.nombre}</div>
        <div class="card-desc">${canal.descripcion_corta || canal.descripcion}</div>
      </div>
      <div class="card-footer">
        <div class="card-meta">
          <span><i class="fas fa-calendar-alt"></i> ${canal.año_fundacion || '—'}</span>
          <span><i class="fas fa-map-marker-alt"></i> ${canal.region}</span>
        </div>
        <div style="display:flex;align-items:center;gap:0.5rem;">
          <button class="btn-icon fav-card-btn"
                  data-id="${canal.id}"
                  style="width:32px;height:32px;border-radius:8px;"
                  title="${isFav ? 'Quitar de favoritos' : 'Agregar a favoritos'}">
            <i class="${isFav ? 'fas' : 'far'} fa-heart"
               style="color:${isFav ? 'var(--charcoal)' : 'var(--steel)'}"></i>
          </button>
          <div class="card-rating">
            <i class="fas fa-star"></i> ${canal.rating?.toFixed(1) || '—'}
          </div>
        </div>
      </div>`;

    card.onclick = e => {
      if (e.target.closest('.fav-card-btn')) {
        toggleFavoriteById(canal.id, e.target.closest('.fav-card-btn'));
        return;
      }
      openChannel(canal);
    };

    grid.appendChild(card);
  });
}

// ── PAGINATION ───────────────────────────────────────────────
function renderPagination() {
  const totalPages = Math.ceil(filtered.length / perPage);
  const pg = document.getElementById('pagination');
  pg.innerHTML = '';
  if (totalPages <= 1) return;

  // Prev
  const prev = document.createElement('button');
  prev.className = 'page-btn';
  prev.innerHTML = '<i class="fas fa-chevron-left"></i>';
  prev.disabled  = currentPage === 1;
  prev.onclick   = () => { currentPage--; renderGrid(); renderPagination(); scrollToCanales(); };
  pg.appendChild(prev);

  // Page numbers con elipsis
  for (let i = 1; i <= totalPages; i++) {
    const show = i === 1 || i === totalPages ||
                 Math.abs(i - currentPage) <= 1;
    const isEllipsis = !show && (i === 2 || i === totalPages - 1);

    if (!show && !isEllipsis) continue;
    if (isEllipsis) {
      const dots = document.createElement('span');
      dots.className   = 'page-info';
      dots.textContent = '…';
      pg.appendChild(dots);
      continue;
    }

    const btn = document.createElement('button');
    btn.className  = 'page-btn' + (i === currentPage ? ' active' : '');
    btn.textContent = i;
    btn.onclick    = () => { currentPage = i; renderGrid(); renderPagination(); scrollToCanales(); };
    pg.appendChild(btn);
  }

  // Next
  const next = document.createElement('button');
  next.className = 'page-btn';
  next.innerHTML = '<i class="fas fa-chevron-right"></i>';
  next.disabled  = currentPage === totalPages;
  next.onclick   = () => { currentPage++; renderGrid(); renderPagination(); scrollToCanales(); };
  pg.appendChild(next);

  // Info text
  const info = document.createElement('span');
  info.className   = 'page-info';
  info.innerHTML   = `Página <b>${currentPage}</b> de <b>${totalPages}</b>`;
  pg.appendChild(info);
}

function scrollToCanales() {
  document.getElementById('canales').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── PLAYER MODAL ─────────────────────────────────────────────
let currentSourceIdx = 0; // índice de la fuente activa

function openChannel(canal) {
  currentChannel  = canal;
  currentSourceIdx = 0;

  // Cabecera del modal
  document.getElementById('modal-logo').src = canal.logo;
  document.getElementById('modal-logo').alt = canal.nombre;
  document.getElementById('modal-name').textContent = canal.nombre;
  document.getElementById('modal-desc').textContent = canal.descripcion;

  // Tags
  const tagsEl = document.getElementById('modal-tags');
  tagsEl.innerHTML = (canal.tags || [])
    .map(t => `<span class="tag-pill">#${t}</span>`).join('');

  // Meta pills
  const metaEl = document.getElementById('player-meta');
  metaEl.innerHTML = `
    <div class="meta-pill"><i class="fas fa-tag"></i> ${canal.categoria}</div>
    <div class="meta-pill"><i class="fas fa-broadcast-tower"></i> ${canal.calidad}</div>
    <div class="meta-pill"><i class="fas fa-calendar-alt"></i> Est. ${canal.año_fundacion || '—'}</div>
    <div class="meta-pill"><i class="fas fa-map-marker-alt"></i> ${canal.region}</div>
    <div class="meta-pill"><i class="fas fa-star"></i> ${canal.rating?.toFixed(1) || '—'}</div>`;

  updateFavModalBtn();
  renderSourceSwitcher(canal);
  loadSource(canal, 0);

  // Conteo demo de vistas
  canal.vistas = (canal.vistas || 0) + 1;

  document.getElementById('player-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

// Dibuja los botones de fuente
function renderSourceSwitcher(canal) {
  const fuentes = canal.fuentes || [];
  const container = document.getElementById('source-btns');
  const switcher  = document.getElementById('source-switcher');
  container.innerHTML = '';

  if (fuentes.length === 0) {
    switcher.style.display = 'none';
    return;
  }
  switcher.style.display = 'flex';

  fuentes.forEach((f, idx) => {
    const btn = document.createElement('button');
    const isEmpty = !f.url || f.url.trim() === '';
    btn.className = 'source-btn' +
                    (idx === 0 ? ' active' : '') +
                    (isEmpty   ? ' empty'  : '');
    btn.dataset.idx = idx;
    btn.innerHTML = `
      <i class="fas fa-${f.tipo === 'hls' ? 'broadcast-tower' : 'play-circle'}"></i>
      ${f.label}
      <span class="src-qual">${f.calidad}</span>`;

    if (!isEmpty) {
      btn.title = `Cargar ${f.label} (${f.tipo.toUpperCase()} · ${f.calidad})`;
      btn.onclick = () => switchSource(idx);
    } else {
      btn.title = 'Sin URL configurada';
    }
    container.appendChild(btn);
  });

  // Actualizar hint según disponibilidad
  const hint = document.getElementById('source-hint');
  const disponibles = fuentes.filter(f => f.url && f.url.trim() !== '').length;
  hint.innerHTML = `<i class="fas fa-info-circle"></i> ${disponibles} fuente${disponibles !== 1 ? 's' : ''} disponible${disponibles !== 1 ? 's' : ''}`;
}

// Cambia a otra fuente
function switchSource(idx) {
  if (!currentChannel) return;
  currentSourceIdx = idx;

  // Actualizar botones
  document.querySelectorAll('.source-btn').forEach((b, i) => {
    b.classList.toggle('active', i === idx);
  });

  // Efecto de transición
  const container = document.getElementById('player-container');
  container.classList.add('loading');
  setTimeout(() => container.classList.remove('loading'), 700);

  loadSource(currentChannel, idx);
  showToast(`📡 Cargando ${currentChannel.fuentes[idx].label}…`);
}

// Carga una fuente específica en el iframe
function loadSource(canal, idx) {
  const fuentes  = canal.fuentes || [];
  const iframe   = document.getElementById('player-iframe');
  const noStream = document.getElementById('player-no-stream');
  const oficialLink = document.getElementById('oficial-link');

  // Si no hay fuentes definidas, busca url_embed o url_stream legacy
  if (fuentes.length === 0) {
    const url = canal.url_embed || canal.url_stream || '';
    if (url) {
      const src = canal.url_stream && !canal.url_embed
        ? `https://www.hlsplayer.net/play?url=${encodeURIComponent(url)}`
        : url;
      iframe.src           = src;
      iframe.style.display = 'block';
      noStream.style.display = 'none';
    } else {
      iframe.src           = '';
      iframe.style.display = 'none';
      noStream.style.display = 'flex';
      oficialLink.textContent = `Ver ${canal.nombre} →`;
      oficialLink.href = `https://www.google.com/search?q=${encodeURIComponent(canal.nombre + ' en vivo')}`;
    }
    return;
  }

  const fuente = fuentes[idx];
  if (!fuente || !fuente.url || fuente.url.trim() === '') {
    // Sin URL → intentar siguiente fuente automáticamente
    const nextIdx = fuentes.findIndex((f, i) => i > idx && f.url && f.url.trim() !== '');
    if (nextIdx !== -1) {
      showToast(`⚠️ Fuente ${idx + 1} vacía, cargando Fuente ${nextIdx + 1}…`);
      switchSource(nextIdx);
      return;
    }
    // Ninguna tiene URL
    iframe.src           = '';
    iframe.style.display = 'none';
    noStream.style.display = 'flex';
    oficialLink.textContent = `Ver ${canal.nombre} →`;
    oficialLink.href = `https://www.google.com/search?q=${encodeURIComponent(canal.nombre + ' en vivo')}`;
    return;
  }

  // Construir src según tipo
  let src = fuente.url;
  if (fuente.tipo === 'hls') {
    src = `https://www.hlsplayer.net/play?url=${encodeURIComponent(fuente.url)}`;
  }

  iframe.src           = src;
  iframe.style.display = 'block';
  noStream.style.display = 'none';
}

function closeModal() {
  document.getElementById('player-modal').classList.remove('open');
  document.body.style.overflow = '';
  setTimeout(() => { document.getElementById('player-iframe').src = ''; }, 300);
}

function fullscreenPlayer() {
  const c = document.getElementById('player-container');
  if (c.requestFullscreen)       c.requestFullscreen();
  else if (c.webkitRequestFullscreen) c.webkitRequestFullscreen();
}

// ── FAVORITES ────────────────────────────────────────────────
function toggleFavoriteById(id, btn) {
  const idx = favorites.indexOf(id);
  if (idx === -1) {
    favorites.push(id);
    btn.innerHTML = '<i class="fas fa-heart" style="color:var(--charcoal)"></i>';
    showToast('❤️ Agregado a favoritos');
  } else {
    favorites.splice(idx, 1);
    btn.innerHTML = '<i class="far fa-heart" style="color:var(--steel)"></i>';
    showToast('Removido de favoritos');
  }
  localStorage.setItem('televe_favorites', JSON.stringify(favorites));
}

function toggleFavorite() {
  if (!currentChannel) return;
  const idx = favorites.indexOf(currentChannel.id);
  if (idx === -1) {
    favorites.push(currentChannel.id);
    showToast('❤️ ' + currentChannel.nombre + ' agregado a favoritos');
  } else {
    favorites.splice(idx, 1);
    showToast('Removido de favoritos');
  }
  localStorage.setItem('televe_favorites', JSON.stringify(favorites));
  updateFavModalBtn();
  renderGrid();
}

function updateFavModalBtn() {
  if (!currentChannel) return;
  const isFav = favorites.includes(currentChannel.id);
  const btn   = document.getElementById('fav-modal-btn');
  btn.classList.toggle('active', isFav);
  btn.innerHTML = `<i class="${isFav ? 'fas' : 'far'} fa-heart"></i> ${isFav ? 'Favorito ✓' : 'Favorito'}`;
}

function filterByFavs() {
  if (favorites.length === 0) { showToast('Aún no tienes canales favoritos'); return; }
  filtered    = DATA.canales.filter(c => favorites.includes(c.id));
  currentPage = 1;
  document.getElementById('count-num').textContent = filtered.length;
  renderGrid();
  renderPagination();
  scrollToCanales();
  showToast('❤️ Mostrando tus favoritos');
}

// ── SHARE ────────────────────────────────────────────────────
function copyLink() {
  const url = window.location.href.split('#')[0] + '#' + (currentChannel?.slug || '');
  navigator.clipboard.writeText(url)
    .then(() => showToast('🔗 Enlace copiado al portapapeles'));
}

function openTwitter() {
  if (!currentChannel) return;
  const url = `https://twitter.com/intent/tweet?text=Estoy viendo ${currentChannel.nombre} en vivo en TeleVe Chile 📺&url=${encodeURIComponent(window.location.href)}`;
  window.open(url, '_blank');
}

function openWhatsApp() {
  if (!currentChannel) return;
  const url = `https://wa.me/?text=Mira ${currentChannel.nombre} en vivo en TeleVe Chile 📺 ${encodeURIComponent(window.location.href)}`;
  window.open(url, '_blank');
}

function shareChannel() {
  if (navigator.share && currentChannel) {
    navigator.share({ title: currentChannel.nombre, text: currentChannel.descripcion, url: window.location.href });
  } else {
    copyLink();
  }
}

function reportChannel() {
  showToast('📩 Reporte enviado, gracias por ayudar');
}

// ── TOAST ────────────────────────────────────────────────────
let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  document.getElementById('toast-msg').textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

// ── EVENT LISTENERS ──────────────────────────────────────────
function setupEventListeners() {
  // Búsqueda con debounce
  let searchTimer;
  document.getElementById('search-input').addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(filterAndRender, 220);
  });

  // Selectores de filtro
  ['cat-filter', 'cal-filter', 'sort-filter'].forEach(id => {
    document.getElementById(id).addEventListener('change', filterAndRender);
  });

  // Chips de región
  document.getElementById('chip-region').addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    document.querySelectorAll('#chip-region .chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    filterAndRender();
  });

  // Atajos de teclado
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
    if (e.key === '/' && !['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
      e.preventDefault();
      document.getElementById('search-input').focus();
      document.getElementById('filters').scrollIntoView({ behavior: 'smooth' });
    }
  });

  // Scroll: header, back-to-top y barra de progreso
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        const scroll = window.scrollY;
        document.getElementById('header').classList.toggle('scrolled', scroll > 10);
        document.getElementById('back-top').classList.toggle('visible', scroll > 400);
        const docH = document.documentElement.scrollHeight - window.innerHeight;
        document.getElementById('progress-bar').style.width = (scroll / docH * 100) + '%';
        ticking = false;
      });
      ticking = true;
    }
  });

  // Menú hamburguesa (móvil)
  document.getElementById('hamburger').addEventListener('click', () => {
    document.getElementById('mobile-nav').classList.toggle('open');
  });

  // Favoritos desde el header
  document.getElementById('fav-btn').addEventListener('click', filterByFavs);

  // Backdrop del modal
  document.querySelector('.modal-backdrop')
    .addEventListener('click', closeModal);
}

// ── START ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  // Hint de atajo teclado
  setTimeout(() => showToast('💡 Presiona "/" para buscar rápidamente'), 3200);
});
