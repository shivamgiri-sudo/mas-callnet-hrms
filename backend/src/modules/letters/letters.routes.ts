import { Router } from "express";
import type { Response } from "express";
import { requireAuth } from "../../middleware/authMiddleware.js";
import { requireRole } from "../../middleware/requireRole.js";
import type { AuthenticatedRequest } from "../../middleware/authMiddleware.js";
import { lettersService } from "./letters.service.js";

const router = Router();
const h = (fn: Function) => (req: any, res: any, next: any) => fn(req, res).catch(next);

router.use(requireAuth);

router.get("/templates", requireRole("admin", "hr"), h(async (_req: AuthenticatedRequest, res: Response) => {
  res.json({ data: await lettersService.listTemplates() });
}));

router.post("/generate", requireRole("admin", "hr"), h(async (req: AuthenticatedRequest, res: Response) => {
  const { employee_id, template_code, issued_date, override_vars } = req.body;
  if (!employee_id || !template_code) return res.status(400).json({ error: "employee_id and template_code required" });
  const letter = await lettersService.generateLetter({
    employee_id, template_code, issued_date, override_vars,
    generated_by: req.authUser!.id,
  });
  res.status(201).json({ data: letter });
}));

router.get("/employee/:employeeId", requireRole("admin", "hr"), h(async (req: AuthenticatedRequest, res: Response) => {
  res.json({ data: await lettersService.listGenerated(req.params.employeeId) });
}));

router.post("/:letterId/acknowledge", h(async (req: AuthenticatedRequest, res: Response) => {
  await lettersService.acknowledge(req.params.letterId);
  res.json({ ok: true });
}));

export { router as lettersRouter };
