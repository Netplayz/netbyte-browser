'use strict';

const {
  app,
  BrowserWindow,
  BrowserView,
  ipcMain,
  session,
  Menu,
  dialog,
  shell,
  nativeTheme,
  protocol,
} = require('electron');

const path = require('path');
const fs   = require('fs');

// ─── Paths ────────────────────────────────────────────────────────────────────
const USER_DATA   = app.getPath('userData');
const EXT_DIR     = path.join(USER_DATA, 'extensions');
const PREFS_FILE  = path.join(USER_DATA, 'preferences.json');

if (!fs.existsSync(EXT_DIR)) fs.mkdirSync(EXT_DIR, { recursive: true });

// ─── Default Preferences ──────────────────────────────────────────────────────
const DEFAULT_PREFS = {
  homepage:        'https://duckduckgo.com',
  searchEngine:    'https://duckduckgo.com/?q=',
  adblockEnabled:  true,
  httpsOnly:       true,
  doNotTrack:      true,
  blockThirdParty: true,
  privateBrowsing: false,
  spoofUserAgent:  false,
  customUA:        '',
  blockedCount:    0,
};

function loadPrefs() {
  try { return { ...DEFAULT_PREFS, ...JSON.parse(fs.readFileSync(PREFS_FILE, 'utf8')) }; }
  catch { return { ...DEFAULT_PREFS }; }
}

function savePrefs(p) {
  fs.writeFileSync(PREFS_FILE, JSON.stringify(p, null, 2));
}

let prefs = loadPrefs();

// ─── Ad-blocker state ─────────────────────────────────────────────────────────
let ElectronBlocker = null;
let blocker         = null;
let blockedCount    = prefs.blockedCount || 0;

async function initAdBlocker(ses) {
  try {
    const mod = require('@cliqz/adblocker-electron');
    ElectronBlocker = mod.ElectronBlocker;

    const cacheFile = path.join(USER_DATA, 'adblocker-cache.bin');
    if (fs.existsSync(cacheFile)) {
      try {
        const buf = fs.readFileSync(cacheFile);
        blocker = ElectronBlocker.deserialize(buf);
        console.log('[AdBlock] Loaded from cache.');
      } catch { blocker = null; }
    }

    if (!blocker) {
      console.log('[AdBlock] Downloading filter lists…');
      blocker = await ElectronBlocker.fromPrebuiltAdsAndTracking(fetch);
      fs.writeFileSync(cacheFile, blocker.serialize());
      console.log('[AdBlock] Filter lists downloaded and cached.');
    }

    if (prefs.adblockEnabled) enableBlocker(ses);
  } catch (e) {
    console.warn('[AdBlock] @cliqz/adblocker-electron not available, using fallback.', e.message);
    enableFallbackBlocker(ses);
  }
}

function enableBlocker(ses) {
  if (!blocker) return;
  blocker.enableBlockingInSession(ses);

  // Intercept to count blocks
  ses.webRequest.onBeforeRequest((details, cb) => {
    blockedCount++;
    prefs.blockedCount = blockedCount;
    mainWindow?.webContents.send('blocked-count', blockedCount);
    cb({ cancel: true });
  });
}

// Fallback: block known ad/tracker domains via request filter
const FALLBACK_BLOCK_HOSTS = [
  'doubleclick.net','googlesyndication.com','googleadservices.com',
  'adnxs.com','adsystem.amazon.com','scorecardresearch.com',
  'quantserve.com','outbrain.com','taboola.com','criteo.com',
  'hotjar.com','intercomcdn.com','moatads.com','advertising.com',
  'ads.yahoo.com','adsafeprotected.com','rubiconproject.com',
  'pubmatic.com','openx.net','casalemedia.com','smartadserver.com',
  'facebook.com/tr','connect.facebook.net','pixel.facebook.com',
  'bat.bing.com','analytics.google.com','google-analytics.com',
  'googletagmanager.com','amplitude.com','mixpanel.com','segment.com',
  'cdn.jsdelivr.net/npm/plausible','static.ads-twitter.com',
];

function enableFallbackBlocker(ses) {
  ses.webRequest.onBeforeRequest(
    { urls: ['http://*/*', 'https://*/*'] },
    (details, cb) => {
      if (!prefs.adblockEnabled) return cb({ cancel: false });
      const url = details.url;
      const shouldBlock = FALLBACK_BLOCK_HOSTS.some(h => url.includes(h));
      if (shouldBlock) {
        blockedCount++;
        prefs.blockedCount = blockedCount;
        mainWindow?.webContents.send('blocked-count', blockedCount);
        cb({ cancel: true });
      } else {
        cb({ cancel: false });
      }
    }
  );
}

