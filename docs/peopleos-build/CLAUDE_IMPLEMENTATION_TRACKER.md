# MAS Callnet PeopleOS — Implementation Tracker

> **Last updated:** 2026-05-29  
> **Source of truth:** This file. Update on every task completion or decision change.  
> **Production safety:** Rows marked `Approval Required: YES` must not be executed without explicit written approval.

> **Approval-control rule:** Every implementation task that changes code, schema, API behaviour, environment/configuration, data writes, access control, integrations, deployment settings or user-visible functionality requires an approved package before execution, even when local-only. The "Approval Required" column identifies additional task-specific approval and must never be interpreted as permission for autonomous implementation.

> ⚠️ **Process-control deviation recorded 2026-05-29:** Required KPI and Client Portal schema objects were created in the target PeopleOS application database (`mas_hrms`) before the approval checkpoint was completed during Package 0-A. No changes were made to upstream operational source databases. Further schema execution on `mas_hrms` is frozen pending approval. Merge pending reconciliation. See `PHASE_0_AUDIT_REPORT.md`.

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

## Phase 0 — Stabilisation, Database Boundary and Security Design

### 0.1 — SQL Schema Fixes

| Phase | Module | Task | Current State | Planned Change | Files Affected | DB Impact | API Impact | Frontend Impact | Roles Impacted | Test Required | Risk | Status | Approval Required |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 0 | Schema | Fix `000_run_all.sql` — add missing `010_kpi.sql` and `012_client_portal.sql` sources | Runner missing 2 files; KPI and Client Portal tables never created on fresh schema run | Inserted both SOURCE lines in correct dependency order; no renames | `backend/sql/000_run_all.sql` | ⚠️ Process-control deviation: Schema applied to `mas_hrms` (target PeopleOS application DB) before approval checkpoint completed 2026-05-29. +15 intended application tables (5 KPI + 10 portal). 63 → 78 total. No upstream operational source databases modified. No rollback required or approved. Merge frozen pending reconciliation. | None | None | All | 493/493 backend tests pass; frontend build clean | Low — all `CREATE TABLE IF NOT EXISTS`; idempotent | ✅ DONE (⚠️ process-control deviation) | Was required — not obtained before execution. No manual production deployment command was executed. Opening/updating the pull request triggered an automatic Vercel preview build/deployment through the repository integration. No frontend application-source changes are included in this PR. |
| 0 | Schema | ~~Rename `010_kpi_migration.sql`~~ | **Superseded** — renaming not approved; runner fix addresses the gap without renames | No renames until migration/deployment history verified | — | — | — | — | — | — | — | 🚫 BLOCKED (not approved) | YES |
| 0 | Schema | ~~Rename `012_roster_shift_times.sql`~~ | **Superseded** — same reason | — | — | — | — | — | — | — | — | 🚫 BLOCKED (not approved) | YES |
| 0 | Schema | Verify `migration_run` + `migration_row_log` tables | Tables already exist — created by `backend/sql/010_kpi_migration.sql` which is now included in the schema runner. Verification only; no new schema build required | Run read-only query to confirm both tables exist and have correct columns | No new files — tables already present in existing SQL | Read-only verification only | None | None | Admin | Run `SHOW TABLES LIKE 'migration%'` and `DESCRIBE migration_run` after schema runner executes; confirm columns match expected schema | Low — read-only | ⬜ PENDING (verify via read-only query after approval) | NO |

### 0.2 — Environment and Config Fixes

| Phase | Module | Task | Current State | Planned Change | Files Affected | DB Impact | API Impact | Frontend Impact | Roles Impacted | Test Required | Risk | Status | Approval Required |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 0 | Config | Investigate mismatched Supabase reference in `backend/.env.example` | `unanckifivwkziwvnjtc` in `backend/.env.example` — purpose unverified; may be obsolete or staging reference | Verify environment purpose; propose correction only after verification | `backend/.env.example` | None | None | None | None | Documentation/design verification first; no config edit until purpose confirmed | Low — example file only; no production env touched | ⬜ PENDING | YES before any configuration edit |
| 0 | Config | Investigate `supabase/config.toml` project_id `ppdsxgkmnmjfwmpnamts` | Unresolved Supabase CLI/config reference; purpose not yet confirmed | Verify whether this is intentional CLI tooling reference or incorrect value before any change | `supabase/config.toml` | None | None | None | None | Verification first | None | ⬜ PENDING | YES before any value change |

