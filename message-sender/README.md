# SmartLedger WhatsApp sender

Internal Node service that delivers invoice, ledger, and return PDFs over WhatsApp using Baileys. SmartLedger starts it automatically and talks to it on `127.0.0.1:8787`.

Each organization has its own session and can link a different phone number.

## Endpoints

All routes require `organizationId` (query, JSON body, or `X-Organization-Id` header).

- `GET /api/status` — connection + QR image for that shop
- `POST /api/restart` — reopen that shop's session
- `POST /api/disconnect` — log out that shop and show a new QR
- `POST /api/send-pdf` — `{ organizationId, phone, pdfPath, caption }`

The same routes are also served under `/whatsapp/api/` for Docker.

## Session

Credentials live in `.baileys_auth/org-{id}/` on this machine. Do not commit that folder.
