import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/authMiddleware.js";
import { requireRole } from "../../middleware/requireRole.js";
import { hasProcessScope } from "../../shared/accessGuard.js";
import { logSensitiveAction } from "../../shared/auditLog.js";
import {
  reconciliationService,
  shrinkageService,
  alertService,
  payrollReadinessService,
  leaveImpactService,
} from "./rta.service.js";
import type { AuthenticatedRequest } from "../../middleware/authMiddleware.js";
import type { Response } from "express";

export const rtaRouter = Router();
rtaRouter.use(requireAuth);

const h = (fn: Function) => (req: any, res: any, next: any) => fn(req, res).catch(next);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ─── Reconciliation ───────────────────────────────────────────────────────────

// POST /api/rta/reconcile — trigger reconciliation for a date
// Requires: admin | hr | wfm | process_manager
rtaRouter.post(
  "/reconcile",
  requireRole("admin", "hr", "wfm", "process_manager"),
  h(async (req: AuthenticatedRequest, res: Response) => {
    const schema = z.object({
      date: z.string().regex(DATE_RE),
      processName: z.string().optional(),
      branchName:  z.string().optional(),
    });
    const { date, processName, branchName } = schema.parse(req.body);

    const result = await reconciliationService.reconcileDate(date, {
      processName, branchName, userId: req.authUser!.id,
    });

    // Fire alerts after reconciliation
    const alertCount = await alertService.fireAlertsForDate(date, { userId: req.authUser!.id });

    // Build shrinkage snapshot
    await shrinkageService.calculateSnapshot(date, { userId: req.authUser!.id });

    void logSensitiveAction({
      actor_user_id: req.authUser!.id,
      action_type: "ATTENDANCE_RECONCILE",
      module_key: "rta",
      entity_type: "reconciliation",
      entity_id: date,
      change_summary: { date, ...result, alerts_fired: alertCount },
      req,
    });

    return res.json({ success: true, data: { ...result, alerts_fired: alertCount } });
  })
);

// GET /api/rta/reconciliation — list records
rtaRouter.get(
  "/reconciliation",
  requireRole("admin", "hr", "wfm", "process_manager", "finance", "payroll"),
  h(async (req: AuthenticatedRequest, res: Response) => {
    const schema = z.object({
      fromDate:    z.string().regex(DATE_RE),
      toDate:      z.string().regex(DATE_RE),
      employeeId:  z.string().uuid().optional(),
      processName: z.string().optional(),
      status:      z.string().optional(),
      page:        z.coerce.number().int().min(1).default(1),
      limit:       z.coerce.number().int().min(1).max(200).default(50),
    });
    const filters = schema.parse(req.query);
    const result  = await reconciliationService.listReconciliation(filters);
    return res.json({ success: true, ...result });
  })
);

// ─── Shrinkage ────────────────────────────────────────────────────────────────

// GET /api/rta/shrinkage — list snapshots
rtaRouter.get(
  "/shrinkage",
  requireRole("admin", "hr", "wfm", "process_manager", "finance"),
  h(async (req: AuthenticatedRequest, res: Response) => {
    const schema = z.object({
      fromDate:  z.string().regex(DATE_RE),
      toDate:    z.string().regex(DATE_RE),
      processId: z.string().uuid().optional(),
      branchId:  z.string().uuid().optional(),
    });
    const filters = schema.parse(req.query);
    const data = await shrinkageService.listSnapshots(filters);
    return res.json({ success: true, data });
  })
);

// POST /api/rta/shrinkage/snapshot — manually compute snapshot for a date
rtaRouter.post(
  "/shrinkage/snapshot",
  requireRole("admin", "hr", "wfm"),
  h(async (req: AuthenticatedRequest, res: Response) => {
    const schema = z.object({
      date:      z.string().regex(DATE_RE),
      processId: z.string().uuid().optional(),
      branchId:  z.string().uuid().optional(),
    });
    const { date, processId, branchId } = schema.parse(req.body);
    const data = await shrinkageService.calculateSnapshot(date, { processId, branchId, userId: req.authUser!.id });
    return res.json({ success: true, data });
  })
);

// ─── Adherence Alerts ─────────────────────────────────────────────────────────