### 0.3 — Route Validation Notes

> The routes below previously appeared as broken-route defects. This classification has been removed. Both routes resolve through active wrapper components. Any direct route wiring is optional refactoring only, not a Phase 0 defect.

| Phase | Module | Task | Current State | Planned Change | Files Affected | DB Impact | API Impact | Frontend Impact | Roles Impacted | Test Required | Risk | Status | Approval Required |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 0 | LMS | `/lms/admin` route — transitional wrapper note | Transitional native LMS route already resolves through `NativePlaceholderPage`. Direct routing to `NativeLMSAdmin` is optional refactoring only after LMS integration design and runtime validation. Not a Phase 0 defect. Moved to Phase 6 as optional refactor. | No change in Phase 0 | — | None | None | None | — | — | None | 🔵 DEFERRED to Phase 6 | NO |
| 0 | WFM | `/wfm/live-tracker` route — transitional wrapper note | Current route resolves through an active wrapper (`NativePlaceholderPage`). Runtime and data behaviour requires validation; direct route wiring is optional refactoring and not a confirmed Phase 0 defect. Moved to Phase 4 as optional refactor. | No change in Phase 0 | — | None | None (API already live) | None | — | — | None | 🔵 DEFERRED to Phase 4 | NO |

### 0.4 — RBAC Authority Design (Decision 1)

| Phase | Module | Task | Current State | Planned Change | Files Affected | DB Impact | API Impact | Frontend Impact | Roles Impacted | Test Required | Risk | Status | Approval Required |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 0 | Access Control | Read-only role-assignment reconciliation between MySQL backend-authoritative roles and Supabase transitional role records. Page-access and assignment-scope reconciliation remains a later enhancement. | ⚠️ PARTIAL (Package 0-B). `GET /api/access/rbac-reconciliation` implemented and working (admin-only, read-only). Compares MySQL `user_roles` against Supabase `user_roles` and reports mismatches. No writes, no backfill, no automatic syncing. Page-access reconciliation (`role_page_access`) and assignment-scope reconciliation not in scope here. | Read-only reconciliation implemented: `backend/src/modules/access/access.service.ts` + `access.routes.ts` — admin-only, no writes | `backend/src/modules/access/access.service.ts` (new), `backend/src/modules/access/access.routes.ts` (new), `backend/src/app.ts` | Read-only — no DB writes | `GET /api/access/rbac-reconciliation` implemented and live | None | Admin only | 8 RBAC reconciliation tests passing (access.rbac.test.ts) | Medium — read-only, safe | ⚠️ PARTIAL — role-assignment reconciliation done; role-write design pending | YES before any write/backfill implementation |

### 0.5 — Portal Security Fixes

| Phase | Module | Task | Current State | Planned Change | Files Affected | DB Impact | API Impact | Frontend Impact | Roles Impacted | Test Required | Risk | Status | Approval Required |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 0 | Portal | Write `portal_access_log` on every client request | ✅ DONE (Package 0-B). Added `logAccess` to all 9 authenticated client endpoints in `portal.controller.ts`. Logs: `client_user_id`, `page`, `ip_address`. No PII, no tokens. | Implemented in Package 0-B | `backend/src/modules/portal/portal.controller.ts` | `portal_access_log` INSERT per authenticated request | No change to response shape | None | Client users | 5 logAccess tests passing (portal.security.test.ts) | Low | ✅ DONE | Was required — obtained in Package 0-B |
| 0 | Portal | Env-gate demo bypass | ✅ DONE (Package 0-B). Added `PORTAL_DEMO_BYPASS` env var (default `"false"`). Added `isDemoBypassEnabled()` to auth service. Production default is secure — no bypass without explicit flag. | Implemented in Package 0-B | `backend/src/config/env.ts`, `backend/src/modules/portal/portal.auth.service.ts` | None | OTP endpoint behaviour unchanged in production | None | Client portal | 3 bypass tests passing (portal.security.test.ts) | Low | ✅ DONE | Was required — obtained in Package 0-B |

