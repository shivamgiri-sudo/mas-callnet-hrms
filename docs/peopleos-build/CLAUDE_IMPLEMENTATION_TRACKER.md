# MAS Callnet PeopleOS — Implementation Tracker

> **Last updated:** 2026-05-29 (Package 0-A schema runner fix applied)  
> **Source of truth:** This file. Update on every task completion or decision change.  
> **Production safety:** Rows marked `Approval Required: YES` must not be executed without explicit written approval.

---

## Legend

| Status | Meaning |
|---|---|
| 🔒 PROTECTED | Working flow — do not modify without explicit decision |
| ✅ DONE | Completed and tested |
| 🔄 IN PROGRESS | Active work |
| ⬜ PENDING | Approved, not started |
| 🚫 BLOCKED | Cannot start — dependency unresolved |
| 🔵 DEFERRED | Out of current phase scope |
| ❌ BROKEN | Exists but non-functional |
| ⚠️ PARTIAL | Partially working |

---

## Phase 0 — Stabilisation & Audit Remediation

### 0.1 — SQL Schema Fixes

| Phase | Module | Task | Current State | Planned Change | Files Affected | DB Impact | API Impact | Frontend Impact | Roles Impacted | Test Required | Risk | Status | Approval Required |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 0 | Schema | Fix `000_run_all.sql` — add missing `010_kpi.sql` and `012_client_portal.sql` sources | Runner missing 2 files; KPI + portal tables never created on fresh schema | Inserted both SOURCE lines in correct dependency order; no renames | `backend/sql/000_run_all.sql` | Applied to production mas_hrms 2026-05-29: +15 tables (5 KPI + 10 portal). 63 → 78 total. | None | None | All | 493/493 backend tests pass; frontend build clean | Low — all CREATE TABLE IF NOT EXISTS; idempotent | ✅ DONE | YES (production DDL — approved 2026-05-29) |
| 0 | Schema | ~~Rename `010_kpi_migration.sql`~~ | **Superseded** — renaming not approved; runner fix addresses the gap without renames | No renames until migration/deployment history verified | — | — | — | — | — | — | — | 🚫 BLOCKED (not approved) | YES |
| 0 | Schema | ~~Rename `012_roster_shift_times.sql`~~ | **Superseded** — same reason | — | — | — | — | — | — | — | — | 🚫 BLOCKED (not approved) | YES |
| 0 | Schema | Add `salary_payslip` table | Table missing from all SQL files; payslip logic has no write target | New file `backend/sql/013_salary_payslip.sql` with table definition | `backend/sql/013_salary_payslip.sql` (new), `backend/sql/000_run_all.sql` | Additive — new table only | None yet | None yet | HR, Admin | Apply to local MySQL; verify table creation | Low — additive | ⬜ PENDING | NO (local); YES (production) |
| 0 | Schema | Add `migration_run` + `migration_row_log` tables | Tables missing; migration console cannot log run history | New file `backend/sql/014_migration_tracking.sql` | `backend/sql/014_migration_tracking.sql` (new), `backend/sql/000_run_all.sql` | Additive — new tables only | None yet | None yet | Admin | Apply to local MySQL | Low — additive | ⬜ PENDING | NO (local); YES (production) |

### 0.2 — Environment and Config Fixes

| Phase | Module | Task | Current State | Planned Change | Files Affected | DB Impact | API Impact | Frontend Impact | Roles Impacted | Test Required | Risk | Status | Approval Required |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 0 | Config | Fix stale `SUPABASE_URL` in `backend/.env.example` | Points to `unanckifivwkziwvnjtc` (stale, appears nowhere else) | Update to `https://bebminxoqdjzzfhnrsge.supabase.co` | `backend/.env.example` | None | None | None | None | Verify backend connects to Supabase auth on fresh `.env` copy | Low — example file only; no production env touched | ⬜ PENDING | NO (.env.example only); YES (any real .env) |
| 0 | Config | Add `VITE_LMS_API_URL` to frontend `.env.example` | Key missing; `useLMSSession` silently fails | Add placeholder with doc comment | `.env.example` | None | None | LMS pages stop silently failing; error becomes explicit | None | Verify `useLMSSession` returns correct error when placeholder used | Low | ⬜ PENDING | NO |
| 0 | Config | Document `supabase/config.toml` project_id `ppdsxgkmnmjfwmpnamts` | May be intentional Supabase CLI local project; not app runtime | Add comment in config.toml explaining this is CLI tooling only | `supabase/config.toml` | None | None | None | None | None | None | ⬜ PENDING | NO (comment only); YES (value change) |

