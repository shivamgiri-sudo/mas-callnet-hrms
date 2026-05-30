# CLAUDE_ACTIVE_CONTEXT

**Purpose:** Token-efficient active execution context for Claude Code. Read this first. Do **not** re-read the full master charter every turn unless this file is unclear, conflicts appear, or a hard gate needs interpretation.

**Last updated:** 30-May-2026

---

## 1. Permanent Execution Rule

Start every Claude instruction/work cycle with:

```text
/using-superpowers
```

Execution mode:
- Continue from latest repo state.
- Complete the next incomplete package.
- Validate with the standard full build/test gate.
- Merge if green and no hard gate exists.
- Update this file after each merge.
- Continue to the next package without routine approval.

---

## 2. Architecture Summary

- New PeopleOS business modules are **MySQL-first** using `mas_hrms` through Node/Express APIs.
- Do **not** create new operational/business Supabase tables.
- Supabase may remain transitional for Auth and Storage only.
- Existing deployed LMS is external; build integration/snapshot layer only.
- External SQL/API/file/device sources are future read-only inputs into `mas_hrms` via Integration Hub.
- Client Portal must consume approved aggregate/published data only.

---

## 3. Hard Gates — Stop and Ask

Stop before any of these:

1. SQL execution on staging/live `mas_hrms`.
2. Vercel/production deployment.
3. Hosted secret/env/credential changes.
4. External production DB connection.
5. Live LMS connection/change.
6. Payroll/statutory production activation.
7. Destructive migration or data deletion.
8. Client-visible publication without masking/approval.
9. Unresolved PII/payroll/client data exposure.

Do not stop for routine source code, additive unexecuted migrations, local tests, PR creation, green PR merge, or starting the next package.

---

## 4. Current Merged Baseline

Merged completed work:
- PR #12–#13: Phase 0 schema/security foundation.
- PR #14: organisation/workflow/audit foundation.
- PR #15: employee lifecycle/assets/helpdesk/letters.
- PR #16: ATS + WFM extensions/security fixes.
- PR #17/#19: payroll/F&F foundation plus safety corrections.
- PR #18: management surfaces + portal hardening.
- PR #20: Roster & Shift Governance completed and merged.
- PR #21: Attendance, Leave, WFM and RTA Completion completed and merged.

PR #20 final rules:
- Process Manager + WFM jointly own weekly roster draft→publish in mapped `user_assignment_scope`.
- TL/AM monitor and raise/resolve coverage actions only.
- TL/AM cannot freely edit published roster truth.
- Employee sees/acknowledges own roster only.
- Client Portal receives aggregate roster readiness only.

---

## 5. Current Open Work

Current open package:
- **PR #22 — CEO Demo Readiness: Role Access, Account Control, Workforce Mandate, Capacity Planning**
- Branch: `demo/ceo-role-access-and-capacity-readiness`
- Latest validated head: `97103de04bb7446c28affb5d828b11bf5456a6bd`
- PeopleOS CI Validation: **success**
- PR status: open and mergeable.

PR #22 includes:
- Role catalog and access matrix.
- Account Control APIs and audit logging.
- Workforce Mandate & Capacity Planning APIs.
- Demo seed endpoint, double-gated for non-production.
- Demo login matrix.
- CEO demo auth mapping runbook.
- Vercel deploy workflow changed to manual-only.
- PR validation moved to `.github/workflows/peopleos-ci.yml`.

Important caveat:
- Browser login demo still requires non-production Supabase Auth users and mapping of Supabase Auth UUIDs to `mas_hrms.user_roles`. Follow `docs/demo/CEO_DEMO_AUTH_MAPPING_RUNBOOK.md`.

Next action:
1. If no new hard gate appears, squash-merge PR #22 to `main`.
2. After merge, update this file on `main`.
3. Continue to the remaining full-product packages.

---

## 6. Deployment Workflow State

- `.github/workflows/deploy-vercel.yml` is now **manual-only** using `workflow_dispatch`.
- PR validation is handled by `.github/workflows/peopleos-ci.yml`.
- Do not use Vercel deployment as PR validation.
- Run Vercel only manually when a demo/release URL is explicitly needed.

---

## 7. Next Product Packages After PR #22

Priority order:

1. **Frontend Role Journey Completion**
   - Ensure every role page is actually usable, not only backend-ready.
   - Super Admin, HR, Recruiter, Employee, WFM, Process Manager, AM, TL, QA, Trainer, Payroll, CEO, Client User.

2. **Account Control Production Completion**
   - Supabase Auth reset integration.
   - Admin reset link/temp reset design.
   - Lock/unlock/disable/revoke-session enforcement.
   - MFA/OTP reset design.
   - Full audit trail.

3. **Workforce Mandate & Capacity Planning Production Completion**
   - Real mandate master UI.
   - Support ratio UI.
   - Pipeline/training/LMS snapshot integration.
   - Client Portal aggregate staffing readiness.

4. **Integration Hub Full Build**
   - Manual upload CSV/XLSX.
   - Header mapping.
   - Validation and rejected-row file.
   - SQL/API/file/device connectors.
   - Scheduled sync and data lineage.

5. **LMS Integration Snapshot Layer**
   - LMS user/batch/process mapping.
   - Progress/certification/training projection snapshots.
   - No LMS rebuild.

6. **Client Portal Full Expansion**
   - Client access matrix.
   - Published metrics layer.
   - SOW/SLA, staffing readiness, quality summary, actions/MOM, client requests.
   - Aggregate-only boundary.

7. **Operations + Quality + Call Master Integration**
   - Process performance, quality scorecards, coaching/TNI/CAPA.
   - Client-safe quality summary.

8. **Payroll Production Completion**
   - PF/UAN/ESIC/TDS/gratuity policy validation.
   - Payslip workflow, maker-checker, disbursement export, F&F UAT.

9. **ERP / Benefits / Engagement / Upskilling**
   - Vendor/procurement/expense/contract/cost centre.
   - Benefits, claims, employee pulse, recognition, skills/upskilling analytics.

10. **Health, Compliance, UAT and Deployment Readiness**
    - System/data/security/integration health.
    - Migration/runbook/backup/rollback.
    - Final UAT and controlled deployment.

---

## 8. Standard Validation Gate

Run before every merge:

```bash
npm run build
cd backend
npm run typecheck
npm test
npm run build
```

Required before merge:
- frontend build pass;
- backend typecheck pass;
- all backend tests pass;
- backend production build pass;
- no SQL execution;
- no Vercel deployment unless explicitly requested;
- no external DB/LMS access;
- no secrets committed;
- no sensitive data leakage.

---

## 9. Token-Saving Rule

Use this file for normal continuation. Read the full charter only when:
- this file is incomplete;
- package scope is unclear;
- there is a conflict;
- a hard gate decision is needed;
- a new major product pillar is introduced.

After every successful package merge, update only this file with the new PR/package status and next action.
