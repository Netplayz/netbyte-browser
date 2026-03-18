#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════
#   NetByte Browser — Install & Launch Script
# ═══════════════════════════════════════════════════════════
set -e

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${CYAN}"
echo "  ███╗   ██╗███████╗████████╗██████╗ ██╗   ██╗████████╗███████╗"
echo "  ████╗  ██║██╔════╝╚══██╔══╝██╔══██╗╚██╗ ██╔╝╚══██╔══╝██╔════╝"
echo "  ██╔██╗ ██║█████╗     ██║   ██████╔╝ ╚████╔╝    ██║   █████╗  "
echo "  ██║╚██╗██║██╔══╝     ██║   ██╔══██╗  ╚██╔╝     ██║   ██╔══╝  "
echo "  ██║ ╚████║███████╗   ██║   ██████╔╝   ██║      ██║   ███████╗"
echo "  ╚═╝  ╚═══╝╚══════╝   ╚═╝   ╚═════╝    ╚═╝      ╚═╝   ╚══════╝"
echo -e "${NC}"
echo -e "  ${CYAN}B R O W S E R${NC}  —  ByteForge Open Source Lab · Privacy-first. No tracking. No compromise."
echo ""

# ── Check Node.js ──────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo -e "${RED}[ERROR]${NC} Node.js not found. Install Node.js 18+ from https://nodejs.org"
  exit 1
fi

NODE_VER=$(node -e "process.exit(parseInt(process.versions.node))")
if [ $? -lt 18 ] 2>/dev/null; then
  echo -e "${YELLOW}[WARN]${NC} Node.js 18+ recommended. Detected: $(node --version)"
fi

# ── Check npm ──────────────────────────────────────────────
if ! command -v npm &>/dev/null; then
  echo -e "${RED}[ERROR]${NC} npm not found."
  exit 1
fi

echo -e "${GREEN}[1/3]${NC} Installing dependencies…"
npm install --no-audit --no-fund

echo ""
echo -e "${GREEN}[2/3]${NC} Dependency check:"
node -e "
  const mods = ['electron', '@cliqz/adblocker-electron', 'cross-fetch'];
  mods.forEach(m => {
    try { require.resolve(m); console.log('  ✓', m); }
    catch { console.log('  ✗', m, '(optional — fallback blocker will be used)'); }
  });
"

echo ""
echo -e "${GREEN}[3/3]${NC} Launching NetByte Browser…"
echo ""
echo -e "  ${CYAN}Tips:${NC}"
echo "  • Ctrl+T       — New tab"
echo "  • Ctrl+W       — Close tab"
echo "  • Ctrl+L       — Focus address bar"
echo "  • Ctrl+D       — Bookmark page"
echo "  • Ctrl+1..9    — Switch tabs"
echo "  • Alt+← / →   — Back / Forward"
echo ""
echo -e "  ${YELLOW}Extensions:${NC} Drop unpacked Chrome/Firefox extension folders into:"
echo "  ~/.config/netbyte-browser/extensions/"
echo ""

npm start
