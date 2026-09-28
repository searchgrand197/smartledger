# Smart Ledger

Multi-shop billing & ledger software. You provision each customer yourself from the **Platform Admin** console — no public signup or subscription billing.

## Tech Stack

- **Frontend:** React 18, TypeScript, MUI, Vite, TanStack Query
- **Backend:** Django 5, Django REST Framework, JWT Auth
- **Database:** PostgreSQL 16 (required — SQLite removed)
- **Messaging:** Per-shop WhatsApp Web sessions (Node + whatsapp-web.js)
- **Deploy:** Docker Compose

## Roles

| Who | How to log in | Lands on |
|-----|---------------|----------|
| **You (platform admin)** | `OWNER_USERNAME` / `OWNER_PASSWORD` (superuser) | `/platform/shops` |
| **Shop customer** | Username + password you created for them | Wholesale / Quick sale |
| **Support** | Shop username + **your** platform admin password | That shop’s ledger |

## Quick Start (Docker)

```bash
docker compose up --build
```

- App: http://localhost:1008
- API: http://localhost:8000/api/
- Platform Admin: log in as `owner` → `/platform/shops`
- Django admin: http://localhost:8000/admin/

**Default platform login:** `owner` / `Wholesale@2026` (change in production)

## Local Development

1. Start PostgreSQL (or `docker compose up db -d`).
2. Copy env and install:

```bash
copy .env.example .env
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_data
python manage.py runserver
```

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:1008

## Platform Admin

1. Log in as the platform superuser (`owner` by default).
2. Open **Shops** → create shop name, username, password.
3. Give those credentials to your customer.
4. Toggle Active to disable a shop; use the key icon to reset passwords.
5. To inspect a shop: log in with **their username** and **your admin password**.

## WhatsApp

Each shop scans its own WhatsApp QR under **Wholesale → WhatsApp**. Sessions are isolated by organization — Shop A cannot send via Shop B’s phone.

## Project Structure

```
├── accounts/          # Auth, Organization tenancy, Platform Admin API
├── billing/ customers/ products/ …   # Ledger domain apps
├── messaging/         # Message queue
├── message-sender/    # Per-org WhatsApp Node service
├── frontend/          # React SPA (wholesale + platform admin)
├── config/            # Django settings
└── docker-compose.yml
```

## Production Notes

1. Change `SECRET_KEY`, `OWNER_PASSWORD`, and database credentials
2. Set `DEBUG=false`
3. Use HTTPS reverse proxy (nginx included in frontend container)
4. Schedule PostgreSQL backups
