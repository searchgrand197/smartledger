#!/bin/sh
# Keep the WhatsApp sender running on a VPS (Hostinger, etc.).
# Usage: cd message-sender && chmod +x start.sh && ./start.sh
set -e
cd "$(dirname "$0")"
if [ ! -d node_modules/@whiskeysockets/baileys ]; then
  npm install --omit=dev
fi
export WHATSAPP_INTERNAL_HOST="${WHATSAPP_INTERNAL_HOST:-127.0.0.1}"
export WHATSAPP_INTERNAL_PORT="${WHATSAPP_INTERNAL_PORT:-8787}"
exec node server.js
