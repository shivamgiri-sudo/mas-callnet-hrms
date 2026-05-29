import { Router } from "express";
import type { Response } from "express";
import { requireAuth } from "../../middleware/authMiddleware.js";
import { requireRole } from "../../middleware/requireRole.js";
import type { AuthenticatedRequest } from "../../middleware/authMiddleware.js";
import { getEmployeeForUser, hasRole } from "../../shared/accessGuard.js";
import { managementService } from "./management.service.js";

// SCOPE NOTE: Manager access to team-wide management data (team-kpi, alerts, dashboard,
// coaching list-all) is deferred until user_assignment_scope enforcement is implemented.
// Managers currently see only their own coaching (employee self-service path).
// Re-enable per endpoint when scope mapping supports it.

const router = Router();
const h = (fn: Function) => (req: any, res: any, next: any) => fn(req, res).catch(next);
router.use(requireAuth);

router.get("/team-kpi", requireRole("admin","hr"), h(async (req: AuthenticatedRequest, res: Response) => {
  res.json({ data: await managementService.getTeamKpiSummary(req.query as any) });
}));

router.get("/coaching", h(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.authUser!.id;
  if (await hasRole(userId, "admin","hr")) {
    return res.json({ data: await managementService.listCoachingSessions(req.query as any) });
  }
  const emp = await getEmployeeForUser(userId);
  if (!emp) return res.status(403).json({ success: false, message: "No employee record" });
  return res.json({ data: await managementService.listCoachingSessions({ employee_id: emp.id }) });
}));

router.post("/coaching", requireRole("admin","hr"), h(async (req: AuthenticatedRequest, res: Response) => {
  const { employee_id, session_date, session_type } = req.body;
  if (!employee_id || !session_date || !session_type)
    return res.status(400).json({ error: "employee_id, session_date, session_type required" });
  res.status(201).json({ data: await managementService.createCoachingSession(req.body, req.authUser!.id, req) });
}));

router.get("/alerts", requireRole("admin","hr"), h(async (req: AuthenticatedRequest, res: Response) => {
  const acknowledged = req.query.acknowledged !== undefined ? req.query.acknowledged === "true" : undefined;
  res.json({ data: await managementService.listAlerts({ ...req.query as any, acknowledged }) });
}));

router.post("/alerts/:id/acknowledge", requireRole("admin","hr"), h(async (req: AuthenticatedRequest, res: Response) => {
  await managementService.acknowledgeAlert(req.params.id, req.authUser!.id, req);
  res.json({ ok: true });
}));

router.get("/dashboard", requireRole("admin","hr"), h(async (req: AuthenticatedRequest, res: Response) => {
  res.json({ data: await managementService.getDashboardSummary(req.query.process_id as string | undefined) });
}));

export { router as managementRouter };
