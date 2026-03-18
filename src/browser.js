'use strict';
/* ═══════════════════════════ NETBYTE BROWSER — RENDERER ══════════════════ */

// ─── State ─────────────────────────────────────────────────────────────────
let tabs       = [];
let activeTabId = null;
let prefs      = {};
let bookmarks  = JSON.parse(localStorage.getItem('nb_bookmarks') || '[]');

// ─── DOM refs ──────────────────────────────────────────────────────────────
const tabList         = document.getElementById('tabList');
const webviewContainer= document.getElementById('webviewContainer');
const addressBar      = document.getElementById('addressBar');
const homePage        = document.getElementById('homePage');
const homeSearch      = document.getElementById('homeSearch');
const progressBar     = document.getElementById('progressBar');
const statusBar       = document.getElementById('statusBar');
const adblockCount    = document.getElementById('adblockCount');
const adblockBadge    = document.getElementById('adblockBadge');
const lockIcon        = document.getElementById('lockIcon');
const securityIcon    = document.getElementById('securityIcon');
const settingsPanel   = document.getElementById('settingsPanel');
const bookmarksPanel  = document.getElementById('bookmarksPanel');
const overlay         = document.getElementById('overlay');
const homeBlockedCount= document.getElementById('homeBlockedCount');
const homeTabCount    = document.getElementById('homeTabCount');

// ─── Helpers ───────────────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2); }