---

## Phase 1 — Organisation Masters, Roles/Scopes, Workflow Engine and Audit Framework

> Tasks for this phase are to be defined following completion of Phase 0 RBAC design. RBAC implementation tasks will be promoted from Phase 0 design output after approval.

| Phase | Module | Task | Current State | Planned Change | Files Affected | DB Impact | API Impact | Frontend Impact | Roles Impacted | Test Required | Risk | Status | Approval Required |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Access Control | Implement MySQL-authoritative RBAC (promoted from Phase 0 design) | Phase 0 design output required first. Implementation covers: `GET/POST/DELETE /api/access/roles`, role reconciliation report endpoint, and negative API access tests | Implement per approved design from Phase 0 | Per approved design | Per approved design | Per approved design | Per approved design | Admin only | Per approved design test plan | Medium — touches auth layer | 🔵 DEFERRED (awaiting Phase 0 design approval) | YES |

---

## Phase 2 — Employee Lifecycle, Documents, Assets and Helpdesk

> **PROTECTED until tested backend convergence path exists.**

| Phase | Module | Task | Current State | Planned Change | Files Affected | DB Impact | API Impact | Frontend Impact | Roles Impacted | Test Required | Risk | Status | Approval Required |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2 | Assets | MySQL schema for assets | Supabase only | New SQL file `015_assets.sql` | New SQL file | Additive | None yet | None yet | Admin, HR | Table creation on local MySQL | Low | 🔵 DEFERRED | YES before implementation |
| 2 | Assets | Backend `/api/assets` module | No backend route | New module mirroring `useAssets.ts` structure | New module | Reads/writes new MySQL table | New `/api/assets` endpoints | `useAssets.ts` feature-flagged to backend | Admin, HR | CRUD operations on assets | Medium | 🔵 DEFERRED | YES before implementation |
| 2 | Assets | Migrate Supabase assets → MySQL | Data in Supabase | One-click migration via migration console | `migration.service.ts` | Writes MySQL `assets` | Migration endpoint | None | Admin | Counts match pre/post | Medium | 🔵 DEFERRED | YES |
| 2 | Documents | MySQL schema for documents | Supabase only | New SQL file with `employee_documents` schema | New SQL file | Additive | None yet | None yet | Admin, HR | Table creation | Low | 🔵 DEFERRED | YES before implementation |
| 2 | Documents | Backend `/api/documents` module | No backend route | New module; Supabase Storage stays for file blobs | New module | New MySQL metadata table | New `/api/documents` endpoints | `useEmployeeDocuments.ts` feature-flagged | Admin, HR, Employee | Upload; verify metadata in MySQL; file in Storage | Medium | 🔵 DEFERRED | YES before implementation |

---

## Phase 3 — ATS and Joining Ecosystem

| Phase | Module | Task | Current State | Planned Change | Files Affected | DB Impact | API Impact | Frontend Impact | Roles Impacted | Test Required | Risk | Status | Approval Required |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 3 | ATS | Add routes for missing ATS pages | `NativeATSCandidateMaster`, `NativeATSOnboardingBridge`, `NativeATSWaitingQueue`, `NativeATSRecruiterWorkspace`, `NativeATSDashboardV2`, `NativeATSDashboardReplica` exist but not routed | Add routes in `App.tsx` with appropriate Gate page codes | `src/App.tsx` | None | None | Pages become accessible | Admin, HR, Recruiter | Navigate each route; verify Gate enforces correct role | Low | 🔵 DEFERRED | YES before implementation |
| 3 | ATS | ATS sourcing analysis page | Routes to NativePlaceholderPage | Build actual sourcing analysis view | `src/pages/NativeATSSourcingAnalysis.tsx` (new) | None | `GET /api/ats/sourcing-analysis` (new) | New page | Admin, HR, Recruiter | Page loads; data renders | Low | 🔵 DEFERRED | YES before implementation |

---

## Phase 4 — Attendance, Leave, WFM, Roster, Shrinkage and Attrition