### 0.3 — Broken Route Fixes

| Phase | Module | Task | Current State | Planned Change | Files Affected | DB Impact | API Impact | Frontend Impact | Roles Impacted | Test Required | Risk | Status | Approval Required |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 0 | LMS | Wire `/lms/admin` → `NativeLMSAdmin` | Routes to `NativePlaceholderPage` | Change route target in `App.tsx` | `src/App.tsx` | None | None | LMS Admin page now loads; reads Supabase `lms_*` (Decision 2A) | Admin, HR | Navigate to `/lms/admin`; verify page loads; verify Gate enforced | Low — Decision 2A: Supabase native LMS stays; page already built | ⬜ PENDING | NO |
| 0 | WFM | Wire `/wfm/live-tracker` → `NativeWFMLiveTracker` | Routes to `NativePlaceholderPage`; backend service + API already exist | Change route target in `App.tsx` | `src/App.tsx` | None | None (API already live) | WFM Live Tracker page now loads | Admin, HR, WFM | Navigate to `/wfm/live-tracker`; verify live data loads from `/api/wfm/live` | Low — backend already complete | ⬜ PENDING | NO |

### 0.4 — RBAC Authority Fix (Decision 1)

| Phase | Module | Task | Current State | Planned Change | Files Affected | DB Impact | API Impact | Frontend Impact | Roles Impacted | Test Required | Risk | Status | Approval Required |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 0 | Access Control | New backend module `/api/access/roles` | No role CRUD API exists; role assignment writes to Supabase only | Create `backend/src/modules/access/access.routes.ts` + `access.service.ts`; mount in `app.ts` | `backend/src/modules/access/access.routes.ts` (new), `backend/src/modules/access/access.service.ts` (new), `backend/src/app.ts` | Writes to MySQL `user_roles`; mirrors to Supabase `user_roles` | New endpoints: `GET/POST/DELETE /api/access/roles` | `UnifiedAccessControl.tsx` will be updated to call new API (later step) | Admin only | POST role, verify MySQL row created + Supabase row created | Medium — touches auth layer | ⬜ PENDING | NO |
| 0 | Access Control | Role reconciliation report | No tooling to detect MySQL vs Supabase mismatch | New endpoint `GET /api/access/roles/reconcile` — returns users in Supabase not in MySQL and vice versa | `access.routes.ts`, `access.service.ts` | Read-only | New read endpoint | None (admin tool) | Admin only | Run reconcile; verify mismatches detected | Low — read-only | ⬜ PENDING | NO |
| 0 | Access Control | Negative API access tests | No automated tests for RBAC enforcement | Add Vitest tests: user with Supabase role but no MySQL role → 403 | `backend/tests/access.test.ts` (new) | None | Verifies existing `requireRole` | None | All | Tests pass | Low | ⬜ PENDING | NO |

### 0.5 — Portal Security Fixes

| Phase | Module | Task | Current State | Planned Change | Files Affected | DB Impact | API Impact | Frontend Impact | Roles Impacted | Test Required | Risk | Status | Approval Required |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 0 | Portal | Write `portal_access_log` on every client request | Table defined, never written | Add INSERT to `portal.controller.ts` on authenticated client routes | `backend/src/modules/portal/portal.controller.ts` | `portal_access_log` INSERT per request | No change to response shape | None | Client users | Login via OTP; verify row in `portal_access_log` | Low | ⬜ PENDING | NO |
| 0 | Portal | Env-gate demo bypass | `demo@mascallnet.com` issues JWT unconditionally | Gate behind `DEMO_MODE=true` env var | `backend/src/modules/portal/portal.auth.service.ts`, `backend/.env.example` | None | OTP endpoint behaviour unchanged unless `DEMO_MODE=true` | None | Client portal | Test with `DEMO_MODE` unset — demo email must follow OTP flow | Low | ⬜ PENDING | NO |

