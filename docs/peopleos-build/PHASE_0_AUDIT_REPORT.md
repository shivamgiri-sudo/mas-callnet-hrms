# MAS Callnet PeopleOS — Phase 0 Audit Report

> **Audit date:** 2026-05-29  
> **Auditor:** Claude Code (automated codebase audit, human-approved)  
> **Repo:** `shivamgiri-sudo/mas-callnet-hrms`  
> **Branch audited:** `main`  
> **Status:** Approved — implementation pending

---

## Production Safety Restrictions

The following actions require **explicit written approval** before execution. They are **never** performed autonomously:

| Action | Restriction |
|---|---|
| Run SQL on production MySQL (`122.184.128.90`) | Explicit approval per file |
| Run `supabase db push` or apply migrations to prod Supabase | Explicit approval per migration |
| `git push` to `main` | Explicit approval |
| Deploy to Vercel (frontend) | Explicit approval |
| Deploy to Railway (backend) | Explicit approval |
| Modify `.env` files with real credentials | Never — example files only |
| Drop tables, truncate data, or run destructive DDL | Explicit approval + tested backup |
| Modify Supabase Edge Functions in production | Explicit approval |

---

## Architecture Overview

```
Frontend (React 18 + Vite + Tailwind + shadcn/ui)
  Deploy: Vercel (mas-callnet-hrms.vercel.app)
  Auth: Supabase JWT — stored and refreshed by Supabase client
  API: hrmsApi.ts → Bearer token → Railway backend (VITE_HRMS_API_URL)
  UI RBAC: useUserRole.ts → Supabase role_page_access + user_assignment_scope
  Page gate: WorkforcePageGate component (frontend visibility only)

Backend API (Express 5 + TypeScript, port 5055)
  Deploy: Railway (nixpacks.toml)
  Auth middleware: requireAuth → supabaseAdmin.auth.getUser(token)
  Role middleware: requireRole → MySQL user_roles (AUTHORITY for API access)
  Modules: 11 (employees, ats, leave, payroll, wfm, kpi, portal, exit,
            integration-hub, process, migration)

MySQL mas_hrms @ 122.184.128.90
  Schema: 15 SQL files (backend/sql/001–012 + duplicates noted below)
  Authority for: all operational HRMS data

Supabase (project: bebminxoqdjzzfhnrsge — CONFIRMED production)
  PostgreSQL: auth + legacy tables + lms_* (native, transitional)
  Storage: employee documents, assets
  Edge Functions: 13 (email, notifications, version-check)
  45 migration files (Dec 2024 – May 2026)
  RBAC mirror: role_page_access, user_assignment_scope (UI visibility only)

Deployed LMS (separate repo, company domain)
  Bridge: POST ${VITE_LMS_API_URL}/api/auth/bridge
  HRMS integration: additive only, via Integration Hub in future phases
  Status: VITE_LMS_API_URL absent from .env.example — bridge non-functional
```

---

## Supabase Project Reference Analysis

Three project IDs found in repo. Documented here — no changes made yet.

| ID | Location | Classification | Notes |
|---|---|---|---|
| `bebminxoqdjzzfhnrsge` | `src/integrations/supabase/client.ts` (hardcoded fallback), `NativeMigrationConsole.tsx`, `PROJECT_OVERVIEW.md` | **Production — owner-confirmed** | Active production project |
| `ppdsxgkmnmjfwmpnamts` | `supabase/config.toml` line 1 | **Local Supabase CLI project** | Used by `supabase link`/`supabase start` tooling only; does not affect app runtime |
| `unanckifivwkziwvnjtc` | `backend/.env.example` line 6 | **Stale / incorrect** | Appears nowhere else in codebase; `SUPABASE_URL` in `.env.example` points to wrong project |

**Phase 0 action for project IDs:**
- `supabase/config.toml` — do NOT change unless confirming whether `ppdsxgkmnmjfwmpnamts` is intentional local CLI project
- `backend/.env.example` — flag `unanckifivwkziwvnjtc` as stale; update to `bebminxoqdjzzfhnrsge` only after approval
- No production environment variables changed

---

## Three Approved Architecture Decisions

### Decision 1 — RBAC Authority (Option B with controls)

- **Supabase Auth** = identity and authentication source only
- **MySQL `user_roles`** = authority for all API-level and sensitive-data access
- **Supabase `role_page_access`** = transitional frontend UI/menu visibility mirror only; NOT authoritative for security
- No generic backend fallback from MySQL roles to Supabase page-access roles
- Phase 0 must include:
  - Role reconciliation/backfill plan (identify users in Supabase but not MySQL, and vice versa)
  - Mismatch reporting endpoint or script
  - Negative API access tests (assert 403 returned when role missing from MySQL even if present in Supabase)
