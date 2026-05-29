import { Router } from "express";
import type { Response } from "express";
import { requireAuth } from "../../middleware/authMiddleware.js";
import { requireRole } from "../../middleware/requireRole.js";
import type { AuthenticatedRequest } from "../../middleware/authMiddleware.js";
import { helpdeskService } from "./helpdesk.service.js";

const router = Router();
const h = (fn: Function) => (req: any, res: any, next: any) => fn(req, res).catch(next);

router.use(requireAuth);

// ── Tickets ──────────────────────────────────────────────────────────────────

router.get("/tickets", h(async (req: AuthenticatedRequest, res: Response) => {
  res.json({ data: await helpdeskService.listTickets(req.query as any) });
}));

router.post("/tickets", h(async (req: AuthenticatedRequest, res: Response) => {
  res.status(201).json({ data: await helpdeskService.createTicket(req.body) });
}));

router.get("/tickets/:id", h(async (req: AuthenticatedRequest, res: Response) => {
  const ticket = await helpdeskService.getTicket(req.params.id);
  if (!ticket) return res.status(404).json({ error: "Not found" });
  res.json({ data: ticket });
}));

router.patch("/tickets/:id", requireRole("admin", "hr"), h(async (req: AuthenticatedRequest, res: Response) => {
  res.json({ data: await helpdeskService.updateTicket(req.params.id, req.body) });
}));

router.post("/tickets/:id/comments", h(async (req: AuthenticatedRequest, res: Response) => {
  const { text, is_internal } = req.body;
  if (!text) return res.status(400).json({ error: "text required" });
  const id = await helpdeskService.addComment(req.params.id, req.authUser!.id, text, !!is_internal);
  res.status(201).json({ data: { id } });
}));

// ── Grievances ────────────────────────────────────────────────────────────────

router.get("/grievances", requireRole("admin", "hr"), h(async (req: AuthenticatedRequest, res: Response) => {
  res.json({ data: await helpdeskService.listGrievances(req.query as any) });
}));

router.post("/grievances", h(async (req: AuthenticatedRequest, res: Response) => {
  res.status(201).json({ data: await helpdeskService.createGrievance(req.body) });
}));

router.patch("/grievances/:id", requireRole("admin", "hr"), h(async (req: AuthenticatedRequest, res: Response) => {
  res.json({ data: await helpdeskService.updateGrievance(req.params.id, req.body) });
}));

export { router as helpdeskRouter };
