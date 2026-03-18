# NetByte Browser

**Privacy-first Chromium-based browser. No tracking. No compromise.**

Built with Electron — bringing together a full Chromium rendering engine, built-in ad/tracker blocking, DuckDuckGo as the default search engine, and native support for Chrome & Firefox (WebExtensions) extensions.

---

## Features

### Privacy & Security
| Feature | Details |
|---|---|
| **Ad & Tracker Blocker** | EasyList + EasyPrivacy via `@cliqz/adblocker-electron` (500k+ filter rules). Falls back to a curated host-based blocker if not available. |
| **HTTPS-Only Mode** | Automatically upgrades `http://` to `https://` (except localhost/LAN) |
| **Do Not Track + GPC** | Sends `DNT: 1` and `Sec-GPC: 1` headers with every request |
| **Referrer Stripping** | Removes `Referer` headers on cross-origin requests |
| **User-Agent Spoofing** | Optional UA override to reduce browser fingerprinting |
| **Private Tabs** | Isolated session partition — no cookies, cache, or history shared |
| **Protocol Guard** | Blocks navigation to dangerous non-HTTP protocols |

### Browsing
- Full Chromium rendering engine (via Electron)
- Multi-tab interface with favicons, loading indicators
- DuckDuckGo as default search (configurable)
- Bookmarks with favicon support
- Keyboard shortcuts (Ctrl+T, Ctrl+W, Ctrl+L, Ctrl+D, Alt+←/→, etc.)
- Custom homepage
- Live ad-block counter in address bar and dashboard

### Extensions (Chrome + Firefox)
NetByte supports **unpacked Chrome extensions** and **Firefox WebExtensions** — they both use the same WebExtensions API. Popular privacy extensions like uBlock Origin, Privacy Badger, Cookie AutoDelete, and Bitwarden work out of the box.

---

## Installation

### Requirements
- **Node.js** 18+
- **npm** 8+
- Linux, Windows, or macOS

### Quick Start

```bash
# Clone the repo
git clone https://github.com/netplayz/netbyte-browser
cd netbyte-browser

# Install & launch
chmod +x install.sh
./install.sh
```

Or manually:

```bash
npm install
npm start
```

### Build Distributable

```bash
# Linux (.deb + AppImage)
npm run build:linux

# Windows (.exe installer)
npm run build:win

# macOS (.dmg)
npm run build:mac
```

---

## Installing Extensions

### Chrome Extensions (Unpacked)
1. Download or clone the extension source (the folder with `manifest.json`)
2. Open **Settings → Extensions → Open Extensions Folder**
3. Drop the extension folder inside
4. Click **Reload Extensions**

> You can find unpackaged versions of most extensions on their GitHub repos. Example: [uBlock Origin source](https://github.com/gorhill/uBlock)

### Firefox WebExtensions
Firefox extensions that use the WebExtensions API are compatible. Download the `.xpi`, rename it to `.zip`, extract, and install the same way.

### Recommended Privacy Extensions
| Extension | Purpose |
|---|---|
| uBlock Origin | Advanced ad/script blocking |
| Privacy Badger | Tracker learning & blocking |
| Cookie AutoDelete | Auto-clears cookies on tab close |
| Bitwarden | Open-source password manager |
| LocalCDN / Decentraleyes | Intercepts CDN requests locally |
| ClearURLs | Strips tracking parameters from URLs |

---

## Settings

Access via the ⚙ gear icon in the toolbar.

| Setting | Default | Description |
|---|---|---|
| Ad & Tracker Blocker | ON | Block ads/trackers using filter lists |
| HTTPS-Only Mode | ON | Upgrade HTTP to HTTPS automatically |
| Do Not Track + GPC | ON | Privacy signal headers |
| Block Cross-Site Referrers | ON | Strip Referer headers |
| Spoof User Agent | OFF | Override User-Agent string |
| Search Engine | DuckDuckGo | Customizable search URL |
| Homepage | DuckDuckGo | New tab destination |

---

## Architecture

```
netbyte-browser/
├── main.js          — Electron main process: session, ad blocker, IPC, extension loader
├── preload.js       — Secure contextBridge API between main ↔ renderer
├── src/
│   ├── browser.html — Browser chrome UI
│   ├── browser.css  — Styles (dark industrial aesthetic)
│   └── browser.js   — Tab management, navigation, bookmarks, settings UI
├── install.sh       — One-shot install + launch
└── package.json
```

### Ad Blocker Stack
1. **Primary**: `@cliqz/adblocker-electron` — downloads and caches EasyList + EasyPrivacy filter lists (~500k rules, binary-serialized for fast startup)
2. **Fallback**: Built-in host-based blocker covering ~30 major ad/analytics domains

### Extension Loading
Electron's `session.loadExtension()` loads Chrome Manifest V2/V3 extensions natively. Extensions are loaded from `~/.config/netbyte-browser/extensions/` (Linux) / `%APPDATA%/netbyte-browser/extensions/` (Windows).

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+T` | New tab |
| `Ctrl+W` | Close tab |
| `Ctrl+L` | Focus address bar |
| `Ctrl+R` / `F5` | Reload |
| `Ctrl+D` | Bookmark current page |
| `Ctrl+1`–`9` | Switch to tab N |
| `Alt+←` | Back |
| `Alt+→` | Forward |

---

## License

GPL-3.0 — **For the people, by the people.**

Built by [Netplayz](https://github.com/netplayz) / NetByte · ByteForge Open Source Lab