- Future: new backend endpoint `/api/access/roles` — writes MySQL first, then mirrors to Supabase

### Decision 2 — LMS Ownership (Option A with transition controls)

- Supabase `lms_*` tables preserved — do NOT delete or deprecate in Phase 0
- Current native LMS flows (`NativeLMSMyLearning`, `NativeLMSCoordinator`) remain on Supabase
- `NativeLMSAdmin` writes to Supabase `lms_*` — protected as transitional legacy native LMS
- HRMS must NOT be enhanced as a second operational LMS
- Deployed internal LMS is the future system of record for LMS operations
- Integration path: additive Integration Hub-based bridge in a future phase
- No Supabase LMS deprecation until integration + mapping + reconciliation tested and approved

### Decision 3 — Supabase Project Reference

- Authoritative production project: **`bebminxoqdjzzfhnrsge`**
- All future documentation, configuration examples, and deployment references use this ID
- Existing environment files inspected before any replacement (see analysis above)
- `supabase/config.toml` `ppdsxgkmnmjfwmpnamts` may be correct local CLI config — do not change without verifying with CLI tooling

---

## Module Status Matrix

| Module | Status | Notes |
|---|---|---|
| Employees | ✅ Working | `/api/employees` ↔ MySQL |
| ATS | ✅ Working | `/api/ats` ↔ MySQL |
| Leave | ✅ Working | `/api/leave` ↔ MySQL |
| WFM Roster | ✅ Working | `/api/wfm/roster` ↔ MySQL; `NativeWFMRoster` uses hrmsApi |
| WFM Live Tracker | ⚠️ Backend-only | `liveTracker.service.ts` + `/api/wfm/live` exist; App.tsx routes `/wfm/live-tracker` → `NativePlaceholderPage` |
| Payroll | ⚠️ Partial | Structure/runs/calc exist; TDS=0; no advance deduction; working_days hardcoded=26; `salary_payslip` table missing |
| KPI | ✅ Working | `/api/kpi` ↔ MySQL |
| Client Portal | ✅ Working | OTP auth, dual JWT, 9 service files, 3 frontend pages |
| Exit | ✅ Working | `/api/exit` ↔ MySQL |
| Integration Hub | ✅ Working | `/api/integration-hub` ↔ MySQL |
| Process | ✅ Working | `/api/processes` ↔ MySQL |
| Migration Console | ⚠️ Partial | Row count only; no Supabase→MySQL migration logic |
| Assets | 🔵 Frontend/Supabase only | `useAssets.ts` → Supabase `assets`+`asset_assignments`; no backend route; **PROTECTED — do not remove** |
| Documents | 🔵 Frontend/Supabase only | `useEmployeeDocuments.ts` → Supabase Storage + `employee_documents`; **PROTECTED — do not remove** |
| Performance/Goals | 🔵 Frontend/Supabase only | Supabase `goals`, `performance_reviews`; **PROTECTED** |
| Attendance (legacy) | 🔵 Frontend/Supabase only | Legacy Supabase `attendance_records` pages; **PROTECTED** |
| LMS Admin | ❌ Broken route | App.tsx routes `/lms/admin` → `NativePlaceholderPage`; `NativeLMSAdmin` imported but unused in router |
| LMS My Learning | ⚠️ Partial | Renders; reads Supabase `lms_*` directly; **PROTECTED as legacy native LMS** |
| LMS Coordinator | ⚠️ Partial | Supabase direct; **PROTECTED as legacy native LMS** |
| LMS Management Dashboard | ❌ Missing | Routes to placeholder; `useLMSSession` bridge non-functional (VITE_LMS_API_URL missing) |
| Quality Dashboard | ❌ Placeholder | — |
| Operations Dashboard | ❌ Placeholder | — |
| ATS Onboarding Bridge | ❌ No route | `NativeATSOnboardingBridge.tsx` exists, not in router |
| ATS Waiting Queue | ❌ No route | `NativeATSWaitingQueue.tsx` exists, not in router |
| ATS Candidate Master | ❌ No route | `NativeATSCandidateMaster.tsx` exists, not in router |
| ATS Recruiter Workspace | ❌ No route | `NativeATSRecruiterWorkspace.tsx` exists, not in router |
| ATS Dashboard V2 / Replica | ❌ No route | Both page components exist, neither in router |
| Unified Perf Command Center | ✅ Routed | `/performance/command-center` |
| Access Control | ✅ Routed | `/settings/access-control` |
| Bulk Upload Hub | ✅ Routed | `/bulk-upload` |

