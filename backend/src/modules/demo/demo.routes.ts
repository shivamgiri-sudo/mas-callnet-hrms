/**
 * demo.routes.ts
 * Protected endpoint to trigger demo seed (admin only, non-production only).
 *
 * POST /api/demo/seed
 * Returns: { inserted, skipped, errors }
 *
 * Safety gates (enforced before any seed logic):
 *   - 403 if NODE_ENV === 'production'
 *   - 403 if ALLOW_DEMO_SEED !== 'true'
 *   - requireAuth + admin/super_admin role check
 */

import { Router } from "express";
import type { Response } from "express";
import { requireAuth } from "../../middleware/authMiddleware.js";
import { requireRole } from "../../middleware/requireRole.js";
import type { AuthenticatedRequest } from "../../middleware/authMiddleware.js";
import { runDemoSeed } from "./demo.seed.js";

export const demoRouter = Router();

const h = (fn: Function) =>
  (req: any, res: any, next: any) => fn(req, res).catch(next);

demoRouter.post(
  "/seed",
  requireAuth,
  requireRole("super_admin", "admin"),
  h(async (_req: AuthenticatedRequest, res: Response) => {
    if (process.env.NODE_ENV === "production") {
      return res.status(403).json({
        success: false,
        message: "Demo seed is not allowed in production.",
      });
    }

    if (process.env.ALLOW_DEMO_SEED !== "true") {
      return res.status(403).json({
        success: false,
        message: "Demo seed is disabled. Set ALLOW_DEMO_SEED=true (non-production only).",
      });
    }

    const result = await runDemoSeed();

    return res.json({
      success: true,
      data: result,
    });
  })
);
