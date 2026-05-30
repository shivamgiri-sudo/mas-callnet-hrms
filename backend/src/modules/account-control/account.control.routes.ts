import { Router } from "express";
import type { Response } from "express";
import { requireAuth } from "../../middleware/authMiddleware.js";
import { requireRole } from "../../middleware/requireRole.js";
import type { AuthenticatedRequest } from "../../middleware/authMiddleware.js";
import { accountControlService } from "./account.control.service.js";

const router = Router();
const h = (fn: Function) => (req: any, res: any, next: any) => fn(req, res).catch(next);

/**
 * GET /api/account-control/forgot-password-info
 * Public — no auth required. Returns instructions for end-users.
 */
router.get("/forgot-password-info", (_req, res: Response) => {
  return res.json({
    message: "Password reset is handled via Supabase Auth.",
    instructions: "Use the Supabase Auth forgot-password flow or contact your HR/Admin for an admin-initiated reset.",
  });
});

// All routes below require authentication
router.use(requireAuth);

/**
 * POST /api/account-control/reset-request
 * Body: { userId, reason? }
 * Admin or HR: log a password reset request for a user.
 */
router.post(
  "/reset-request",
  requireRole("admin", "hr"),
  h(async (req: AuthenticatedRequest, res: Response) => {
    const { userId, reason } = req.body as { userId?: string; reason?: string };
    if (!userId) return res.status(400).json({ error: "userId required" });
    const result = await accountControlService.requestPasswordReset(
      userId,
      "",              // email not required at route level — service only logs it if provided
      req.authUser!.id,
      req.ip ?? ""
    );
    return res.json({ data: result });
  })
);

/**
 * POST /api/account-control/force-change
 * Body: { userId, reason? }
 * Admin: set force_change_password flag.
 */
router.post(
  "/force-change",
  requireRole("admin"),
  h(async (req: AuthenticatedRequest, res: Response) => {
    const { userId, reason } = req.body as { userId?: string; reason?: string };
    if (!userId) return res.status(400).json({ error: "userId required" });
    const result = await accountControlService.forcePasswordChange(
      userId,
      req.authUser!.id,
      reason ?? "",
      req.ip ?? ""
    );
    return res.json({ data: result });
  })
);

/**
 * POST /api/account-control/lock
 * Body: { userId, reason? }
 * Admin: log account lock.
 */
router.post(
  "/lock",
  requireRole("admin"),
  h(async (req: AuthenticatedRequest, res: Response) => {
    const { userId, reason } = req.body as { userId?: string; reason?: string };
    if (!userId) return res.status(400).json({ error: "userId required" });
    const result = await accountControlService.lockAccount(
      userId,
      req.authUser!.id,
      reason ?? "",
      req.ip ?? ""
    );
    return res.json({ data: result });
  })
);

/**
 * POST /api/account-control/unlock
 * Body: { userId }
 * Admin: log account unlock.
 */
router.post(
  "/unlock",
  requireRole("admin"),
  h(async (req: AuthenticatedRequest, res: Response) => {
    const { userId } = req.body as { userId?: string };
    if (!userId) return res.status(400).json({ error: "userId required" });
    const result = await accountControlService.unlockAccount(
      userId,
      req.authUser!.id,
      req.ip ?? ""
    );
    return res.json({ data: result });
  })
);

/**
 * POST /api/account-control/disable
 * Body: { userId, reason? }
 * Admin: log account disable.
 */
router.post(
  "/disable",
  requireRole("admin"),
  h(async (req: AuthenticatedRequest, res: Response) => {
    const { userId, reason } = req.body as { userId?: string; reason?: string };
    if (!userId) return res.status(400).json({ error: "userId required" });
    const result = await accountControlService.disableAccount(
      userId,
      req.authUser!.id,
      reason ?? "",
      req.ip ?? ""
    );
    return res.json({ data: result });
  })
);

/**
 * POST /api/account-control/enable
 * Body: { userId }
 * Admin: log account enable.
 */
router.post(
  "/enable",
  requireRole("admin"),
  h(async (req: AuthenticatedRequest, res: Response) => {
    const { userId } = req.body as { userId?: string };
    if (!userId) return res.status(400).json({ error: "userId required" });
    const result = await accountControlService.enableAccount(
      userId,
      req.authUser!.id,
      req.ip ?? ""
    );
    return res.json({ data: result });
  })
);

/**
 * POST /api/account-control/revoke-session
 * Body: { userId }
 * Admin: log session revoke (actual Supabase revoke done by caller separately).
 */
router.post(
  "/revoke-session",
  requireRole("admin"),
  h(async (req: AuthenticatedRequest, res: Response) => {
    const { userId } = req.body as { userId?: string };
    if (!userId) return res.status(400).json({ error: "userId required" });
    const result = await accountControlService.logSessionRevoke(
      userId,
      req.authUser!.id,
      req.ip ?? ""
    );
    return res.json({ data: result });
  })
);

/**
 * GET /api/account-control/audit-log/:userId
 * Admin or HR: retrieve account control audit log for a user.
 */
router.get(
  "/audit-log/:userId",
  requireRole("admin", "hr"),
  h(async (req: AuthenticatedRequest, res: Response) => {
    const { userId } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const logs = await accountControlService.getAccountAuditLog(userId, limit);
    return res.json({ data: logs });
  })
);

export { router as accountControlRouter };