// GET /api/rta/alerts
rtaRouter.get(
  "/alerts",
  requireRole("admin", "hr", "wfm", "process_manager", "team_leader", "assistant_manager"),
  h(async (req: AuthenticatedRequest, res: Response) => {
    const schema = z.object({
      fromDate:   z.string().regex(DATE_RE).optional(),
      toDate:     z.string().regex(DATE_RE).optional(),
      status:     z.enum(["open", "acknowledged", "resolved", "suppressed"]).optional(),
      processId:  z.string().uuid().optional(),
      employeeId: z.string().uuid().optional(),
      page:       z.coerce.number().int().min(1).default(1),
      limit:      z.coerce.number().int().min(1).max(200).default(50),
    });
    const filters = schema.parse(req.query);
    const data = await alertService.listAlerts(filters);
    return res.json({ success: true, data });
  })
);

// PATCH /api/rta/alerts/:id/acknowledge
rtaRouter.patch(
  "/alerts/:id/acknowledge",
  requireRole("admin", "hr", "wfm", "process_manager", "team_leader"),
  h(async (req: AuthenticatedRequest, res: Response) => {
    await alertService.acknowledgeAlert(req.params.id, req.authUser!.id);
    return res.json({ success: true, message: "Alert acknowledged" });
  })
);

// ─── Leave Staffing Impact ────────────────────────────────────────────────────

// POST /api/rta/leave-impact/:leaveRequestId — calculate impact for a leave request
rtaRouter.post(
  "/leave-impact/:leaveRequestId",
  requireRole("admin", "hr", "wfm"),
  h(async (req: AuthenticatedRequest, res: Response) => {
    const days = await leaveImpactService.calculateLeaveImpact(req.params.leaveRequestId);
    return res.json({ success: true, data: { days_impacted: days } });
  })
);

// GET /api/rta/leave-impact — list impacts
rtaRouter.get(
  "/leave-impact",
  requireRole("admin", "hr", "wfm", "process_manager"),
  h(async (req: AuthenticatedRequest, res: Response) => {
    const schema = z.object({
      fromDate:    z.string().regex(DATE_RE).optional(),
      toDate:      z.string().regex(DATE_RE).optional(),
      impactLevel: z.enum(["low", "medium", "high", "critical"]).optional(),
    });
    const filters = schema.parse(req.query);
    const data = await leaveImpactService.listImpacts(filters);
    return res.json({ success: true, data });
  })
);

// ─── Payroll Readiness ────────────────────────────────────────────────────────

// POST /api/rta/payroll-readiness/generate — generate readiness flags for a period
// Requires explicit payroll/finance role — sensitive audit output
rtaRouter.post(
  "/payroll-readiness/generate",
  requireRole("admin", "finance", "payroll"),
  h(async (req: AuthenticatedRequest, res: Response) => {
    const schema = z.object({
      periodStart: z.string().regex(DATE_RE),
      periodEnd:   z.string().regex(DATE_RE),
      processId:   z.string().uuid().optional(),
    });
    const { periodStart, periodEnd, processId } = schema.parse(req.body);

    const result = await payrollReadinessService.generateReadinessFlags(
      periodStart, periodEnd, { processId, userId: req.authUser!.id }
    );

    void logSensitiveAction({
      actor_user_id: req.authUser!.id,
      action_type: "PAYROLL_READINESS_GENERATED",
      module_key: "rta",
      entity_type: "payroll_readiness_flag",
      entity_id: `${periodStart}/${periodEnd}`,
      change_summary: result,
      req,
    });

    return res.json({ success: true, data: result });
  })
);

// GET /api/rta/payroll-readiness — list flags
rtaRouter.get(
  "/payroll-readiness",
  requireRole("admin", "finance", "payroll", "hr"),
  h(async (req: AuthenticatedRequest, res: Response) => {
    const schema = z.object({
      periodStart: z.string().regex(DATE_RE).optional(),
      status:      z.string().optional(),
      employeeId:  z.string().uuid().optional(),
      page:        z.coerce.number().int().min(1).default(1),
      limit:       z.coerce.number().int().min(1).max(200).default(50),
    });
    const filters = schema.parse(req.query);
    const data = await payrollReadinessService.listFlags(filters);
    return res.json({ success: true, data });
  })
);
