import {
  SYSTEMS,
  getSystemById,
  cleanGameTitle,
  formatBytes,
  detectSystemFromFile,
  detectSystemFromFilename,
  getAcceptedExtensionsString
} from './systems.js';
import {
  loadSettings,
  saveSettings,
  listGames,
  getGameWithBlob,
  saveGame,
  updateGameMeta,
  deleteGame,
  clearAllGames,
  getStorageEstimate
} from './db.js';
import { GamepadManager } from './gamepad.js';

const state = {
  view: 'library',
  filter: 'all',
  search: '',
  sort: 'recent',
  localGames: [],
  pcGames: [],
  settings: loadSettings(),
  focusedCardIndex: -1,
  activeGame: null,
  deferredInstallPrompt: null
};

const els = {
  navTabs: document.querySelectorAll('.nav-tab'),
  views: {
    library: document.getElementById('view-library'),
    consoles: document.getElementById('view-consoles'),
    settings: document.getElementById('view-settings'),
    guide: document.getElementById('view-guide')
  },
  fileInput: document.getElementById('rom-file-input'),
  btnAddRoms: document.getElementById('btn-add-roms'),
  btnDropzonePick: document.getElementById('btn-dropzone-pick'),
  btnEmptyAdd: document.getElementById('btn-empty-add'),
  btnEmptyGuide: document.getElementById('btn-empty-guide'),
  btnRefreshPc: document.getElementById('btn-refresh-pc'),
  btnInstallPwa: document.getElementById('btn-install-pwa'),
  importSystemSelect: document.getElementById('import-system-select'),
  searchInput: document.getElementById('search-input'),
  sortSelect: document.getElementById('sort-select'),
  filterChips: document.getElementById('filter-chips'),
  dropzone: document.getElementById('dropzone'),
  gamesGrid: document.getElementById('games-grid'),
  emptyState: document.getElementById('empty-state'),
  consolesGrid: document.getElementById('consoles-grid'),
  gamepadPill: document.getElementById('gamepad-pill'),
  gamepadPillText: document.getElementById('gamepad-pill-text'),
  testerStatus: document.getElementById('tester-status'),
  testerButtons: document.getElementById('tester-buttons'),
  testerAxes: document.getElementById('tester-axes'),
  settingTouchPreset: document.getElementById('setting-touch-preset'),
  settingAutoFullscreen: document.getElementById('setting-auto-fullscreen'),
  settingStartLoaded: document.getElementById('setting-start-loaded'),
  settingCdnChannel: document.getElementById('setting-cdn-channel'),
  storageInfo: document.getElementById('storage-info'),
  btnClearLibrary: document.getElementById('btn-clear-library'),
  lanUrlsBox: document.getElementById('lan-urls-box'),
  playerOverlay: document.getElementById('player-overlay'),
  playerHud: document.getElementById('player-hud'),
  btnShowHud: document.getElementById('btn-show-hud'),
  btnHideHud: document.getElementById('btn-hide-hud'),
  btnExitGame: document.getElementById('btn-exit-game'),
  btnRestartGame: document.getElementById('btn-restart-game'),
  btnFullscreenGame: document.getElementById('btn-fullscreen-game'),
  hudSystemBadge: document.getElementById('hud-system-badge'),
  hudGameTitle: document.getElementById('hud-game-title'),
  playerFrameContainer: document.getElementById('player-frame-container'),
  toast: document.getElementById('toast')
};

let toastTimer = null;
function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.add('hidden'), 3200);
}

function getAllGames() {
  return [...state.localGames, ...state.pcGames];
}

