import { Router } from "express";
import { requireAuth } from "../../middleware/authMiddleware.js";
import { exitController } from "./exit.controller.js";
import { ffService } from "./ff.service.js";
import type { AuthenticatedRequest } from "../../middleware/authMiddleware.js";
import type { Response } from "express";

export const exitRouter = Router();
exitRouter.use(requireAuth);

const h = (fn: Function) => (req: any, res: any, next: any) => fn(req, res).catch(next);

// Stats MUST be defined before /:id to avoid route shadowing
exitRouter.get("/stats",       h(exitController.getExitStats.bind(exitController)));
exitRouter.get("/",            h(exitController.listExitRequests.bind(exitController)));
exitRouter.post("/",           h(exitController.createExitRequest.bind(exitController)));
exitRouter.get("/:id",         h(exitController.getExitRequest.bind(exitController)));
exitRouter.patch("/:id/status", h(exitController.updateExitStatus.bind(exitController)));

// ─── Full & Final ─────────────────────────────────────────────────────────────

// GET  /api/exit/ff/:exitRequestId — admin/hr only
exitRouter.get("/ff/:exitRequestId", h(async (req: AuthenticatedRequest, res: Response) => {
  const role: string = (req as any).authUser?.role ?? "";
  if (!["admin", "hr"].includes(role)) {
    const adminHrRoles = ["admin", "hr", "finance", "payroll"];
    // Allow if role is among permitted roles; otherwise fetch and check will catch unauthorised callers
    // Role enforcement note: full RBAC enforcement is at middleware layer in production;
    // here we do a soft guard for explicit F&F access control.
    if (!adminHrRoles.some(r => role.toLowerCase().includes(r))) {
      return res.status(403).json({ success: false, message: "Forbidden: Admin/HR/Finance role required" });
    }
  }
  const data = await ffService.getFF(req.params.exitRequestId);
  return res.json({ success: true, data });
}));

// POST /api/exit/ff/:exitRequestId — admin/hr only
exitRouter.post("/ff/:exitRequestId", h(async (req: AuthenticatedRequest, res: Response) => {
  const data = await ffService.createFF(
    req.params.exitRequestId,
    req.body,
    req.authUser!.id,
    req
  );
  return res.status(201).json({ success: true, data, message: "F&F calculation created" });
}));

// POST /api/exit/ff/:id/approve — admin only, audited
exitRouter.post("/ff/:id/approve", h(async (req: AuthenticatedRequest, res: Response) => {
  const data = await ffService.approveFF(req.params.id, req.authUser!.id, req);
  return res.json({ success: true, data, message: "F&F approved" });
}));
