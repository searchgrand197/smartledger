# Smart Ledger

Production-ready billing & ledger software for **any shop or business** — retail, wholesale, hardware, garments, electronics, and more. Track parties, inventory, sales (all-inclusive pricing), and dues.

## Tech Stack

- **Frontend:** React 18, TypeScript, **MUI (Material UI)**, CSS variables, Vite, TanStack Query, Recharts
- **Backend:** Django 5, Django REST Framework, JWT Auth
- **Database:** PostgreSQL 16
- **PDF/Excel:** ReportLab, OpenPyXL
- **Deploy:** Docker Compose

## App flow

```
http://localhost:1008/
    ├── Wholesale / Parties     → owner login — billing, stock, ledger, reports
    └── Customer              → login (code + phone) — view billing history
```

**Wholesale login:** `owner` / `Wholesale@2026`

**Customer:** Owner adds you in Wholesale → Customers. Login with **customer code + phone** (e.g. `CUS-0001`) to see bills, payments and ledger.

Customize home page labels in **Wholesale → Settings → Home page**.

## Quick Start (Docker)

```bash
docker compose up --build
```

- Frontend: http://localhost:1008
- Backend API: http://localhost:8000/api/
- Admin: http://localhost:8000/admin/

**Default login:**
- Username: `owner`
- Password: `Wholesale@2026`

## Local Development (no Docker / no PostgreSQL)

Set `USE_SQLITE=true` in `backend/.env` (already configured). Data is stored in `backend/db.sqlite3`.

## Local Development

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate   # Windows
pip install -r requirements.txt
cp .env.example .env
# Copy .env (USE_SQLITE=true works without PostgreSQL/Docker)
copy .env.example .env
python manage.py migrate
python manage.py seed_data
python manage.py runserver
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:1008 — API requests proxy to `:8000`.

## Modules (sidebar)

| Menu | Features |
|------|----------|
| **Sale** | Party sale + quick walk-in sale (tabs) |
| **Parties** | Customers & suppliers (tabs), profiles, ledger |
| **Inventory** | Products, stock, low-stock alerts |
| **Settings** | Business info & login screen text |

## API Overview

```
POST /api/auth/login/
GET  /api/dashboard/
GET  /api/customers/
GET  /api/customers/{id}/profile/
GET  /api/billing/context/?customer_id=1&product_id=2
POST /api/billing/create/
GET  /api/ledger/customer/{id}/
GET  /api/reports/daily-sales/
```

## Keyboard Shortcuts (Billing)

| Key | Action |
|-----|--------|
| F2 | New bill |
| F3 | Focus customer search |
| F4 | Payment modal |
| F5 | Save bill |
| Enter | Add first product from search |

## Project Structure

```
├── backend/
│   ├── accounts/      # Auth + seed
│   ├── billing/       # Smart billing
│   ├── customers/
│   ├── suppliers/
│   ├── products/
│   ├── purchases/
│   ├── payments/
│   ├── ledger/
│   ├── reports/
│   └── business/      # Settings
├── frontend/
│   └── src/
│       ├── components/ui/   # Reusable: AppTable, PageHeader, StatCard, AppDialog
│       ├── styles/          # variables.css + global.css (no Tailwind)
│       └── pages/           # All UI modules
└── docker-compose.yml
```

## Production Notes

1. Change `SECRET_KEY`, `OWNER_PASSWORD`, and database credentials
2. Set `DEBUG=false`
3. Use HTTPS reverse proxy (nginx included in frontend container)
4. Schedule database backups when `auto_backup` is enabled
5. Updated