| Phase | Module | Task | Current State | Planned Change | Files Affected | DB Impact | API Impact | Frontend Impact | Roles Impacted | Test Required | Risk | Status | Approval Required |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 4 | WFM | Wire `/wfm/live-tracker` — optional direct route refactor | Current route resolves through an active wrapper (`NativePlaceholderPage`). Backend service and API already exist. Direct route wiring is optional refactoring; runtime and data behaviour requires validation before wiring. | Change route target in `App.tsx` after runtime validation | `src/App.tsx` | None | None (API already live) | WFM Live Tracker page loads directly | Admin, HR, WFM | Navigate to `/wfm/live-tracker`; verify live data loads from `/api/wfm/live` | Low — backend already complete | 🔵 DEFERRED | YES before implementation |
| 4 | WFM | Quality Dashboard | Placeholder | Build quality metrics view (reads from call-master-backend) | TBD | None (read-only) | New proxy endpoints | New page | Admin, QA, Manager | Page loads; KPIs visible | Medium | 🔵 DEFERRED | YES before implementation |
| 4 | WFM | Operations Dashboard | Placeholder | Build operations view | TBD | None | TBD | New page | Admin, Manager | TBD | Medium | 🔵 DEFERRED | YES before implementation |
| 4 | WFM | Biometric device integration (`wfm_facial_device_master`) | Table defined; no device wiring | Connect device events to `wfm_attendance_session` | TBD | `wfm_attendance_session` | New device webhook endpoint | Live Tracker updates automatically | Admin, WFM | Punch event creates session | High | 🔵 DEFERRED | YES |

---

## Phase 5 — Payroll, Statutory, Payslip, Gratuity and Full-and-Final Completion

> **PROTECTED:** No production payroll run changes without statutory testing, F&F testing, and explicit approval per run.

> The following payroll coding tasks are audit-identified gaps. No implementation is approved for Phase 0. All payroll implementation is deferred to this phase. "Basic TDS stub" is a gap note only — it is not an approved implementation task.

| Phase | Module | Task | Current State | Planned Change | Files Affected | DB Impact | API Impact | Frontend Impact | Roles Impacted | Test Required | Risk | Status | Approval Required |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 5 | Schema | Add `salary_payslip` table | Table missing from all SQL files; payslip logic has no write target. Gap identified in Phase 0 audit. | New file `backend/sql/013_salary_payslip.sql` with table definition | `backend/sql/013_salary_payslip.sql` (new), `backend/sql/000_run_all.sql` | Additive — new table only | None yet | None yet | HR, Admin | Apply to local MySQL; verify table creation | Low — additive | 🔵 DEFERRED | YES before implementation |
| 5 | Payroll | Fix LWP deduction in calc | Gap identified in Phase 0 audit: `lwp_days` populated but deduction not applied | Compute `lwp_deduction = lwp_days × (ctc_annual/12 / working_days)`; subtract from `net_salary` | `backend/src/modules/payroll/payrollCalculate.service.ts` | Updates `salary_prep_line.net_salary` | `POST /api/payroll/runs/:id/calculate` returns corrected net | Payroll review screen shows correct net | HR, Admin | Calculate run; verify employee with 2 LWP days has correct deduction | Medium — changes calc output | 🔵 DEFERRED | YES before implementation |
| 5 | Payroll | TDS gap — gap note only, not approved implementation | Gap identified in Phase 0 audit: TDS hardcoded `0`. No implementation approved. Design required before any TDS coding begins. | Design statutory TDS calculation approach; implementation requires separate approval | — | — | — | — | HR, Admin | — | Medium | 🔵 DEFERRED | YES before any implementation |
| 5 | Payroll | Wire advance deduction | Gap identified in Phase 0 audit: `salary_advance_log` exists; not read during calc | Query unrecovered advances for employee; deduct from net; mark as recovered | `backend/src/modules/payroll/payrollCalculate.service.ts` | Reads `salary_advance_log`; updates `recovered_amount` | Calc endpoint deducts advances | Payroll review shows advance line | HR, Admin | Employee with advance shows deduction; advance marked recovered | Medium | 🔵 DEFERRED | YES before implementation |
| 5 | Payroll | Professional Tax state slab | Fixed ₹200 | Read PT slab from `statutory_config` per employee state | `payrollCalculate.service.ts` | None | Calc returns correct PT | Payroll review shows correct PT | HR, Admin | Employee in PT-exempt state shows ₹0 | Medium | 🔵 DEFERRED | YES before implementation |
| 5 | Payroll | Server-side payslip generation | Client-side jsPDF only | Generate PDF server-side; store reference in `salary_payslip` | `backend/src/modules/payroll/payslip.service.ts` (new) | Writes `salary_payslip` | `GET /api/payroll/payslip/:runId/:employeeId` | Download link in UI | Employee, HR | Download payslip; verify correct data | Medium | 🔵 DEFERRED | YES before implementation |
| 5 | Payroll | Disbursement bank reference | `disbursed_by/at` fields exist; no bank ref | Add `bank_ref` field; record on status → `disbursed` | `backend/sql` (ALTER), `payroll.service.ts` | ALTER `salary_prep_run` | Status update endpoint | Disbursement confirmation UI | Admin | Verify bank ref stored on disburse | Medium | 🔵 DEFERRED | YES (ALTER on production) |
| 5 | Payroll | F&F (Full and Final) settlement | Not built | Full and final calc on exit: pending leaves, advances, dues | New service + SQL | New tables | New endpoints | New page | HR, Admin | F&F calc matches expected values | High | 🔵 DEFERRED | YES |
| 5 | Payroll | Gratuity calculation | Not built | Per statutory rules (5yr threshold, 15/26 formula) | New service | None (read-only calc) | New endpoint | Gratuity display on payslip | HR, Admin | Verify gratuity formula correct | High | 🔵 DEFERRED | YES |

