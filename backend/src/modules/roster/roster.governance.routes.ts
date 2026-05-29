import { Router } from "express";
import type { Response } from "express";
import { requireAuth } from "../../middleware/authMiddleware.js";
import { requireRole } from "../../middleware/requireRole.js";
import type { AuthenticatedRequest } from "../../middleware/authMiddleware.js";
import { getEmployeeForUser, hasRole } from "../../shared/accessGuard.js";
import { rosterGovernanceService } from "./roster.governance.service.js";

const router = Router();
const h = (fn: Function) => (req: any, res: any, next: any) => fn(req, res).catch(next);
router.use(requireAuth);

// ── Shift Templates ───────────────────────────────────────────────────────────

router.get("/shifts/templates", requireRole("admin", "hr", "wfm", "manager"), h(async (req: AuthenticatedRequest, res: Response) => {
  const data = await rosterGovernanceService.listShiftTemplates(req.query as any);
  return res.json({ data });
}));

router.post("/shifts/templates", requireRole("admin", "hr", "wfm"), h(async (req: AuthenticatedRequest, res: Response) => {
  const { shift_code, shift_name, start_time, end_time, effective_from } = req.body;
  if (!shift_code || !shift_name || !start_time || !end_time || !effective_from) {
    return res.status(400).json({ error: "shift_code, shift_name, start_time, end_time, effective_from are required" });
  }
  const data = await rosterGovernanceService.createShiftTemplate(req.body, req.authUser!.id, req);
  return res.status(201).json({ data });
}));

// ── Roster Cycles ─────────────────────────────────────────────────────────────

router.get("/cycles", requireRole("admin", "hr", "wfm", "manager"), h(async (req: AuthenticatedRequest, res: Response) => {
  const data = await rosterGovernanceService.listCycles(req.query as any);
  return res.json({ data });
}));

router.post("/cycles", requireRole("admin", "hr", "wfm"), h(async (req: AuthenticatedRequest, res: Response) => {
  const { process_id, week_start_date, week_end_date } = req.body;
  if (!process_id || !week_start_date || !week_end_date) {
    return res.status(400).json({ error: "process_id, week_start_date, week_end_date are required" });
  }
  const data = await rosterGovernanceService.createCycle(req.body, req.authUser!.id, req);
  return res.status(201).json({ data });
}));

router.post("/cycles/:id/status", requireRole("admin", "hr", "wfm"), h(async (req: AuthenticatedRequest, res: Response) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: "status is required" });
  const data = await rosterGovernanceService.advanceCycleStatus(req.params.id, status, req.authUser!.id, req);
  return res.json({ data });
}));

// ── Daily Assignments ─────────────────────────────────────────────────────────

router.get("/cycles/:id/assignments", h(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.authUser!.id;
  if (await hasRole(userId, "admin", "hr", "wfm", "manager")) {
    const data = await rosterGovernanceService.getAssignments(req.params.id);
    return res.json({ data });
  }
  const emp = await getEmployeeForUser(userId);
  if (!emp) return res.status(403).json({ success: false, message: "No employee record" });
  const data = await rosterGovernanceService.getAssignments(req.params.id, emp.id);
  return res.json({ data });
}));

router.post("/cycles/:id/assignments/bulk", requireRole("admin", "hr", "wfm"), h(async (req: AuthenticatedRequest, res: Response) => {
  const { assignments } = req.body;
  if (!Array.isArray(assignments) || assignments.length === 0) {
    return res.status(400).json({ error: "assignments array is required and must not be empty" });
  }
  const data = await rosterGovernanceService.bulkUpsertAssignments(req.params.id, assignments, req.authUser!.id, req);
  return res.json({ data });
}));

// ── Employee Self-Acknowledgement ─────────────────────────────────────────────

router.post("/cycles/:id/acknowledge", h(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.authUser!.id;
  const emp = await getEmployeeForUser(userId);
  if (!emp) return res.status(403).json({ success: false, message: "No employee record" });
  const data = await rosterGovernanceService.acknowledgeRoster(req.params.id, emp.id, userId, req);
  return res.json({ data });
}));

// ── Change Log ────────────────────────────────────────────────────────────────

router.get("/cycles/:id/changes", requireRole("admin", "hr", "wfm", "manager"), h(async (req: AuthenticatedRequest, res: Response) => {
  const data = await rosterGovernanceService.listChangeLogs(req.params.id, req.query.employee_id as string | undefined);
  return res.json({ data });
}));

router.post("/cycles/:id/changes", requireRole("admin", "hr", "wfm", "manager"), h(async (req: AuthenticatedRequest, res: Response) => {
  const { employee_id, change_type, reason, change_date } = req.body;
  if (!employee_id || !change_type || !reason || !change_date) {
    return res.status(400).json({ error: "employee_id, change_type, reason, change_date are required" });
  }
  const data = await rosterGovernanceService.logRosterChange(req.params.id, req.body, req.authUser!.id, req);
  return res.status(201).json({ data });
}));

// ── Coverage Actions ──────────────────────────────────────────────────────────

router.post("/coverage-actions", requireRole("admin", "hr", "wfm", "manager"), h(async (req: AuthenticatedRequest, res: Response) => {
  const { cycle_id, action_date } = req.body;
  if (!cycle_id || !action_date) {
    return res.status(400).json({ error: "cycle_id, action_date are required" });
  }
  const data = await rosterGovernanceService.createCoverageAction(req.body, req.authUser!.id, req);
  return res.status(201).json({ data });
}));

router.post("/coverage-actions/:id/resolve", requireRole("admin", "hr", "wfm", "manager"), h(async (req: AuthenticatedRequest, res: Response) => {
  const data = await rosterGovernanceService.resolveCoverageAction(req.params.id, req.authUser!.id, req);
  return res.json({ data });
}));

// ── Portal Aggregate ──────────────────────────────────────────────────────────

router.get("/portal-aggregate", requireRole("admin", "hr", "wfm"), h(async (req: AuthenticatedRequest, res: Response) => {
  const { process_id, week_start_date } = req.query as { process_id?: string; week_start_date?: string };
  if (!process_id || !week_start_date) {
    return res.status(400).json({ error: "process_id and week_start_date query params are required" });
  }
  const data = await rosterGovernanceService.getPortalAggregate({ process_id, week_start_date });
  return res.json({ data });
}));

export { router as rosterGovRouter };