---

## Source-of-Truth Matrix

| Domain | Authority | Tables / Location |
|---|---|---|
| Auth sessions / identity | Supabase Auth | `auth.users` |
| Staff role assignments (API access) | **MySQL** | `user_roles`, `workforce_role_catalog` |
| Page visibility / UI RBAC | Supabase (mirror) | `role_page_access`, `user_assignment_scope` |
| Page access permission assignment scope | Supabase (mirror) | `user_assignment_scope` |
| Employees | MySQL | `employees` |
| ATS pipeline | MySQL | `ats_candidate`, `ats_candidate_stage_log` |
| Leave | MySQL | `leave_request`, `leave_balance_ledger`, `leave_type_master` |
| Attendance / WFM | MySQL | `wfm_attendance_session`, `wfm_roster_assignment`, `wfm_shift_master` |
| Payroll | MySQL | `salary_prep_run`, `salary_prep_line`, `employee_salary_assignment` |
| KPI | MySQL | `kpi_metric_master`, `role_kpi_snapshot` |
| Client Portal | MySQL | `client_master`, `client_user`, `portal_otp`, `glide_path_commitment` |
| Exit | MySQL | `exit_request` |
| Integrations | MySQL | `integration_config`, `integration_field_map` |
| Assets | Supabase PostgreSQL | `assets`, `asset_assignments` — **protected** |
| Documents | Supabase Storage + PostgreSQL | `employee_documents` + storage — **protected** |
| Goals / Performance | Supabase PostgreSQL | `goals`, `performance_reviews`, `review_kpi_ratings` — **protected** |
| Notifications | Supabase PostgreSQL | `notifications`, `push_subscriptions` |
| LMS content (native transitional) | Supabase PostgreSQL | `lms_*` tables — **protected, Decision 2** |
| LMS content (target system) | Deployed LMS backend | Bridge only via `VITE_LMS_API_URL` |

---

## P0 — Blocking Defects

| ID | Problem | File(s) | Severity |
|---|---|---|---|
| P0-1 | `/lms/admin` routes to `NativePlaceholderPage`; `NativeLMSAdmin` imported but not used in router | `src/App.tsx:108` | Broken page |
| P0-2 | `/wfm/live-tracker` routes to `NativePlaceholderPage`; `NativeWFMLiveTracker` imported but not routed | `src/App.tsx:115` | Broken page |
| P0-3 | `VITE_LMS_API_URL` missing from `.env.example` — LMS bridge silently fails with "Not authenticated" | `.env.example` | Silent failure |
| P0-4 | **RBAC authority split**: frontend RBAC reads Supabase `role_page_access`; backend `requireRole` reads MySQL `user_roles`. Users in Supabase but not MySQL get 403 on all API calls. | `src/hooks/useUserRole.ts`, `backend/src/middleware/requireRole.ts` | Access failure |
| P0-5 | `salary_payslip` table absent from all SQL files; payroll disbursement/payslip has no write target | All `backend/sql/*.sql` | Missing schema |

## P1 — Significant Gaps

| ID | Problem | File(s) |
|---|---|---|
| P1-1 | TDS hardcoded `0` in payroll calculation | `backend/src/modules/payroll/payrollCalculate.service.ts` |
| P1-2 | Salary advance not deducted in payroll run | `payrollCalculate.service.ts` + `salary_advance_log` |
| P1-3 | Working days hardcoded `26`; holiday calendar not integrated | `payrollCalculate.service.ts` |
| P1-4 | `portal_access_log` table never written — audit trail broken | All `backend/src/modules/portal/portal.*.service.ts` |
| P1-5 | `backend/.env.example` `SUPABASE_URL` points to stale project `unanckifivwkziwvnjtc` | `backend/.env.example:6` |
| P1-6 | `employee_bank_detail` table missing encryption at rest | `backend/sql/002_employees.sql` |
| P1-7 | `migration_run` + `migration_row_log` tables absent — migration console cannot log runs | All SQL files |
| P1-8 | SQL file numbering conflicts: two `010_*` files, two `012_*` files; `000_run_all.sql` will fail partially | `backend/sql/` |
| P1-9 | LWP deduction not applied in payroll calc; `lwp_days` populated but deduction not computed | `payrollCalculate.service.ts` |
| P1-10 | Demo portal bypass (`demo@mascallnet.com`) not env-gated — active in production | `backend/src/modules/portal/portal.auth.service.ts` |

## P2 — Quality / Incomplete

