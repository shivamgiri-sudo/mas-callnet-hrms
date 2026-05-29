import { Router } from "express";
import { requireAuth } from "../../middleware/authMiddleware.js";
import { requireRole } from "../../middleware/requireRole.js";
import { getEmployeeForUser, hasRole } from "../../shared/accessGuard.js";
import { payrollController as c } from "./payroll.controller.js";
import { calculatePayrollRun } from "./payrollCalculate.service.js";
import { payslipService } from "./payslip.service.js";
import { taxDeclarationService } from "./taxDeclaration.service.js";
import { logSensitiveAction } from "../../shared/auditLog.js";
import type { AuthenticatedRequest } from "../../middleware/authMiddleware.js";
import type { Response } from "express";

const router = Router();
const h = (fn: Function) => (req: any, res: any, next: any) => fn(req, res).catch(next);

router.use(requireAuth);

// ─── Structures ───────────────────────────────────────────────────────────────

router.get("/structures", h(c.listStructures));
router.post("/structures", requireRole("admin", "hr", "finance", "payroll"), h(c.createStructure));

// ─── Components ───────────────────────────────────────────────────────────────

router.get("/components", h(c.listComponents));
router.post("/components", requireRole("admin", "hr", "finance", "payroll"), h(c.createComponent));

// ─── Salary Assignments ───────────────────────────────────────────────────────

router.post("/salary-assignments", requireRole("admin", "hr", "finance", "payroll"), h(c.assignSalary));
router.post("/salary-assignments/bulk", requireRole("admin", "hr", "finance", "payroll"), h(c.bulkAssignSalary));
router.get("/salary-assignments/:employeeId", requireRole("admin", "hr", "finance", "payroll"), h(c.getEmployeeSalary));

// ─── Payroll Runs — static paths before :id ───────────────────────────────────

router.get("/runs", h(c.listRuns));
router.post("/runs", requireRole("admin", "finance", "payroll"), h(c.createRun));
router.get("/runs/:id", h(c.getRun));
router.patch("/runs/:id/status", requireRole("admin", "finance", "payroll"), h(c.updateRunStatus));
router.get("/runs/:id/lines", h(c.listLines));
router.post("/runs/:id/calculate", requireRole("admin", "finance", "payroll"), async (req: any, res: any, next: any) => {
  try {
    const actorId = req.authUser?.id ?? "system";
    const result = await calculatePayrollRun(req.params.id, actorId);
    void logSensitiveAction({
      actor_user_id: actorId,
      action_type: "PAYROLL_RUN_CALCULATED",
      module_key: "payroll",
      entity_type: "salary_prep_run",
      entity_id: req.params.id,
      change_summary: { run_id: req.params.id },
      req,
    });
    return res.json({ success: true, data: result, message: "Payroll calculated" });
  } catch (err) { next(err); }
});

// ─── Run Lines ────────────────────────────────────────────────────────────────

router.patch("/lines/:id", requireRole("admin", "finance", "payroll"), h(c.updateLine));

// ─── Advances ─────────────────────────────────────────────────────────────────

router.post("/advances", requireRole("admin", "hr", "finance", "payroll"), h(c.createAdvance));
router.get("/advances/:employeeId", h(async (req: AuthenticatedRequest, res: Response) => {
  const isPayrollRole = await hasRole(req.authUser!.id, "admin", "hr", "finance", "payroll");
  if (!isPayrollRole) {
    const callerEmp = await getEmployeeForUser(req.authUser!.id);
    if (!callerEmp || callerEmp.id !== req.params.employeeId) {
      return res.status(403).json({ success: false, message: "Forbidden: you may only view your own advances" });
    }
  }
  return c.listAdvances(req as any, res);
}));

// ─── Statutory Config ─────────────────────────────────────────────────────────

router.get("/statutory-config", requireRole("admin", "finance", "payroll"), h(c.getStatutoryConfig));

// ─── Payslip ──────────────────────────────────────────────────────────────────

// GET /api/payroll/payslip/:runId/:employeeId — admin/hr/finance/payroll or employee own
router.get("/payslip/:runId/:employeeId", h(async (req: AuthenticatedRequest, res: Response) => {
  const { runId, employeeId } = req.params;

  const isPayrollRole = await hasRole(req.authUser!.id, "admin", "hr", "finance", "payroll");
  if (!isPayrollRole) {
    const callerEmp = await getEmployeeForUser(req.authUser!.id);
    if (!callerEmp || callerEmp.id !== employeeId) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
  }

  const data = await payslipService.getPayslip(employeeId, runId);
  return res.json({ success: true, data });
}));

// POST /api/payroll/payslip/:runId/generate — admin/hr/finance/payroll only
router.post(
  "/payslip/:runId/generate",
  requireRole("admin", "hr", "finance", "payroll"),
  h(async (req: AuthenticatedRequest, res: Response) => {
    const { employeeId } = req.body as { employeeId?: string };
    if (!employeeId) {
      return res.status(400).json({ success: false, message: "employeeId is required" });
    }

    const data = await payslipService.generatePayslip(req.params.runId, employeeId, req.authUser!.id, req);
    return res.status(201).json({ success: true, data, message: "Payslip generated" });
  })
);

// POST /api/payroll/payslip/:payslipId/acknowledge — employee self (server-mapped)
router.post("/payslip/:payslipId/acknowledge", h(async (req: AuthenticatedRequest, res: Response) => {
  const callerEmp = await getEmployeeForUser(req.authUser!.id);
  if (!callerEmp) {
    return res.status(403).json({ success: false, message: "No employee record" });
  }
  const data = await payslipService.acknowledgePayslip(req.params.payslipId, callerEmp.id);
  return res.json({ success: true, data, message: "Payslip acknowledged" });
}));

// ─── Tax Declaration ──────────────────────────────────────────────────────────

// GET /api/payroll/tax-declaration/:employeeId/:year — admin/hr/finance/payroll or employee own
router.get("/tax-declaration/:employeeId/:year", h(async (req: AuthenticatedRequest, res: Response) => {
  const { employeeId, year } = req.params;

  const isPayrollRole = await hasRole(req.authUser!.id, "admin", "hr", "finance", "payroll");
  if (!isPayrollRole) {
    const callerEmp = await getEmployeeForUser(req.authUser!.id);
    if (!callerEmp || callerEmp.id !== employeeId) {
      return res.status(403).json({ success: false, message: "Forbidden: you may only view your own tax declaration" });
    }
  }

  const data = await taxDeclarationService.get(employeeId, year);
  return res.json({ success: true, data });
}));

// POST /api/payroll/tax-declaration/:employeeId/:year — admin/hr/finance/payroll or employee own
router.post("/tax-declaration/:employeeId/:year", h(async (req: AuthenticatedRequest, res: Response) => {
  const { year } = req.params;

  const isPayrollRole = await hasRole(req.authUser!.id, "admin", "hr", "finance", "payroll");
  if (!isPayrollRole) {
    const callerEmp = await getEmployeeForUser(req.authUser!.id);
    if (!callerEmp || callerEmp.id !== req.params.employeeId) {
      return res.status(403).json({ success: false, message: "Forbidden: you may only submit your own tax declaration" });
    }
    const data = await taxDeclarationService.upsert(callerEmp.id, year, req.body, req.authUser!.id);
    return res.json({ success: true, data, message: "Tax declaration saved" });
  }

  const data = await taxDeclarationService.upsert(req.params.employeeId, year, req.body, req.authUser!.id);
  return res.json({ success: true, data, message: "Tax declaration saved" });
}));

export { router as payrollRouter };