### 0.6 — Payroll Foundation Fixes

> **PROTECTED:** Payroll marked foundation-only. No statutory, gratuity, or F&F changes until full testing passes.

| Phase | Module | Task | Current State | Planned Change | Files Affected | DB Impact | API Impact | Frontend Impact | Roles Impacted | Test Required | Risk | Status | Approval Required |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 0 | Payroll | Fix LWP deduction in calc | `lwp_days` populated but deduction not applied | Compute `lwp_deduction = lwp_days × (ctc_annual/12 / working_days)`; subtract from `net_salary` | `backend/src/modules/payroll/payrollCalculate.service.ts` | Updates `salary_prep_line.net_salary` | `POST /api/payroll/runs/:id/calculate` returns corrected net | Payroll review screen shows correct net | HR, Admin | Calculate run; verify employee with 2 LWP days has correct deduction | Medium — changes calc output | ⬜ PENDING | NO (local); YES (run against production data) |
| 0 | Payroll | Basic TDS stub from `statutory_config` | TDS hardcoded `0` | Compute annualized taxable income; apply basic slab from `statutory_config`; write to `salary_prep_line.tds` | `backend/src/modules/payroll/payrollCalculate.service.ts` | Updates `salary_prep_line.tds` | Calc endpoint returns TDS values | Payroll review shows TDS column | HR, Admin | Verify TDS > 0 for employee above exemption threshold | Medium | ⬜ PENDING | NO (local); YES (production run) |
| 0 | Payroll | Wire advance deduction | `salary_advance_log` exists; not read during calc | Query unrecovered advances for employee; deduct from net; mark as recovered | `backend/src/modules/payroll/payrollCalculate.service.ts` | Reads `salary_advance_log`; updates `recovered_amount` | Calc endpoint deducts advances | Payroll review shows advance line | HR, Admin | Employee with advance shows deduction; advance marked recovered | Medium | ⬜ PENDING | NO (local); YES (production run) |

---

## Phase 1 — ATS Completion

| Phase | Module | Task | Current State | Planned Change | Files Affected | DB Impact | API Impact | Frontend Impact | Roles Impacted | Test Required | Risk | Status | Approval Required |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | ATS | Add routes for missing ATS pages | `NativeATSCandidateMaster`, `NativeATSOnboardingBridge`, `NativeATSWaitingQueue`, `NativeATSRecruiterWorkspace`, `NativeATSDashboardV2`, `NativeATSDashboardReplica` exist but not routed | Add routes in `App.tsx` with appropriate Gate page codes | `src/App.tsx` | None | None | Pages become accessible | Admin, HR, Recruiter | Navigate each route; verify Gate enforces correct role | Low | 🔵 DEFERRED | NO |
| 1 | ATS | ATS sourcing analysis page | Routes to NativePlaceholderPage | Build actual sourcing analysis view | `src/pages/NativeATSSourcingAnalysis.tsx` (new) | None | `GET /api/ats/sourcing-analysis` (new) | New page | Admin, HR, Recruiter | Page loads; data renders | Low | 🔵 DEFERRED | NO |

---

## Phase 2 — WFM Completion

| Phase | Module | Task | Current State | Planned Change | Files Affected | DB Impact | API Impact | Frontend Impact | Roles Impacted | Test Required | Risk | Status | Approval Required |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2 | WFM | Quality Dashboard | Placeholder | Build quality metrics view (reads from call-master-backend) | TBD | None (read-only) | New proxy endpoints | New page | Admin, QA, Manager | Page loads; KPIs visible | Medium | 🔵 DEFERRED | NO |
| 2 | WFM | Operations Dashboard | Placeholder | Build operations view | TBD | None | TBD | New page | Admin, Manager | TBD | Medium | 🔵 DEFERRED | NO |
| 2 | WFM | Biometric device integration (`wfm_facial_device_master`) | Table defined; no device wiring | Connect device events to `wfm_attendance_session` | TBD | `wfm_attendance_session` | New device webhook endpoint | Live Tracker updates automatically | Admin, WFM | Punch event creates session | High | 🔵 DEFERRED | YES |