| ID | Problem | File(s) |
|---|---|---|
| P2-1 | 6 ATS pages (`NativeATSOnboardingBridge`, `NativeATSWaitingQueue`, `NativeATSCandidateMaster`, `NativeATSRecruiterWorkspace`, `NativeATSDashboardV2`, `NativeATSDashboardReplica`) exist but have no routes | `src/App.tsx` |
| P2-2 | PT (Professional Tax) fixed ₹200; should read state slab from `statutory_config` | `payrollCalculate.service.ts` |
| P2-3 | `portal_otp` records never purged — table grows indefinitely | `portal.auth.service.ts` |
| P2-4 | `process_master` exists in both MySQL and Supabase — dual-write risk | `001_core_org.sql` + Supabase migrations |
| P2-5 | `NativeLMSAdmin.tsx` writes directly to Supabase `lms_*` tables — conflicts with deployed LMS as future system of record | `src/pages/NativeLMSAdmin.tsx` |
| P2-6 | Payslip PDF client-side only (jsPDF); no server-side generation or secure storage | `src/lib/payslipPdfGenerator.ts` |

---

## Phase 0 Safe Implementation Order

All steps operate on local Docker MySQL + local dev server only. No production changes.

| Step | Action | Unblocks |
|---|---|---|
| 1 | Rename SQL files: `010_kpi_migration.sql` → `010a_kpi_migration.sql`; `012_roster_shift_times.sql` → `013_roster_shift_times.sql` | D2/D3 file conflicts |
| 2 | Update `000_run_all.sql` to reflect new numbering | Clean migration runs |
| 3 | New file `013_salary_payslip.sql` — `salary_payslip` table | P0-5 |
| 4 | New file `014_migration_tracking.sql` — `migration_run`, `migration_row_log` tables | P1-7 |
| 5 | Fix `App.tsx` route: `/lms/admin` → `NativeLMSAdmin`; `/wfm/live-tracker` → `NativeWFMLiveTracker` | P0-1, P0-2 |
| 6 | Add `VITE_LMS_API_URL` placeholder to `.env.example` with comment | P0-3 |
| 7 | Fix `backend/.env.example` `SUPABASE_URL` → `https://bebminxoqdjzzfhnrsge.supabase.co` | P1-5 |
| 8 | New backend module `access/` — `access.routes.ts` + `access.service.ts`; mount in `app.ts` | P0-4 |
| 9 | Write role reconciliation script + mismatch report endpoint | P0-4 |
| 10 | Add negative API access tests (user in Supabase only → 403) | P0-4 |
| 11 | Write `portal_access_log` INSERT in portal controller | P1-4 |
| 12 | Env-gate `demo@mascallnet.com` bypass via `DEMO_MODE` env var | P1-10 |
| 13 | Fix LWP deduction in payroll calc | P1-9 |
| 14 | Basic TDS stub from `statutory_config` annualized taxable income | P1-1 |
| 15 | Wire `salary_advance_log` recovery into payroll calc | P1-2 |

**Steps 1–7:** Documentation + config only. Zero runtime risk.  
**Steps 8–10:** New backend module. Does not touch existing routes.  
**Steps 11–15:** Isolated changes to existing service files.

---

## Local Testing Plan

```bash
# 1. Start local MySQL
docker run --name mas-mysql-local \
  -e MYSQL_ROOT_PASSWORD=root \
  -e MYSQL_DATABASE=mas_hrms \
  -p 3307:3306 -d mysql:8

# 2. Apply migrations in order (local only)
for f in backend/sql/00{1..9}_*.sql backend/sql/01[0-9]*.sql; do
  mysql -h 127.0.0.1 -P 3307 -u root -proot mas_hrms < "$f"
done

# 3. Backend local .env overrides
# DB_HOST=127.0.0.1  DB_PORT=3307  SUPABASE_URL=https://bebminxoqdjzzfhnrsge.supabase.co

# 4. Run backend
cd backend && npm run dev      # :5055

# 5. Run frontend
npm run dev                    # :5173 (root)
# VITE_HRMS_API_URL=http://localhost:5055

# 6. Typecheck
cd backend && npm run typecheck
cd ../ && npm run lint

# 7. Tests
cd backend && npm run test
```

## Rollback Plan

- All SQL changes use `CREATE TABLE IF NOT EXISTS` — safe to re-run
- All SQL adds new tables only — no column drops or table renames in Phase 0
- Rollback new tables: `DROP TABLE IF EXISTS <new_table>` (local only; never on production without approval)
- Frontend/backend changes: `git revert <commit>` per commit
- Never run `000_run_all.sql` on production — apply individual numbered files only
- Never ALTER existing columns on production without a separate migration file + approval
