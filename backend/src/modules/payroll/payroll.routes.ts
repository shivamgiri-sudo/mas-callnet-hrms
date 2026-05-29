import { Router } from "express";
import { requireAuth } from "../../middleware/authMiddleware.js";
import { payrollController as c } from "./payroll.controller.js";
import { calculatePayrollRun } from "./payrollCalculate.service.js";
import { payslipService } from "./payslip.service.js";
import { taxDeclarationService } from "./taxDeclaration.service.js";
import type { AuthenticatedRequest } from "../../middleware/authMiddleware.js";
import type { Response } from "express";

const PAYROLL_ROLES = ["admin", "hr", "finance", "payroll"];

const hasPayrollRole = (role: string) =>
  PAYROLL_ROLES.some(r => role.toLowerCase().includes(r));

const router = Router();
const h = (fn: Function) => (req: any, res: any, next: any) => fn(req, res).catch(next);

router.use(requireAuth);

// Structures
router.get("/structures", h(c.listStructures));
router.post("/structures", h(c.createStructure));

// Components
router.get("/components", h(c.listComponents));
router.post("/components", h(c.createComponent));

// Salary assignment
router.post("/salary-assignments", h(c.assignSalary));
router.post("/salary-assignments/bulk", h(c.bulkAssignSalary));
router.get("/salary-assignments/:employeeId", h(c.getEmployeeSalary));

// Prep runs — static paths before :id
router.get("/runs", h(c.listRuns));
router.post("/runs", h(c.createRun));
router.get("/runs/:id", h(c.getRun));
router.patch("/runs/:id/status", h(c.updateRunStatus));
router.get("/runs/:id/lines", h(c.listLines));
router.post("/runs/:id/calculate", async (req: any, res: any, next: any) => {
  try {
    const result = await calculatePayrollRun(req.params.id, req.authUser?.id ?? "system");
    return res.json({ success: true, data: result, message: "Payroll calculated" });
  } catch (err) { next(err); }
});

// Prep lines
router.patch("/lines/:id", h(c.updateLine));

// Advances
router.post("/advances", h(c.createAdvance));
router.get("/advances/:employeeId", h(c.listAdvances));

// Statutory config
router.get("/statutory-config", h(c.getStatutoryConfig));

// ─── Payslip ──────────────────────────────────────────────────────────────────

// GET /api/payroll/payslip/:runId/:employeeId — admin/hr/employee own-only
router.get("/payslip/:runId/:employeeId", h(async (req: AuthenticatedRequest, res: Response) => {
  const { runId, employeeId } = req.params;
  const actorId = req.authUser!.id;
  const role: string = (req as any).authUser?.role ?? "";

  // Ownership check: employee may only fetch own payslip
  if (!hasPayrollRole(role) && actorId !== employeeId) {
    return res.status(403).json({ success: false, message: "Forbidden: you may only view your own payslip" });
  }

  const data = await payslipService.getPayslip(employeeId, runId);
  return res.json({ success: true, data });
}));

// POST /api/payroll/payslip/:runId/generate — admin/hr only
router.post("/payslip/:runId/generate", h(async (req: AuthenticatedRequest, res: Response) => {
  const role: string = (req as any).authUser?.role ?? "";
  if (!hasPayrollRole(role)) {
    return res.status(403).json({ success: false, message: "Forbidden: Payroll/HR/Admin role required" });
  }

  const { employeeId } = req.body as { employeeId?: string };
  if (!employeeId) {
    return res.status(400).json({ success: false, message: "employeeId is required" });
  }

  const data = await payslipService.generatePayslip(req.params.runId, employeeId, req.authUser!.id, req);
  return res.status(201).json({ success: true, data, message: "Payslip generated" });
}));

// POST /api/payroll/payslip/:payslipId/acknowledge — employee self
router.post("/payslip/:payslipId/acknowledge", h(async (req: AuthenticatedRequest, res: Response) => {
  const data = await payslipService.acknowledgePayslip(req.params.payslipId, req.authUser!.id);
  return res.json({ success: true, data, message: "Payslip acknowledged" });
}));

// ─── Tax Declaration ──────────────────────────────────────────────────────────

// GET /api/payroll/tax-declaration/:employeeId/:year — admin/hr or employee own
router.get("/tax-declaration/:employeeId/:year", h(async (req: AuthenticatedRequest, res: Response) => {
  const { employeeId, year } = req.params;
  const actorId = req.authUser!.id;
  const role: string = (req as any).authUser?.role ?? "";

  if (!hasPayrollRole(role) && actorId !== employeeId) {
    return res.status(403).json({ success: false, message: "Forbidden: you may only view your own tax declaration" });
  }

  const data = await taxDeclarationService.get(employeeId, year);
  return res.json({ success: true, data });
}));

// POST /api/payroll/tax-declaration/:employeeId/:year — admin/hr or employee own
router.post("/tax-declaration/:employeeId/:year", h(async (req: AuthenticatedRequest, res: Response) => {
  const { employeeId, year } = req.params;
  const actorId = req.authUser!.id;
  const role: string = (req as any).authUser?.role ?? "";

  if (!hasPayrollRole(role) && actorId !== employeeId) {
    return res.status(403).json({ success: false, message: "Forbidden: you may only submit your own tax declaration" });
  }

  const data = await taxDeclarationService.upsert(employeeId, year, req.body, actorId);
  return res.json({ success: true, data, message: "Tax declaration saved" });
}));

export { router as payrollRouter };