---

## Phase 3 — Payroll Completion

> **PROTECTED:** No production payroll run changes without statutory testing, F&F testing, and explicit approval per run.

| Phase | Module | Task | Current State | Planned Change | Files Affected | DB Impact | API Impact | Frontend Impact | Roles Impacted | Test Required | Risk | Status | Approval Required |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 3 | Payroll | Professional Tax state slab | Fixed ₹200 | Read PT slab from `statutory_config` per employee state | `payrollCalculate.service.ts` | None | Calc returns correct PT | Payroll review shows correct PT | HR, Admin | Employee in PT-exempt state shows ₹0 | Medium | 🔵 DEFERRED | NO (local); YES (production) |
| 3 | Payroll | Server-side payslip generation | Client-side jsPDF only | Generate PDF server-side; store reference in `salary_payslip` | `backend/src/modules/payroll/payslip.service.ts` (new) | Writes `salary_payslip` | `GET /api/payroll/payslip/:runId/:employeeId` | Download link in UI | Employee, HR | Download payslip; verify correct data | Medium | 🔵 DEFERRED | NO |
| 3 | Payroll | Disbursement bank reference | `disbursed_by/at` fields exist; no bank ref | Add `bank_ref` field; record on status → `disbursed` | `backend/sql` (ALTER), `payroll.service.ts` | ALTER `salary_prep_run` | Status update endpoint | Disbursement confirmation UI | Admin | Verify bank ref stored on disburse | Medium | 🔵 DEFERRED | YES (ALTER on production) |
| 3 | Payroll | F&F (Full and Final) settlement | Not built | Full and final calc on exit: pending leaves, advances, dues | New service + SQL | New tables | New endpoints | New page | HR, Admin | F&F calc matches expected values | High | 🔵 DEFERRED | YES |
| 3 | Payroll | Gratuity calculation | Not built | Per statutory rules (5yr threshold, 15/26 formula) | New service | None (read-only calc) | New endpoint | Gratuity display on payslip | HR, Admin | Verify gratuity formula correct | High | 🔵 DEFERRED | YES |

---

## Phase 4 — LMS Integration

> **LMS is integration-only. Do not build a second operational LMS. Native Supabase lms_* tables are protected until integration is tested.**

| Phase | Module | Task | Current State | Planned Change | Files Affected | DB Impact | API Impact | Frontend Impact | Roles Impacted | Test Required | Risk | Status | Approval Required |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 4 | LMS | Confirm bridge contract with LMS team | `VITE_LMS_API_URL` placeholder; bridge shape unknown | Document `POST /api/auth/bridge` request/response contract | `docs/peopleos-build/LMS_INTEGRATION_BLUEPRINT.md` (update) | None | None | None | None | None | None | 🔵 DEFERRED | NO |
| 4 | LMS | Backend LMS proxy module | No `/api/lms` backend module | Add `backend/src/modules/lms-proxy/` — forwards requests to deployed LMS with bridge token | New module | None | New `/api/lms/*` endpoints | LMS pages call hrmsApi instead of direct Supabase | All LMS roles | Proxy returns LMS data; token refreshes on expiry | Medium | 🔵 DEFERRED | NO |
| 4 | LMS | LMS Management Dashboard | Placeholder | Wire `NativeLMSManagementDashboard` via proxy | `src/pages/NativeLMSManagementDashboard.tsx` | None | Via proxy | Page loads | Admin, HR, Manager | Dashboard renders training metrics | Medium | 🔵 DEFERRED | NO |
| 4 | LMS | Supabase native LMS deprecation | lms_* tables active | Redirect native pages to proxy after integration tested | `src/pages/NativeLMS*.tsx`, Supabase migrations | Supabase DROP (after testing) | None | Native LMS pages hit deployed LMS | All LMS roles | Full regression on all 4 LMS pages | High | 🔵 DEFERRED | YES |