---

## Phase 6 — LMS Integration Only

> **LMS is integration-only. Do not build a second operational LMS. Native Supabase lms_* tables are protected until integration is tested.**

| Phase | Module | Task | Current State | Planned Change | Files Affected | DB Impact | API Impact | Frontend Impact | Roles Impacted | Test Required | Risk | Status | Approval Required |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 6 | LMS | Determine approved LMS integration mechanism and required configuration | LMS integration mode is pending discovery and design — integration mechanism not yet approved. Do not add frontend LMS API variables during Phase 0. Approved mechanism may be: secured backend API, scheduled sync, connector, deep-link, or SSO. Required configuration keys will be defined as part of this design task. | Produce LMS integration design document covering approved mechanism, required env vars, security model, and configuration requirements | Design document only — no code or config files until mechanism is approved | None | None | None | None | Design review only | None | 🔵 DEFERRED to Phase 6 | NO (design); YES (any implementation) |
| 6 | LMS | Wire `/lms/admin` — optional direct route refactor | Transitional native LMS route already resolves through `NativePlaceholderPage`. Direct routing to `NativeLMSAdmin` is optional refactoring only after LMS integration design and runtime validation. | Change route target in `App.tsx` after integration design approved | `src/App.tsx` | None | None | LMS Admin page loads directly; reads Supabase `lms_*` (Decision 2A) | Admin, HR | Navigate to `/lms/admin`; verify page loads; verify Gate enforced | Low — Decision 2A: Supabase native LMS stays; page already built | 🔵 DEFERRED to Phase 6 | YES before implementation |
| 6 | LMS | Confirm bridge contract with LMS team | Bridge shape unknown | Document `POST /api/auth/bridge` request/response contract | `docs/peopleos-build/LMS_INTEGRATION_BLUEPRINT.md` (update) | None | None | None | None | None | None | 🔵 DEFERRED | NO (design/doc only) |
| 6 | LMS | Backend LMS proxy module | No `/api/lms` backend module | Add `backend/src/modules/lms-proxy/` — forwards requests to deployed LMS with bridge token | New module | None | New `/api/lms/*` endpoints | LMS pages call hrmsApi instead of direct Supabase | All LMS roles | Proxy returns LMS data; token refreshes on expiry | Medium | 🔵 DEFERRED | YES before implementation |
| 6 | LMS | LMS Management Dashboard | Placeholder | Wire `NativeLMSManagementDashboard` via proxy | `src/pages/NativeLMSManagementDashboard.tsx` | None | Via proxy | Page loads | Admin, HR, Manager | Dashboard renders training metrics | Medium | 🔵 DEFERRED | YES before implementation |
| 6 | LMS | Supabase native LMS deprecation | lms_* tables active | Redirect native pages to proxy after integration tested | `src/pages/NativeLMS*.tsx`, Supabase migrations | Supabase DROP (after testing) | None | Native LMS pages hit deployed LMS | All LMS roles | Full regression on all 4 LMS pages | High | 🔵 DEFERRED | YES |