function getFilteredGames() {
  let list = getAllGames();

  if (state.filter === 'favorites') {
    list = list.filter((g) => g.favorite);
  } else if (state.filter !== 'all') {
    list = list.filter((g) => g.systemId === state.filter);
  }

  const q = state.search.trim().toLowerCase();
  if (q) {
    list = list.filter((g) => {
      const sys = getSystemById(g.systemId);
      return (
        g.title.toLowerCase().includes(q) ||
        g.filename.toLowerCase().includes(q) ||
        sys.name.toLowerCase().includes(q) ||
        sys.short.toLowerCase().includes(q)
      );
    });
  }

  list.sort((a, b) => {
    if (state.sort === 'name') return a.title.localeCompare(b.title);
    if (state.sort === 'newest') return (b.addedAt || 0) - (a.addedAt || 0);
    if (state.sort === 'system') {
      return a.systemId.localeCompare(b.systemId) || a.title.localeCompare(b.title);
    }
    // default: recent played first, then newest added
    return (b.lastPlayed || 0) - (a.lastPlayed || 0) || (b.addedAt || 0) - (a.addedAt || 0);
  });

  return list;
}

function switchView(viewName) {
  state.view = viewName;
  els.navTabs.forEach((tab) => {
    const active = tab.dataset.view === viewName;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
  });
  Object.entries(els.views).forEach(([key, el]) => {
    el.classList.toggle('active', key === viewName);
  });

  gamepad.setTesterEnabled(viewName === 'settings');
  if (viewName === 'settings') refreshStorageInfo();
  if (viewName === 'guide') refreshLanInfo();
}

function populateSystemSelects() {
  els.fileInput.accept = getAcceptedExtensionsString();
  els.importSystemSelect.innerHTML = '<option value="auto">Auto-detectar consola</option>';
  SYSTEMS.forEach((sys) => {
    const opt = document.createElement('option');
    opt.value = sys.id;
    opt.textContent = `${sys.icon} ${sys.name}`;
    els.importSystemSelect.appendChild(opt);
  });
}

function renderFilterChips() {
  const all = getAllGames();
  const counts = {};
  let favCount = 0;
  for (const g of all) {
    counts[g.systemId] = (counts[g.systemId] || 0) + 1;
    if (g.favorite) favCount++;
  }

  const chips = [
    { id: 'all', label: 'Todas', icon: '✨', count: all.length },
    { id: 'favorites', label: 'Favoritos', icon: '⭐', count: favCount },
    ...SYSTEMS.map((s) => ({ id: s.id, label: s.short, icon: s.icon, count: counts[s.id] || 0 }))
  ];

  els.filterChips.innerHTML = '';
  chips.forEach((c) => {
    const btn = document.createElement('button');
    btn.className = `chip ${state.filter === c.id ? 'active' : ''}`;
    btn.innerHTML = `<span>${c.icon} ${c.label}</span><span class="chip-count">${c.count}</span>`;
    btn.addEventListener('click', () => {
      state.filter = c.id;
      state.focusedCardIndex = -1;
      renderFilterChips();
      renderGamesGrid();
    });
    els.filterChips.appendChild(btn);
  });
}

