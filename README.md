# HMS — Hospital Management System (Auth, User Management & RBAC foundation)

Production-grade base for a modular hospital SaaS: authentication, user
lifecycle management, and fully database-driven RBAC for 5 roles
(Super Admin, Admin, Doctor, Nurse, Patient).

## Architecture

- **Backend**: Node.js, Express, TypeScript, PostgreSQL via Prisma ORM
- **Frontend**: React 18, TypeScript, Vite, React Router, Tailwind, react-hook-form + zod
- **Auth**: short-lived JWT access tokens (in-memory on client) + rotating
  opaque refresh tokens (httpOnly, sameSite=strict cookie), argon2id password hashing
- **RBAC**: `Role` → `Permission` mapping lives entirely in the database
  (`role_permissions` table), plus optional per-user `GRANT`/`REVOKE`
  overrides (`user_permissions`). Nothing is hardcoded in route logic —
  a super admin can change what a role can do at runtime via `/api/roles`.
- **Multi-tenancy**: `Hospital` / `Department` scoping built into the schema.

## Why this design

| Concern | Approach |
|---|---|
| No hardcoded roles | Permission codes are checked against the DB-resolved list embedded in the JWT at login/refresh — `requirePermission()` never branches on role name. |
| Doctor/Nurse onboarding | Invitation-token flow (`invitations` table), admin-initiated, email-verified implicitly. |
| Admin onboarding | Created directly by Super Admin with a temp password + forced change on first login. |
| Patient onboarding | Public self-registration + mandatory email verification before login. |
| Account security | argon2id hashing, account lockout after N failed logins, refresh-token rotation + revocation, password-reset invalidates all sessions. |
| Auditability | Every sensitive action (login, status change, permission change, invite) writes to `audit_logs`. |
| Extensibility | New roles/permissions can be added via the seed script or the Role Management API without redeploying auth logic. |

## Getting started

### 1. Database
```bash
docker compose up -d
```

### 2. Backend
```bash
cd backend
cp .env.example .env        # fill in real secrets before production use
npm install
npm run prisma:migrate      # creates schema
npm run seed                # seeds roles, permissions, role-permission map, super admin
npm run dev                 # http://localhost:4000
```
Seed prints the bootstrap super admin credentials (override via
`SEED_SUPERADMIN_EMAIL` / `SEED_SUPERADMIN_PASSWORD` env vars). It sets
`mustChangePassword=true` — enforce that on first login in your dashboard flow.

### 3. Frontend
```bash
cd frontend
npm install
npm run dev                 # http://localhost:5173
```

## Core flows implemented

- Public patient signup → email verification → login
- Login / logout / silent access-token refresh (rotation) / forgot-password / reset-password / change-password
- Super Admin creates Admins directly
- Admin invites Doctors/Nurses by email → invitee sets password via `/accept-invitation`
- Super Admin manages roles & permissions at runtime (`/api/roles`)
- Per-user permission overrides (`/api/users/:id/permission-overrides`)
- User status lifecycle: suspend / deactivate / soft-delete, with forced session revocation
- Full audit trail (`/api/audit-logs`, Super Admin only)

## Testing

Backend unit tests (Vitest) cover the two bug classes this project has
actually hit in practice: permission resolution/enforcement, and the
hospital + active-assignment scoping rules for clinical/patient data.
They mock the Prisma client — no test database needed.

```bash
cd backend
npm run test        # run once
npm run test:watch  # watch mode
```

## Current status

Beyond the auth/RBAC foundation above, the following are also built:
Hospital & Department management, Admin management UI, Staff (Doctor/
Nurse) invite + management UI with hospital-scoped assignment, Appointments
(booking, conflict prevention, status lifecycle), Clinical Records
(diagnoses, prescriptions, vitals, notes — all scoped to active
doctor/nurse-patient assignments), Report file uploads, and dark mode.

## Not yet built (next milestones)
Automated tests beyond the RBAC/scoping suite above (e.g. appointment
conflict-detection logic), patient self-service profile editing (MRN/blood
group/DOB currently always empty), in-app notifications, role-specific
dashboard analytics.