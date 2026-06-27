# PWMS — Personal Wealth Management System

Full-stack web application for comprehensive personal finance tracking.
**Stack:** Node.js 22 + Express 5 + TypeScript (backend) | Angular 17 (frontend) | PostgreSQL + Redis (Aiven)

---

## Project Structure

```
pwms/
├── backend/                   # Node.js API
│   ├── src/
│   │   ├── config/            # env, db, redis
│   │   ├── middleware/        # auth, validate, errorHandler
│   │   ├── modules/
│   │   │   ├── auth/          # register, login, JWT, MFA
│   │   │   └── users/         # profile, change-password
│   │   ├── utils/             # logger, response helpers
│   │   ├── types/             # Express type extensions
│   │   ├── database/          # migration runner + schema
│   │   ├── app.ts             # Express app setup
│   │   └── server.ts          # Entry point
│   ├── tests/                 # Supertest integration tests
│   ├── keys/                  # RS256 key pair (gitignored)
│   ├── .env.example
│   ├── Dockerfile
│   └── package.json
├── frontend/                  # Angular 17 SPA
│   └── src/app/
│       ├── core/
│       │   ├── guards/        # authGuard, guestGuard
│       │   ├── interceptors/  # JWT attach + auto-refresh
│       │   └── services/      # AuthService
│       ├── modules/
│       │   ├── auth/          # Login, Register, MFA pages
│       │   ├── dashboard/     # Net Worth dashboard (Phase 2)
│       │   └── shell/         # Authenticated layout shell
│       └── shared/models/     # TypeScript interfaces
├── database/                  # Extra SQL references
├── scripts/
│   └── generate-keys.sh       # RS256 key pair generator
└── docker-compose.yml         # Local dev stack
```

---

## Quick Start

### Prerequisites
- Node.js 22+
- Docker & Docker Compose
- OpenSSL (for key generation)

### 1. Generate JWT Keys
```bash
bash scripts/generate-keys.sh
```

### 2. Configure Backend
```bash
cp backend/.env.example backend/.env
# Edit backend/.env:
#   For local dev, point to Docker services:
#   DB_HOST=localhost  DB_USER=pwms_user  DB_PASSWORD=pwms_dev_password
#   REDIS_URL=redis://:pwms_dev_redis_pass@localhost:6379
```

### 3. Start Infrastructure
```bash
docker-compose up -d postgres redis
```

### 4. Install & Migrate
```bash
cd backend
npm install
npm run migrate     # creates all tables + seeds categories
```

### 5. Run Backend
```bash
npm run dev         # http://localhost:3000
```

### 6. Run Frontend
```bash
cd ../frontend
npm install
npx ng serve        # http://localhost:4200
```

### 7. Run Tests
```bash
cd backend
npm test
```

---

## API Endpoints — Phase 1

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/v1/auth/register | Public | Register user |
| POST | /api/v1/auth/login | Public | Login |
| POST | /api/v1/auth/refresh | Public | Refresh tokens |
| POST | /api/v1/auth/logout | Public | Revoke refresh token |
| GET  | /api/v1/auth/me | Bearer | Get current user |
| POST | /api/v1/auth/mfa/verify | Pre-MFA Bearer | Verify TOTP |
| POST | /api/v1/auth/mfa/setup | Bearer | Begin MFA setup |
| POST | /api/v1/auth/mfa/confirm | Bearer | Confirm MFA setup |
| POST | /api/v1/auth/mfa/disable | Bearer | Disable MFA |
| GET  | /api/v1/users/profile | Bearer | Get profile |
| PATCH | /api/v1/users/profile | Bearer | Update profile |
| POST | /api/v1/users/change-password | Bearer | Change password |
| GET  | /health | Public | Health check |

---

## Database Schema — Phase 1

Tables created by `npm run migrate`:
- `users` — accounts, MFA, currency preference
- `accounts` — financial account records (bank, FD, stocks, MF, bond…)
- `transactions` — all debits/credits with category
- `categories` — system + user-defined categories (16 system defaults seeded)
- `assets` — individual asset holdings (stocks, MF units, bonds, FDs)
- `goals` — financial goals with target amount + date
- `audit_logs` — all mutations with IP + timestamp
- `schema_migrations` — migration tracking

---

## Security

- **JWT RS256** — asymmetric keys; 15-min access token, 7-day rotating refresh token
- **MFA** — TOTP via Google Authenticator / Authy; QR code setup flow
- **Passwords** — bcrypt (12 rounds) + per-user salt
- **Rate limiting** — 10 req/min on auth endpoints, 100 req/min global
- **Helmet** — security headers (CSP, HSTS, X-Frame-Options)
- **CORS** — restricted to configured origin
- **Audit log** — every auth event recorded

---

## Phase Roadmap

| Phase | Focus | Status |
|-------|-------|--------|
| 1 | Auth, DB schema, project scaffold | ✅ Done |
| 2 | Bank Accounts, FD, Net Worth Dashboard | 🔜 Next |
| 3 | Stocks, Mutual Funds, Bonds, Loans Given | Planned |
| 4 | Income & Expenses, Budgets, Goals | Planned |
| 5 | Reports, Analytics, Notifications | Planned |
| 6 | Mobile — Flutter app | Planned |