function urlNormalize(input) {
  input = input.trim();
  if (!input) return prefs.homepage || 'https://duckduckgo.com';

  // Looks like URL?
  if (/^(https?|file|ftp):\/\//i.test(input)) return input;
  if (/^localhost(:\d+)?(\/|$)/.test(input)) return 'http://' + input;
  if (/^192\.168\.|^10\.|^172\.(1[6-9]|2\d|3[01])\./.test(input)) return 'http://' + input;

  // Has a dot + no spaces? Treat as URL
  if (input.includes('.') && !input.includes(' ') && !input.startsWith('http')) {
    return 'https://' + input;
  }

  // Otherwise: search
  const engine = prefs.searchEngine || 'https://duckduckgo.com/?q=';
  return engine + encodeURIComponent(input);
}

function domainFromUrl(url) {
  try { return new URL(url).hostname; }
  catch { return url; }
}

function faviconUrl(url) {
  try {
    const { protocol, hostname } = new URL(url);
    if (protocol === 'file:' || protocol === 'data:') return null;
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
  } catch { return null; }
}

function setProgress(pct) {
  progressBar.style.width = pct + '%';
  if (pct >= 100 || pct <= 0) {
    progressBar.classList.remove('loading');
    setTimeout(() => { progressBar.style.width = '0%'; }, 300);
  } else {
    progressBar.classList.add('loading');
  }
}

// ─── Tab Management ────────────────────────────────────────────────────────
function createTab(url, activate = true, isPrivate = false) {
  const id = uid();
  const tab = { id, url: url || '', title: 'New Tab', loading: false, isPrivate, favicon: null };
  tabs.push(tab);

  // Webview
  const wv = document.createElement('webview');
  wv.id = 'wv-' + id;
  wv.setAttribute('partition', isPrivate ? 'private-' + id : 'persist:default');
  wv.setAttribute('allowpopups', '');
  wv.setAttribute('webpreferences', 'contextIsolation=true, javascript=yes');
  wv.setAttribute('useragent', '');

  if (url && url !== 'about:newtab') {
    wv.setAttribute('src', urlNormalize(url));
  }

  webviewContainer.appendChild(wv);
  attachWebviewEvents(wv, id);

  renderTabBar();
  if (activate) switchTab(id);
  updateHomeStats();
  return id;
}

function closeTab(id) {
  const idx = tabs.findIndex(t => t.id === id);
  if (idx === -1) return;

  // Remove webview
  const wv = document.getElementById('wv-' + id);
  if (wv) wv.remove();

  tabs.splice(idx, 1);

  if (tabs.length === 0) {
    createTab('about:newtab');
    return;
  }

  if (activeTabId === id) {
    const newIdx = Math.max(0, idx - 1);
    switchTab(tabs[newIdx].id);
  }

  renderTabBar();
  updateHomeStats();
}

function switchTab(id) {
  activeTabId = id;

  // Show/hide webviews
  document.querySelectorAll('webview').forEach(wv => wv.classList.remove('active'));
  const wv = document.getElementById('wv-' + id);
  if (wv) wv.classList.add('active');

  const tab = tabs.find(t => t.id === id);
  if (!tab) return;

  // Address bar
  addressBar.value = tab.url === 'about:newtab' ? '' : tab.url;

  // Home page visibility
  if (tab.url === 'about:newtab' || !tab.url) {
    homePage.classList.remove('hidden');
    wv && (wv.style.display = 'none');
  } else {
    homePage.classList.add('hidden');
    wv && (wv.style.display = '');
  }

  updateNavButtons();
  renderTabBar();
  updateSecurityIcon(tab.url);
}

function renderTabBar() {
  tabList.innerHTML = '';
  tabs.forEach(tab => {
    const el = document.createElement('div');
    el.className = 'tab' + (tab.id === activeTabId ? ' active' : '');
    el.dataset.id = tab.id;

    // Loading indicator or favicon
    if (tab.loading) {
      const spinner = document.createElement('div');
      spinner.className = 'tab-loading';
      el.appendChild(spinner);
    } else if (tab.favicon) {
      const img = document.createElement('img');
      img.className = 'tab-favicon';
      img.src = tab.favicon;
      img.onerror = () => img.remove();
      el.appendChild(img);
    } else {
      const ph = document.createElement('div');
      ph.className = 'tab-favicon-placeholder';
      ph.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`;
      el.appendChild(ph);
    }

    const title = document.createElement('span');
    title.className = 'tab-title';
    title.textContent = tab.title || 'New Tab';
    el.appendChild(title);

    if (tab.isPrivate) {
      const badge = document.createElement('span');
      badge.className = 'tab-private-badge';
      badge.textContent = '🕵';
      el.appendChild(badge);
    }

    const closeBtn = document.createElement('button');
    closeBtn.className = 'tab-close';
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', e => { e.stopPropagation(); closeTab(tab.id); });
    el.appendChild(closeBtn);

    el.addEventListener('click', () => switchTab(tab.id));
    tabList.appendChild(el);
  });
}

// ─── Webview Events ────────────────────────────────────────────────────────
function attachWebviewEvents(wv, id) {
  const tab = () => tabs.find(t => t.id === id);

  wv.addEventListener('did-start-loading', () => {
    const t = tab(); if (!t) return;
    t.loading = true;
    if (id === activeTabId) setProgress(30);
    renderTabBar();
  });

  wv.addEventListener('did-stop-loading', () => {
    const t = tab(); if (!t) return;
    t.loading = false;
    if (id === activeTabId) setProgress(100);
    renderTabBar();
  });

  wv.addEventListener('did-navigate', e => {
    const t = tab(); if (!t) return;
    t.url = e.url;
    if (id === activeTabId) {
      addressBar.value = e.url;
      updateNavButtons();
      updateSecurityIcon(e.url);
    }
    if (id === activeTabId) setProgress(70);
  });

  wv.addEventListener('did-navigate-in-page', e => {
    const t = tab(); if (!t) return;
    t.url = e.url;
    if (id === activeTabId) {
      addressBar.value = e.url;
      updateSecurityIcon(e.url);
    }
  });

  wv.addEventListener('page-title-updated', e => {
    const t = tab(); if (!t) return;
    t.title = e.title || domainFromUrl(t.url);
    renderTabBar();
    if (id === activeTabId) document.title = `${t.title} — NetByte`;
  });

  wv.addEventListener('page-favicon-updated', e => {
    const t = tab(); if (!t) return;
    if (e.favicons && e.favicons.length > 0) {
      t.favicon = e.favicons[0];
      renderTabBar();
    }
  });

  wv.addEventListener('new-window', e => {
    createTab(e.url, true);
  });

  wv.addEventListener('update-target-url', e => {
    if (e.url) {
      statusBar.textContent = e.url;
      statusBar.classList.remove('hidden');
    } else {
      statusBar.classList.add('hidden');
    }
  });

  wv.addEventListener('did-fail-load', e => {
    const t = tab(); if (!t) return;
    t.loading = false;
    if (id === activeTabId) setProgress(0);
    renderTabBar();
  });
}

// ─── Navigation ────────────────────────────────────────────────────────────
function navigate(url) {
  const normalized = urlNormalize(url);
  const tab = tabs.find(t => t.id === activeTabId);
  if (!tab) return;

  tab.url = normalized;
  const wv = document.getElementById('wv-' + activeTabId);

  if (normalized === 'about:newtab' || !normalized) {
    homePage.classList.remove('hidden');
    if (wv) wv.setAttribute('src', 'about:blank');
    addressBar.value = '';
    return;
  }

  homePage.classList.add('hidden');
  if (wv) {
    wv.setAttribute('src', normalized);
    wv.style.display = '';
  }

  addressBar.value = normalized;
  updateSecurityIcon(normalized);
}

function updateNavButtons() {
  const wv = document.getElementById('wv-' + activeTabId);
  const back    = document.getElementById('btnBack');
  const forward = document.getElementById('btnForward');
  if (wv) {
    back.disabled    = !wv.canGoBack();
    forward.disabled = !wv.canGoForward();
  } else {
    back.disabled = forward.disabled = true;
  }
}

function updateSecurityIcon(url) {
  const icon = document.getElementById('securityIcon');
  if (!url || url.startsWith('about:') || url.startsWith('file:')) {
    icon.className = 'security-icon';
    return;
  }
  if (url.startsWith('https://')) {
    icon.className = 'security-icon';
    icon.title = 'Secure connection (HTTPS)';
  } else {
    icon.className = 'security-icon insecure';
    icon.title = 'Insecure connection (HTTP)';
  }
}

// ─── Address Bar ───────────────────────────────────────────────────────────
addressBar.addEventListener('keydown', e => {
  if (e.key === 'Enter') { navigate(addressBar.value); addressBar.blur(); }
  if (e.key === 'Escape') {
    const tab = tabs.find(t => t.id === activeTabId);
    addressBar.value = tab ? (tab.url === 'about:newtab' ? '' : tab.url) : '';
    addressBar.blur();
  }
});

addressBar.addEventListener('focus', () => {
  addressBar.select();
});

// ─── Home Search ────────────────────────────────────────────────────────────
homeSearch.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    navigate(homeSearch.value);
    homeSearch.value = '';
  }
});

// ─── Shortcuts ─────────────────────────────────────────────────────────────
document.querySelectorAll('.shortcut').forEach(el => {
  el.addEventListener('click', e => {
    e.preventDefault();
    navigate(el.dataset.url);
  });
});

// ─── Toolbar Buttons ───────────────────────────────────────────────────────
document.getElementById('btnBack').addEventListener('click', () => {
  const wv = document.getElementById('wv-' + activeTabId);
  if (wv && wv.canGoBack()) wv.goBack();
});

document.getElementById('btnForward').addEventListener('click', () => {
  const wv = document.getElementById('wv-' + activeTabId);
  if (wv && wv.canGoForward()) wv.goForward();
});

document.getElementById('btnRefresh').addEventListener('click', () => {
  const wv = document.getElementById('wv-' + activeTabId);
  if (wv) { wv.reload(); setProgress(10); }
});

document.getElementById('btnHome').addEventListener('click', () => {
  navigate('about:newtab');
});

document.getElementById('btnNewTab').addEventListener('click', () => {
  createTab('about:newtab');
});

document.getElementById('btnPrivate').addEventListener('click', () => {
  createTab('https://duckduckgo.com', true, true);
});

// ─── Settings Panel ─────────────────────────────────────────────────────────
document.getElementById('btnSettings').addEventListener('click', async () => {
  await openSettings();
});

document.getElementById('closeSettings').addEventListener('click', closePanel);
document.getElementById('closeBookmarks').addEventListener('click', closePanel);
overlay.addEventListener('click', closePanel);

function openPanel(panel) {
  settingsPanel.classList.add('hidden');
  bookmarksPanel.classList.add('hidden');
  panel.classList.remove('hidden');
  overlay.classList.remove('hidden');
}

function closePanel() {
  settingsPanel.classList.add('hidden');
  bookmarksPanel.classList.add('hidden');
  overlay.classList.add('hidden');
}

async function openSettings() {
  // Populate settings
  document.getElementById('settingAdblock').checked  = prefs.adblockEnabled;
  document.getElementById('settingHttps').checked    = prefs.httpsOnly;
  document.getElementById('settingDNT').checked      = prefs.doNotTrack;
  document.getElementById('settingReferrer').checked = prefs.blockThirdParty;
  document.getElementById('settingSpoofUA').checked  = prefs.spoofUserAgent;
  document.getElementById('settingCustomUA').value   = prefs.customUA || '';
  document.getElementById('settingSearch').value     = prefs.searchEngine || 'https://duckduckgo.com/?q=';
  document.getElementById('settingHomepage').value   = prefs.homepage || 'https://duckduckgo.com';

  document.getElementById('customUARow').style.display = prefs.spoofUserAgent ? '' : 'none';

  // Blocked count
  const count = await window.netbyte.getBlockedCount();
  document.getElementById('settingBlockedCount').textContent = count.toLocaleString();

  // Versions
  const ver = await window.netbyte.getVersion();
  document.getElementById('aboutApp').textContent      = ver.app;
  document.getElementById('aboutElectron').textContent = ver.electron;
  document.getElementById('aboutChrome').textContent   = ver.chrome;
  document.getElementById('aboutNode').textContent     = ver.node;

  // Extensions
  await refreshExtList();

  openPanel(settingsPanel);
}

document.getElementById('settingSpoofUA').addEventListener('change', e => {
  document.getElementById('customUARow').style.display = e.target.checked ? '' : 'none';
});

document.getElementById('btnSaveSettings').addEventListener('click', async () => {
  const updated = {
    adblockEnabled:  document.getElementById('settingAdblock').checked,
    httpsOnly:       document.getElementById('settingHttps').checked,
    doNotTrack:      document.getElementById('settingDNT').checked,
    blockThirdParty: document.getElementById('settingReferrer').checked,
    spoofUserAgent:  document.getElementById('settingSpoofUA').checked,
    customUA:        document.getElementById('settingCustomUA').value,
    searchEngine:    document.getElementById('settingSearch').value,
    homepage:        document.getElementById('settingHomepage').value,
  };
  prefs = await window.netbyte.savePrefs(updated);

  // Update badge
  adblockBadge.classList.toggle('disabled', !prefs.adblockEnabled);

  closePanel();
});

document.getElementById('btnResetStats').addEventListener('click', async () => {
  await window.netbyte.resetBlockedCount();
  document.getElementById('settingBlockedCount').textContent = '0';
  adblockCount.textContent  = '0';
  homeBlockedCount.textContent = '0';
});

document.getElementById('btnOpenExtDir').addEventListener('click', () => {
  window.netbyte.openExtensionDir();
});

document.getElementById('btnReloadExts').addEventListener('click', async () => {
  const result = await window.netbyte.reloadExtensions();
  if (result.success) await refreshExtList();
  else alert('Failed to reload extensions: ' + result.error);
});

async function refreshExtList() {
  const exts = await window.netbyte.listExtensions();
  const el   = document.getElementById('extList');
  if (!exts.length) {
    el.innerHTML = '<div class="ext-empty">No extensions loaded. Drop extension folders into the extensions directory.</div>';
    return;
  }
  el.innerHTML = exts.map(ext => `
    <div class="ext-item">
      <div class="ext-item-name">${ext.name}</div>
      <div class="ext-item-ver">v${ext.version}</div>
    </div>
  `).join('');
}

// ─── Bookmarks ──────────────────────────────────────────────────────────────
document.getElementById('btnBookmark').addEventListener('click', () => {
  const tab = tabs.find(t => t.id === activeTabId);
  const isBookmarked = tab && bookmarks.find(b => b.url === tab.url);

  if (isBookmarked) {
    openBookmarksPanel();
  } else {
    addBookmark();
  }
});

function addBookmark() {
  const tab = tabs.find(t => t.id === activeTabId);
  if (!tab || !tab.url || tab.url === 'about:newtab') return;

  const exists = bookmarks.find(b => b.url === tab.url);
  if (exists) return;

  bookmarks.push({ url: tab.url, title: tab.title || domainFromUrl(tab.url), favicon: tab.favicon || '' });
  localStorage.setItem('nb_bookmarks', JSON.stringify(bookmarks));

  // Flash bookmark icon
  const btn = document.getElementById('btnBookmark');
  btn.style.color = 'var(--accent)';
  setTimeout(() => btn.style.color = '', 800);
}

function openBookmarksPanel() {
  renderBookmarks();
  openPanel(bookmarksPanel);
}

function renderBookmarks() {
  const list = document.getElementById('bookmarkList');
  if (!bookmarks.length) {
    list.innerHTML = '<div class="ext-empty">No bookmarks yet. Navigate to a page and click the bookmark icon.</div>';
    return;
  }
  list.innerHTML = bookmarks.map((bm, i) => `
    <div class="bookmark-item" data-idx="${i}">
      ${bm.favicon ? `<img class="bookmark-favicon" src="${bm.favicon}" onerror="this.remove()" />` : ''}
      <div class="bookmark-text">
        <div class="bookmark-title">${bm.title}</div>
        <div class="bookmark-url">${bm.url}</div>
      </div>
      <button class="bookmark-del" data-idx="${i}">✕</button>
    </div>
  `).join('');

  list.querySelectorAll('.bookmark-item').forEach(el => {
    el.addEventListener('click', e => {
      if (e.target.classList.contains('bookmark-del')) return;
      navigate(bookmarks[+el.dataset.idx].url);
      closePanel();
    });
  });
  list.querySelectorAll('.bookmark-del').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      bookmarks.splice(+btn.dataset.idx, 1);
      localStorage.setItem('nb_bookmarks', JSON.stringify(bookmarks));
      renderBookmarks();
    });
  });
}

document.getElementById('btnAddBookmark').addEventListener('click', () => {
  addBookmark();
  closePanel();
});

// ─── Window controls ────────────────────────────────────────────────────────
document.getElementById('btnMin').addEventListener('click',   () => window.netbyte.minimize());
document.getElementById('btnMax').addEventListener('click',   () => window.netbyte.maximize());
document.getElementById('btnClose').addEventListener('click', () => window.netbyte.close());

// macOS: hide windows controls
if (window.netbyte.platform === 'darwin') {
  document.body.classList.add('platform-mac');
}

// ─── Keyboard Shortcuts ──────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  const ctrl = e.ctrlKey || e.metaKey;

  if (ctrl && e.key === 't')  { e.preventDefault(); createTab('about:newtab'); }
  if (ctrl && e.key === 'w')  { e.preventDefault(); closeTab(activeTabId); }
  if (ctrl && e.key === 'r')  { e.preventDefault(); const wv = document.getElementById('wv-' + activeTabId); if (wv) wv.reload(); }
  if (ctrl && e.key === 'l')  { e.preventDefault(); addressBar.focus(); addressBar.select(); }
  if (ctrl && e.key === 'd')  { e.preventDefault(); addBookmark(); }

  // Ctrl+1..9 — switch tabs
  if (ctrl && e.key >= '1' && e.key <= '9') {
    const idx = parseInt(e.key) - 1;
    if (tabs[idx]) switchTab(tabs[idx].id);
  }

  // F5 — refresh
  if (e.key === 'F5') {
    const wv = document.getElementById('wv-' + activeTabId);
    if (wv) wv.reload();
  }

  // Alt+Left / Alt+Right — back / forward
  if (e.altKey && e.key === 'ArrowLeft') {
    const wv = document.getElementById('wv-' + activeTabId);
    if (wv && wv.canGoBack()) wv.goBack();
  }
  if (e.altKey && e.key === 'ArrowRight') {
    const wv = document.getElementById('wv-' + activeTabId);
    if (wv && wv.canGoForward()) wv.goForward();
  }
});

// ─── Ad block live counter ───────────────────────────────────────────────────
window.netbyte.onBlockedCount(count => {
  adblockCount.textContent  = count.toLocaleString();
  homeBlockedCount.textContent = count.toLocaleString();
});

// ─── Home stats ──────────────────────────────────────────────────────────────
function updateHomeStats() {
  homeTabCount.textContent = tabs.length;
}

// ─── Init ────────────────────────────────────────────────────────────────────
async function init() {
  prefs = await window.netbyte.getPrefs();

  // Badge state
  adblockBadge.classList.toggle('disabled', !prefs.adblockEnabled);

  // Initial blocked count
  const count = await window.netbyte.getBlockedCount();
  adblockCount.textContent     = count.toLocaleString();
  homeBlockedCount.textContent = count.toLocaleString();

  // First tab
  createTab('about:newtab');
}

init();