function renderGamesGrid() {
  const games = getFilteredGames();
  els.gamesGrid.innerHTML = '';

  if (games.length === 0) {
    els.emptyState.classList.remove('hidden');
    return;
  }
  els.emptyState.classList.add('hidden');

  games.forEach((game, idx) => {
    const sys = getSystemById(game.systemId);
    const card = document.createElement('article');
    card.className = 'game-card';
    card.dataset.index = String(idx);
    card.style.setProperty('--sys-color', sys.color);

    const systemOptions = SYSTEMS.map(
      (s) => `<option value="${s.id}" ${s.id === game.systemId ? 'selected' : ''}>${s.short}</option>`
    ).join('');

    card.innerHTML = `
      <div class="game-cover">
        <div class="game-cover-top">
          <span class="badge">${sys.icon} ${sys.short}</span>
          <span class="source-tag">${game.source === 'pc' ? '💻 PC Wi-Fi' : '📱 En tablet'}</span>
        </div>
        <div class="cover-emoji">${sys.icon}</div>
      </div>
      <div class="game-body">
        <h3 class="game-title" title="${escapeHtml(game.filename)}">${escapeHtml(game.title)}</h3>
        <div class="game-meta">
          <span>${formatBytes(game.size)}</span>
          <select class="game-core-select" aria-label="Cambiar consola del juego">
            ${systemOptions}
          </select>
        </div>
        <div class="game-actions">
          <button class="btn btn-primary btn-play">▶ Jugar</button>
          ${game.source !== 'pc' ? `<button class="icon-btn ${game.favorite ? 'fav-active' : ''}" data-action="fav" title="Favorito">★</button>` : ''}
          ${game.source !== 'pc' ? `<button class="icon-btn" data-action="delete" title="Eliminar de la tablet">🗑</button>` : ''}
        </div>
      </div>
    `;

    card.querySelector('.btn-play').addEventListener('click', () => launchGame(game));

    card.querySelector('.game-core-select').addEventListener('change', async (e) => {
      const nextSys = e.target.value;
      game.systemId = nextSys;
      if (game.source !== 'pc') {
        await updateGameMeta(game.id, { systemId: nextSys });
      }
      renderFilterChips();
      renderGamesGrid();
      showToast(`Consola cambiada a ${getSystemById(nextSys).short}`);
    });

    const favBtn = card.querySelector('[data-action="fav"]');
    if (favBtn) {
      favBtn.addEventListener('click', async () => {
        game.favorite = !game.favorite;
        await updateGameMeta(game.id, { favorite: game.favorite });
        renderFilterChips();
        renderGamesGrid();
      });
    }

    const delBtn = card.querySelector('[data-action="delete"]');
    if (delBtn) {
      delBtn.addEventListener('click', async () => {
        if (!confirm(`¿Eliminar "${game.title}" de la biblioteca local?`)) return;
        await deleteGame(game.id);
        state.localGames = state.localGames.filter((g) => g.id !== game.id);
        renderFilterChips();
        renderGamesGrid();
        showToast('Juego eliminado');
      });
    }

    els.gamesGrid.appendChild(card);
  });

  updateGamepadCardFocus();
}

function renderConsolesGrid() {
  els.consolesGrid.innerHTML = '';
  SYSTEMS.forEach((sys) => {
    const card = document.createElement('article');
    card.className = 'console-card';
    card.style.setProperty('--sys-color', sys.color);

    const extsHtml = sys.extensions.map((ext) => `<span class="ext-pill">${ext}</span>`).join('');
    card.innerHTML = `
      <div class="console-card-head">
        <h3 class="console-name">${sys.icon} ${sys.name}</h3>
        <span class="badge">${sys.year}</span>
      </div>
      <p class="console-examples"><strong>Clásicos:</strong> ${sys.examples}</p>
      <div class="console-exts">${extsHtml}</div>
      <div class="game-actions">
        <button class="btn btn-primary btn-sm" data-import="${sys.id}">+ Cargar para ${sys.short}</button>
        <button class="btn btn-secondary btn-sm" data-filter="${sys.id}">Ver juegos</button>
      </div>
    `;

    card.querySelector('[data-import]').addEventListener('click', () => {
      els.importSystemSelect.value = sys.id;
      els.fileInput.click();
    });

    card.querySelector('[data-filter]').addEventListener('click', () => {
      state.filter = sys.id;
      switchView('library');
      renderFilterChips();
      renderGamesGrid();
    });

    els.consolesGrid.appendChild(card);
  });
}

async function handleImportedFiles(fileList) {
  const files = Array.from(fileList || []);
  if (files.length === 0) return;

  const forcedSystem = els.importSystemSelect.value !== 'auto' ? els.importSystemSelect.value : null;
  let added = 0;

  for (const file of files) {
    try {
      const systemId = forcedSystem || (await detectSystemFromFile(file));
      const meta = await saveGame({
        title: cleanGameTitle(file.name),
        filename: file.name,
        systemId,
        size: file.size,
        blob: file
      });
      state.localGames.unshift({ ...meta, source: 'local' });
      added++;
    } catch (err) {
      console.error('Error guardando ROM:', err);
    }
  }

  if (added > 0) {
    switchView('library');
    renderFilterChips();
    renderGamesGrid();
    showToast(added === 1 ? '¡1 juego agregado a tu biblioteca!' : `¡${added} juegos agregados a tu biblioteca!`);
  } else {
    showToast('No se pudieron importar los archivos.');
  }
}