---

## Phase 5 — Asset and Document Convergence

> **PROTECTED until tested backend convergence path exists.**

| Phase | Module | Task | Current State | Planned Change | Files Affected | DB Impact | API Impact | Frontend Impact | Roles Impacted | Test Required | Risk | Status | Approval Required |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 5 | Assets | MySQL schema for assets | Supabase only | New SQL file `015_assets.sql` | New SQL file | Additive | None yet | None yet | Admin, HR | Table creation on local MySQL | Low | 🔵 DEFERRED | NO (local); YES (production) |
| 5 | Assets | Backend `/api/assets` module | No backend route | New module mirroring `useAssets.ts` structure | New module | Reads/writes new MySQL table | New `/api/assets` endpoints | `useAssets.ts` feature-flagged to backend | Admin, HR | CRUD operations on assets | Medium | 🔵 DEFERRED | NO |
| 5 | Assets | Migrate Supabase assets → MySQL | Data in Supabase | One-click migration via migration console | `migration.service.ts` | Writes MySQL `assets` | Migration endpoint | None | Admin | Counts match pre/post | Medium | 🔵 DEFERRED | YES |
| 5 | Documents | MySQL schema for documents | Supabase only | New SQL file with `employee_documents` schema | New SQL file | Additive | None yet | None yet | Admin, HR | Table creation | Low | 🔵 DEFERRED | NO (local); YES (production) |
| 5 | Documents | Backend `/api/documents` module | No backend route | New module; Supabase Storage stays for file blobs | New module | New MySQL metadata table | New `/api/documents` endpoints | `useEmployeeDocuments.ts` feature-flagged | Admin, HR, Employee | Upload; verify metadata in MySQL; file in Storage | Medium | 🔵 DEFERRED | NO |

---

## Phase 6 — Performance and Goals Convergence

| Phase | Module | Task | Current State | Planned Change | Files Affected | DB Impact | API Impact | Frontend Impact | Roles Impacted | Test Required | Risk | Status | Approval Required |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 6 | Performance | MySQL schema for goals + reviews | Supabase only | New SQL file | New SQL | Additive | None yet | None | Admin, HR, Manager | Table creation | Low | 🔵 DEFERRED | NO (local) |
| 6 | Performance | Backend `/api/performance` module | No backend route | New module | New module | MySQL `goals`, `performance_reviews` | New endpoints | Feature-flagged hooks | All | CRUD; review workflow | Medium | 🔵 DEFERRED | NO |

---

## Phase 7 — Integration Hub Enhancements

| Phase | Module | Task | Current State | Planned Change | Files Affected | DB Impact | API Impact | Frontend Impact | Roles Impacted | Test Required | Risk | Status | Approval Required |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 7 | Integration Hub | SFTP adapter | Architecture defined; not built | Implement `adapters/sftpAdapter.ts` | New adapter | None (staging table) | Integration run with SFTP type works | Integration config UI shows SFTP option | Admin | SFTP pull test with mock server | Medium | 🔵 DEFERRED | NO |
| 7 | Integration Hub | Credential Vault (Supabase Vault) | `secret_name` stored; Vault fetch not implemented | Implement `vaultService.ts` fetching Supabase Vault secrets at runtime | New service | None | Secrets never logged | None | Admin | Secret fetched; never appears in logs | High — security | 🔵 DEFERRED | YES |
| 7 | Integration Hub | Dialer sync scheduler | `integration_schedule` table exists; cron not wired | Add `node-cron` runner in `server.ts` | `backend/src/server.ts` | Updates `next_run_at` | None (background) | None | Admin | Scheduled run fires at correct time | Medium | 🔵 DEFERRED | NO |

---

## Phase 8 — Migration Console Completion