// ─── Privacy Headers ──────────────────────────────────────────────────────────
function applyPrivacyHeaders(ses) {
  ses.webRequest.onBeforeSendHeaders((details, cb) => {
    const headers = { ...details.requestHeaders };

    if (prefs.doNotTrack) {
      headers['DNT'] = '1';
      headers['Sec-GPC'] = '1'; // Global Privacy Control
    }

    // Strip referrer on cross-origin
    if (prefs.blockThirdParty) {
      headers['Referer'] = '';
    }

    if (prefs.spoofUserAgent && prefs.customUA) {
      headers['User-Agent'] = prefs.customUA;
    }

    cb({ requestHeaders: headers });
  });

  // Strip tracking headers in responses
  ses.webRequest.onHeadersReceived((details, cb) => {
    const headers = { ...details.responseHeaders };
    // Remove fingerprinting headers
    delete headers['server'];
    delete headers['x-powered-by'];
    cb({ responseHeaders: headers });
  });
}

// ─── Load Extensions ──────────────────────────────────────────────────────────
async function loadExtensions(ses) {
  const dirs = fs.readdirSync(EXT_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => path.join(EXT_DIR, d.name));

  for (const extPath of dirs) {
    try {
      await ses.loadExtension(extPath, { allowFileAccess: true });
      console.log('[Extensions] Loaded:', extPath);
    } catch (e) {
      console.warn('[Extensions] Failed to load:', extPath, e.message);
    }
  }
}

// ─── Create Session ───────────────────────────────────────────────────────────
function createSession(isPrivate = false) {
  const ses = isPrivate
    ? session.fromPartition('private-' + Date.now(), { cache: false })
    : session.defaultSession;

  // HTTPS upgrade
  if (prefs.httpsOnly) {
    ses.webRequest.onBeforeRequest(
      { urls: ['http://*/*'] },
      (details, cb) => {
        if (!details.url.startsWith('http://localhost') &&
            !details.url.startsWith('http://127.') &&
            !details.url.startsWith('http://192.168.')) {
          cb({ redirectURL: details.url.replace('http://', 'https://') });
        } else {
          cb({});
        }
      }
    );
  }

  applyPrivacyHeaders(ses);
  initAdBlocker(ses);
  if (!isPrivate) loadExtensions(ses);

  return ses;
}

// ─── Main Window ──────────────────────────────────────────────────────────────
let mainWindow = null;

function createWindow() {
  nativeTheme.themeSource = 'dark';

  mainWindow = new BrowserWindow({
    width:  1280,
    height: 820,
    minWidth:  800,
    minHeight: 500,
    backgroundColor: '#0a0a0f',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    frame: false,
    webPreferences: {
      preload:           path.join(__dirname, 'preload.js'),
      contextIsolation:  true,
      nodeIntegration:   false,
      webviewTag:        true,
      spellcheck:        true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'browser.html'));
  createSession(prefs.privateBrowsing);

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ─── IPC Handlers ─────────────────────────────────────────────────────────────
ipcMain.handle('get-prefs', () => prefs);

ipcMain.handle('save-prefs', (_, updated) => {
  prefs = { ...prefs, ...updated };
  savePrefs(prefs);
  return prefs;
});

ipcMain.handle('get-blocked-count', () => blockedCount);

ipcMain.handle('reset-blocked-count', () => {
  blockedCount = 0;
  prefs.blockedCount = 0;
  savePrefs(prefs);
  return 0;
});

ipcMain.handle('open-extension-dir', () => {
  shell.openPath(EXT_DIR);
});

ipcMain.handle('reload-extensions', async () => {
  try {
    await loadExtensions(session.defaultSession);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('list-extensions', async () => {
  return session.defaultSession.getAllExtensions().map(ext => ({
    id:      ext.id,
    name:    ext.name,
    version: ext.version,
  }));
});

ipcMain.handle('get-version', () => ({
  app:      app.getVersion(),
  electron: process.versions.electron,
  chrome:   process.versions.chrome,
  node:     process.versions.node,
}));

ipcMain.handle('minimize-window', () => mainWindow?.minimize());
ipcMain.handle('maximize-window', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.handle('close-window', () => mainWindow?.close());

ipcMain.handle('show-save-dialog', async (_, opts) => {
  return dialog.showSaveDialog(mainWindow, opts);
});

ipcMain.handle('show-open-dialog', async (_, opts) => {
  return dialog.showOpenDialog(mainWindow, opts);
});

// ─── App Lifecycle ────────────────────────────────────────────────────────────
app.commandLine.appendSwitch('disable-features', 'OutOfBlinkCors');
app.commandLine.appendSwitch('enable-features',  'OverlayScrollbar');

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  prefs.blockedCount = blockedCount;
  savePrefs(prefs);
  if (process.platform !== 'darwin') app.quit();
});

// Disable navigation to dangerous protocols
app.on('web-contents-created', (_, contents) => {
  contents.on('will-navigate', (e, url) => {
    try {
      const parsed = new URL(url);
      const allowed = ['http:', 'https:', 'file:', 'data:', 'blob:'];
      if (!allowed.includes(parsed.protocol)) e.preventDefault();
    } catch { e.preventDefault(); }
  });

  // Open external links in system browser
  contents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http') || url.startsWith('https')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });
});
