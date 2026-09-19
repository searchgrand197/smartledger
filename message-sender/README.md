# SmartLedger WhatsApp sender

Internal Node service that delivers invoice, ledger, and return PDFs over WhatsApp using Baileys. SmartLedger starts it automatically and talks to it on `127.0.0.1:8787`.

## Endpoints

- `GET /api/status` — connection + QR image
- `POST /api/restart` — reopen the session
- `POST /api/disconnect` — log out and show a new QR
- `POST /api/send-pdf` — `{ phone, pdfPath, caption }`

The same routes are also served under `/whatsapp/api/` for Docker.

## Session

Credentials live in `.baileys_auth/` on this machine. Do not commit that folder.