---

## Phase 7 — Operations, Quality, Call Master and Performance

| Phase | Module | Task | Current State | Planned Change | Files Affected | DB Impact | API Impact | Frontend Impact | Roles Impacted | Test Required | Risk | Status | Approval Required |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 7 | Performance | MySQL schema for goals + reviews | Supabase only | New SQL file | New SQL | Additive | None yet | None | Admin, HR, Manager | Table creation | Low | 🔵 DEFERRED | YES before implementation |
| 7 | Performance | Backend `/api/performance` module | No backend route | New module | New module | MySQL `goals`, `performance_reviews` | New endpoints | Feature-flagged hooks | All | CRUD; review workflow | Medium | 🔵 DEFERRED | YES before implementation |

---

## Phase 8 — Client Portal Hardening

| Phase | Module | Task | Current State | Planned Change | Files Affected | DB Impact | API Impact | Frontend Impact | Roles Impacted | Test Required | Risk | Status | Approval Required |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 8 | Portal | `portal_otp` cleanup job | OTP records accumulate; never deleted | Add cron or scheduled DELETE for `used=1` or `expires_at < NOW() - 7 days` | `portal.auth.service.ts` or new cron | DELETE on `portal_otp` | None | None | None | Verify old records cleared; valid records retained | Low | 🔵 DEFERRED | YES before implementation |
| 8 | Portal | Portal client user management UI | No admin UI to create `client_user` records | New internal admin page for portal user CRUD | New page | `client_user` CRUD | Existing internal portal endpoints | New settings page | Admin | Create user; verify portal login works | Low | 🔵 DEFERRED | YES before implementation |

---

## Phase 9 — ERP Extensions

| Phase | Module | Task | Current State | Planned Change | Files Affected | DB Impact | API Impact | Frontend Impact | Roles Impacted | Test Required | Risk | Status | Approval Required |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 9 | Integration Hub | SFTP adapter | Architecture defined; not built | Implement `adapters/sftpAdapter.ts` | New adapter | None (staging table) | Integration run with SFTP type works | Integration config UI shows SFTP option | Admin | SFTP pull test with mock server | Medium | 🔵 DEFERRED | YES before implementation |
| 9 | Integration Hub | Credential Vault (Supabase Vault) | `secret_name` stored; Vault fetch not implemented | Implement `vaultService.ts` fetching Supabase Vault secrets at runtime | New service | None | Secrets never logged | None | Admin | Secret fetched; never appears in logs | High — security | 🔵 DEFERRED | YES |
| 9 | Integration Hub | Dialer sync scheduler | `integration_schedule` table exists; cron not wired | Add `node-cron` runner in `server.ts` | `backend/src/server.ts` | Updates `next_run_at` | None (background) | None | Admin | Scheduled run fires at correct time | Medium | 🔵 DEFERRED | YES before implementation |

---

## Phase 10 — Migration, Security, UAT and Deployment Readiness

> **All Supabase decommission steps in this phase require explicit approval. No Supabase table drops until MySQL parity tested.**

| Phase | Module | Task | Current State | Planned Change | Files Affected | DB Impact | API Impact | Frontend Impact | Roles Impacted | Test Required | Risk | Status | Approval Required |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 10 | Migration | Supabase → MySQL migration logic | `migration.service.ts` counts rows only | Implement page-read → transform → validate → batch INSERT per module | `migration.service.ts` | Writes `migration_run`, `migration_row_log`, target tables | `POST /api/migration/run` | Console shows progress | Admin | Migrate 10 test rows; verify MySQL count matches Supabase | High — data integrity | 🔵 DEFERRED | YES (any prod Supabase data read) |
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
| Payroll production runs | `salary_prep_run`, `salary_prep_line` on production MySQL host | Financial data — requires approval per run |
