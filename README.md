# 🥛 Dairy Management ERP v2.0

A complete, enterprise-grade dairy management system built clean-slate.

---

## Tech Stack

| Layer     | Technology |
|-----------|-----------|
| Frontend  | React 18 + Vite + Tailwind CSS + Framer Motion + Recharts |
| Backend   | Node.js + Express + Passport.js |
| Database  | MySQL 8.0+ |
| Auth      | JWT (access + refresh) + Google OAuth2 + Email verification |
| PDF       | jsPDF + jspdf-autotable |
| Email     | Nodemailer (SMTP) |

---

## Project Structure

```
dairy-erp/
├── database/
│   └── schema.sql          ← Run this FIRST (all tables + triggers)
├── backend/
│   ├── server.js
│   ├── .env.example        ← Copy to .env and fill in
│   └── src/
│       ├── config/         db.js, passport.js
│       ├── middleware/      auth.js, validate.js, errorHandler.js
│       ├── routes/          auth, farmers, milk, billing, sales,
│       │                    vehicles, shops, hr, expenses,
│       │                    dashboard, reports, audit
│       ├── services/        emailService.js, auditService.js
│       └── utils/           pricingEngine.js, tokens.js
└── frontend/
    ├── index.html
    ├── vite.config.js
    ├── tailwind.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── api/             client.js (axios + auto-refresh)
        ├── store/           authStore.js (Zustand)
        ├── components/
        │   ├── layout/      AdminLayout.jsx, StaffLayout.jsx
        │   └── ui/          index.jsx (Skeleton, Modal, StatCard…)
        └── pages/
            ├── auth/        Login, Register, Verify, Forgot, Reset, OAuth
            ├── admin/       Dashboard, Farmers, Milk, Billing, Sales,
            │                Vehicles, Shops, HR, Expenses, Reports, Audit
            └── staff/       StaffDashboard, MilkEntry
```

---

## Setup — Step by Step

### 1. Database

```bash
mysql -u root -p < database/schema.sql
```

This creates:
- All 15 tables with FK constraints
- 7 database-level audit triggers
- Default expense categories
- Default admin user: `admin@dairy.local` / `Admin@1234`

### 2. Backend

```bash
cd backend
cp .env.example .env
# → Fill in DB credentials, JWT secrets, Google OAuth, SMTP
npm install
npm run dev        # Development (nodemon)
npm start          # Production
```

**Generate strong JWT secrets:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
npm run build      # Production build → dist/
```

---

## Environment Variables (backend/.env)

```env
# Database
DB_HOST=localhost
DB_USER=root
DB_PASS=your_password
DB_NAME=dairy_erp

# JWT — generate random 64-char strings for both
JWT_SECRET=...
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_SECRET=...
REFRESH_TOKEN_EXPIRES_IN=7d
REFRESH_TOKEN_LONG_EXPIRES_IN=30d   # "Remember Me" option

# Google OAuth (get from console.cloud.google.com)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback

# SMTP (Gmail App Password recommended)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=your_app_password
EMAIL_FROM=Dairy ERP <noreply@dairy.local>

# App
PORT=5000
CLIENT_URL=http://localhost:5173
```

---

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project → Enable **Google+ API**
3. OAuth 2.0 Credentials → Web Application
4. Authorized redirect URI: `http://localhost:5000/api/auth/google/callback`
5. Copy Client ID and Secret to `.env`

---

## Dynamic Pricing Formula

```
Rate = Base_Rate
     + (Actual_FAT − Ideal_FAT) × FAT_Correction
     + (Actual_SNF − Ideal_SNF) × SNF_Correction
```

Each farmer has their own pricing parameters. Rate is computed server-side and snapshotted at time of collection. Clients can call `/api/milk/preview-rate` before saving.

---

## RBAC

| Role  | Access |
|-------|--------|
| Admin | Full access: dashboard, all modules, reports, audit logs, HR, payroll |
| Staff | Milk entry (mobile-first UI) + today's summary only |

---

## Key API Endpoints

```
POST   /api/auth/register        Register + send verification email
GET    /api/auth/verify-email    Verify email token
POST   /api/auth/login           Email/password login → access + refresh tokens
POST   /api/auth/refresh         Rotate refresh token
POST   /api/auth/logout          Revoke refresh token
GET    /api/auth/google          Initiate Google OAuth
POST   /api/auth/forgot-password Send reset email
POST   /api/auth/reset-password  Set new password

GET    /api/dashboard            KPIs, trends, top farmers
GET    /api/farmers              List with search + pagination
POST   /api/milk/preview-rate    Live pricing preview (no DB write)
POST   /api/milk                 Save collection record
POST   /api/billing/generate     Auto-generate all bills for a period
POST   /api/hr/payroll/process   Process payroll with auto advance deduction
GET    /api/reports/pl           Full P&L data for a month
GET    /api/audit                Filterable audit trail
```

---

## Production Checklist

- [ ] Change default admin password immediately after first login
- [ ] Set `NODE_ENV=production`
- [ ] Use HTTPS (reverse proxy via Nginx)
- [ ] Replace SMTP credentials with a transactional service (SendGrid, Mailgun)
- [ ] Set strong, unique JWT secrets
- [ ] Enable MySQL SSL
- [ ] Schedule daily DB backups
- [ ] Set `CLIENT_URL` to your actual domain in `.env`
- [ ] Update Google OAuth redirect URIs in Cloud Console

---

## Default Login

```
Email:    admin@dairy.local
Password: Admin@1234
```

**Change this immediately after setup.**