async function fetchPcRoms(silent = true) {
  try {
    const res = await fetch('./api/roms', { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    const roms = Array.isArray(data.roms) ? data.roms : [];
    state.pcGames = roms.map((r) => ({
      id: `pc_${r.url}`,
      title: cleanGameTitle(r.filename),
      filename: r.filename,
      systemId: detectSystemFromFilename(r.filename, r.folder) || 'snes',
      size: r.size,
      url: r.url,
      favorite: false,
      addedAt: 0,
      lastPlayed: 0,
      source: 'pc'
    }));
    renderFilterChips();
    renderGamesGrid();
    if (!silent) {
      showToast(
        state.pcGames.length > 0
          ? `${state.pcGames.length} ROM(s) encontrados en la PC`
          : 'Carpeta roms/ vacía en la PC'
      );
    }
  } catch {
    if (!silent) showToast('No se detectó servidor PC local (modo offline)');
  }
}

async function refreshLanInfo() {
  try {
    const res = await fetch('./api/health', { cache: 'no-store' });
    if (!res.ok) throw new Error('offline');
    const data = await res.json();
    const ips = data.ips || [];
    const port = data.port || 8080;
    if (ips.length > 0) {
      els.lanUrlsBox.innerHTML = ips.map((ip) => `http://${ip}:${port}`).join('<br>');
    } else {
      els.lanUrlsBox.textContent = window.location.origin;
    }
  } catch {
    els.lanUrlsBox.textContent = window.location.origin;
  }
}

async function refreshStorageInfo() {
  const est = await getStorageEstimate();
  if (!est) {
    els.storageInfo.textContent = `${state.localGames.length} juego(s) guardados localmente.`;
    return;
  }
  els.storageInfo.textContent = `${state.localGames.length} juego(s) en tablet · Usado: ${formatBytes(est.usage)} de ${formatBytes(est.quota)}`;
}

// PLAYER LAUNCH / TEARDOWN
let pendingPlayerMessageHandler = null;

async function launchGame(game) {
  const sys = getSystemById(game.systemId);
  let blob = null;
  let romUrl = null;

  if (game.source === 'pc') {
    romUrl = new URL(game.url, window.location.href).href;
  } else {
    const fullRecord = await getGameWithBlob(game.id);
    if (!fullRecord || !fullRecord.blob) {
      showToast('No se encontró el archivo ROM en la memoria local.');
      return;
    }
    blob = fullRecord.blob;
    await updateGameMeta(game.id, { lastPlayed: Date.now() });
    game.lastPlayed = Date.now();
  }

  state.activeGame = game;
  els.hudSystemBadge.textContent = `${sys.icon} ${sys.short}`;
  els.hudGameTitle.textContent = game.title;
  els.playerOverlay.classList.remove('hidden');
  els.playerHud.classList.remove('hidden');
  els.btnShowHud.classList.add('hidden');
  gamepad.setPaused(true);

  if (state.settings.autoFullscreen && document.documentElement.requestFullscreen) {
    els.playerOverlay.requestFullscreen().catch(() => {});
  }

  mountPlayerIframe({
    core: sys.core,
    title: game.title,
    blob,
    romUrl,
    touchPreset: state.settings.touchPreset,
    cdnChannel: state.settings.cdnChannel,
    startOnLoaded: state.settings.startOnLoaded,
    language: state.settings.language
  });
}

function mountPlayerIframe(payload) {
  teardownPlayerIframe();

  const iframe = document.createElement('iframe');
  iframe.src = './player.html';
  iframe.allow = 'autoplay; fullscreen; gamepad';
  iframe.setAttribute('allowfullscreen', 'true');

  pendingPlayerMessageHandler = (event) => {
    if (event.origin !== window.location.origin) return;
    if (event.source !== iframe.contentWindow) return;
    if (event.data && event.data.type === 'player-ready') {
      iframe.contentWindow.postMessage({ type: 'launch-rom', payload }, window.location.origin);
    }
  };
  window.addEventListener('message', pendingPlayerMessageHandler);
  els.playerFrameContainer.appendChild(iframe);
}

function teardownPlayerIframe() {
  if (pendingPlayerMessageHandler) {
    window.removeEventListener('message', pendingPlayerMessageHandler);
    pendingPlayerMessageHandler = null;
  }
  els.playerFrameContainer.innerHTML = '';
}

function closePlayer() {
  teardownPlayerIframe();
  els.playerOverlay.classList.add('hidden');
  state.activeGame = null;
  gamepad.setPaused(false);
  if (document.fullscreenElement && document.exitFullscreen) {
    document.exitFullscreen().catch(() => {});
  }
  renderGamesGrid();
}

function updateGamepadCardFocus() {
  const cards = els.gamesGrid.querySelectorAll('.game-card');
  cards.forEach((c, idx) => {
    const focused = idx === state.focusedCardIndex;
    c.classList.toggle('gamepad-focused', focused);
    if (focused) c.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
}

// GAMEPAD MANAGER
const VIEW_ORDER = ['library', 'consoles', 'settings', 'guide'];
const gamepad = new GamepadManager({
  onStatusChange: (names) => {
    if (names.length > 0) {
      els.gamepadPill.classList.add('pill-connected');
      els.gamepadPillText.textContent = `Mando: ${names[0].slice(0, 22)}`;
      showToast(`Mando conectado: ${names[0]}`);
    } else {
      els.gamepadPill.classList.remove('pill-connected');
      els.gamepadPillText.textContent = 'Sin mando BT';
    }
  },
  onAction: (action) => {
    if (action === 'nextTab' || action === 'prevTab') {
      const idx = VIEW_ORDER.indexOf(state.view);
      const next = (idx + (action === 'nextTab' ? 1 : -1) + VIEW_ORDER.length) % VIEW_ORDER.length;
      switchView(VIEW_ORDER[next]);
      return;
    }

    if (state.view !== 'library') return;
    const games = getFilteredGames();
    if (games.length === 0) return;

    if (action === 'right' || action === 'down') {
      state.focusedCardIndex = (state.focusedCardIndex + 1) % games.length;
      updateGamepadCardFocus();
    } else if (action === 'left' || action === 'up') {
      state.focusedCardIndex = (state.focusedCardIndex - 1 + games.length) % games.length;
      updateGamepadCardFocus();
    } else if (action === 'confirm' && state.focusedCardIndex >= 0) {
      launchGame(games[state.focusedCardIndex]);
    }
  },
  onTesterUpdate: (info) => {
    if (!info) {
      els.testerStatus.textContent = 'Esperando mando... Conecta tu control Bluetooth y pulsa un botón.';
      els.testerButtons.innerHTML = '';
      els.testerAxes.textContent = '';
      return;
    }
    els.testerStatus.textContent = `Conectado: ${info.name}`;
    els.testerButtons.innerHTML = info.activeButtons.length
      ? info.activeButtons.map((b) => `<span class="btn-tag">${escapeHtml(b)}</span>`).join('')
      : '<span class="muted">Ningún botón presionado</span>';
    els.testerAxes.textContent = `Sticks: [${info.axes.join(', ')}]`;
  }
});

function escapeHtml(str = '') {
  return str.replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}

function bindEvents() {
  els.navTabs.forEach((tab) => {
    tab.addEventListener('click', () => switchView(tab.dataset.view));
  });

  els.gamepadPill.addEventListener('click', () => switchView('settings'));

  const triggerPick = () => els.fileInput.click();
  els.btnAddRoms.addEventListener('click', triggerPick);
  els.btnDropzonePick.addEventListener('click', triggerPick);
  els.btnEmptyAdd.addEventListener('click', triggerPick);
  els.btnEmptyGuide.addEventListener('click', () => switchView('guide'));
  els.btnRefreshPc.addEventListener('click', () => fetchPcRoms(false));

  els.fileInput.addEventListener('change', async (e) => {
    await handleImportedFiles(e.target.files);
    e.target.value = '';
  });

  // Drag & Drop anywhere on dropzone
  ['dragenter', 'dragover'].forEach((evt) => {
    els.dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      els.dropzone.classList.add('dragover');
    });
  });
  ['dragleave', 'drop'].forEach((evt) => {
    els.dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      els.dropzone.classList.remove('dragover');
    });
  });
  els.dropzone.addEventListener('drop', (e) => {
    handleImportedFiles(e.dataTransfer.files);
  });

  els.searchInput.addEventListener('input', (e) => {
    state.search = e.target.value;
    state.focusedCardIndex = -1;
    renderGamesGrid();
  });

  els.sortSelect.addEventListener('change', (e) => {
    state.sort = e.target.value;
    renderGamesGrid();
  });

  // Settings bindings
  els.settingTouchPreset.value = state.settings.touchPreset;
  els.settingAutoFullscreen.checked = state.settings.autoFullscreen;
  els.settingStartLoaded.checked = state.settings.startOnLoaded;
  els.settingCdnChannel.value = state.settings.cdnChannel;

  els.settingTouchPreset.addEventListener('change', (e) => {
    state.settings = saveSettings({ touchPreset: e.target.value });
    showToast('Diseño de controles táctiles guardado');
  });
  els.settingAutoFullscreen.addEventListener('change', (e) => {
    state.settings = saveSettings({ autoFullscreen: e.target.checked });
  });
  els.settingStartLoaded.addEventListener('change', (e) => {
    state.settings = saveSettings({ startOnLoaded: e.target.checked });
  });
  els.settingCdnChannel.addEventListener('change', (e) => {
    state.settings = saveSettings({ cdnChannel: e.target.value });
    showToast(`Canal cambiado a ${e.target.value}`);
  });

  els.btnClearLibrary.addEventListener('click', async () => {
    if (!confirm('¿Seguro que quieres borrar todos los juegos guardados en esta tablet?')) return;
    await clearAllGames();
    state.localGames = [];
    renderFilterChips();
    renderGamesGrid();
    refreshStorageInfo();
    showToast('Biblioteca local vaciada');
  });

  // Player HUD
  els.btnExitGame.addEventListener('click', closePlayer);
  els.btnRestartGame.addEventListener('click', () => {
    if (state.activeGame) launchGame(state.activeGame);
  });
  els.btnFullscreenGame.addEventListener('click', () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else if (els.playerOverlay.requestFullscreen) {
      els.playerOverlay.requestFullscreen().catch(() => {});
    }
  });
  els.btnHideHud.addEventListener('click', () => {
    els.playerHud.classList.add('hidden');
    els.btnShowHud.classList.remove('hidden');
  });
  els.btnShowHud.addEventListener('click', () => {
    els.playerHud.classList.remove('hidden');
    els.btnShowHud.classList.add('hidden');
  });

  // PWA Install Prompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    state.deferredInstallPrompt = e;
    els.btnInstallPwa.classList.remove('hidden');
  });
  els.btnInstallPwa.addEventListener('click', async () => {
    if (!state.deferredInstallPrompt) return;
    state.deferredInstallPrompt.prompt();
    await state.deferredInstallPrompt.userChoice;
    state.deferredInstallPrompt = null;
    els.btnInstallPwa.classList.add('hidden');
  });
}

async function init() {
  populateSystemSelects();
  renderConsolesGrid();
  bindEvents();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  try {
    const saved = await listGames();
    state.localGames = saved.map((g) => ({ ...g, source: 'local' }));
  } catch (err) {
    console.error('Error abriendo IndexedDB:', err);
  }

  renderFilterChips();
  renderGamesGrid();
  fetchPcRoms(true);
  gamepad.start();
}

init();