| Phase | Module | Task | Current State | Planned Change | Files Affected | DB Impact | API Impact | Frontend Impact | Roles Impacted | Test Required | Risk | Status | Approval Required |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 8 | Migration | Supabase → MySQL migration logic | `migration.service.ts` counts rows only | Implement page-read → transform → validate → batch INSERT per module | `migration.service.ts` | Writes `migration_run`, `migration_row_log`, target tables | `POST /api/migration/run` | Console shows progress | Admin | Migrate 10 test rows; verify MySQL count matches Supabase | High — data integrity | 🔵 DEFERRED | YES (any prod Supabase data read) |

---

## Phase 9 — Client Portal Enhancements

| Phase | Module | Task | Current State | Planned Change | Files Affected | DB Impact | API Impact | Frontend Impact | Roles Impacted | Test Required | Risk | Status | Approval Required |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 9 | Portal | `portal_otp` cleanup job | OTP records accumulate; never deleted | Add cron or scheduled DELETE for `used=1` or `expires_at < NOW() - 7 days` | `portal.auth.service.ts` or new cron | DELETE on `portal_otp` | None | None | None | Verify old records cleared; valid records retained | Low | 🔵 DEFERRED | NO |
| 9 | Portal | Portal client user management UI | No admin UI to create `client_user` records | New internal admin page for portal user CRUD | New page | `client_user` CRUD | Existing internal portal endpoints | New settings page | Admin | Create user; verify portal login works | Low | 🔵 DEFERRED | NO |

---

## Phase 10 — Supabase Decommission (Operational Data)

> **All steps in Phase 10 require explicit approval. No Supabase table drops until MySQL parity tested.**

| Phase | Module | Task | Current State | Planned Change | Files Affected | DB Impact | API Impact | Frontend Impact | Roles Impacted | Test Required | Risk | Status | Approval Required |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 10 | All | Feature-flag cutover per module | Each module has `VITE_HRMS_*` flag | Flip each flag to `backend` after MySQL data verified | `.env.example` + Vercel env vars | None | Switches hook data source | Module fetches from MySQL | All | Full regression per module | High | 🔵 DEFERRED | YES per module |
| 10 | All | Drop Supabase operational tables | Supabase tables still live | DROP after migration + cutover verified | Supabase migration files | Destructive | None | None | All | Verify no frontend hook reads Supabase table post-cutover | Critical | 🔵 DEFERRED | YES per table |
| 10 | Auth | Supabase Auth stays permanently | — | Supabase Auth is not decommissioned | — | — | — | — | — | — | — | 🔒 PROTECTED | — |
| 10 | LMS | Supabase lms_* deprecation | Native lms_* tables active | Drop only after LMS proxy integration tested (Decision 2A) | Supabase migrations | Destructive | None | LMS pages via proxy only | All LMS roles | Full LMS regression via proxy | High | 🔵 DEFERRED | YES |

---

## Protected Flows (Do Not Modify Without Explicit Decision)

| Flow | Location | Protection Reason |
|---|---|---|
| Supabase Auth (identity) | `src/integrations/supabase/client.ts`, `backend/src/middleware/authMiddleware.ts` | Core authentication — any change breaks all logins |
| Asset management (Supabase) | `src/hooks/useAssets.ts`, `src/pages/Assets.tsx` | No MySQL convergence path tested yet |
| Document management (Supabase Storage) | `src/hooks/useEmployeeDocuments.ts` | No MySQL/Storage convergence path tested |
| Performance/Goals (Supabase) | `src/hooks/usePerformance.ts` and related | No MySQL convergence path tested |
| Legacy attendance pages (Supabase) | `src/pages/Attendance.tsx`, `src/pages/AttendanceRegularization.tsx` | Supabase-backed; WFM MySQL path is separate |
| Supabase lms_* tables | `src/pages/NativeLMSAdmin.tsx`, `NativeLMSMyLearning.tsx`, `NativeLMSCoordinator.tsx` | Decision 2A — native LMS preserved until bridge deployed |
| Supabase Edge Functions (13) | `supabase/functions/` | Email + notification delivery; disruption = user-facing failures |
| All production environment files | Any `.env` in Railway / Vercel / server | Never modified autonomously |
| Payroll production runs | `salary_prep_run`, `salary_prep_line` on production DB | Financial data — requires approval per run |
