import type { RowDataPacket } from "mysql2";
import type { Response, NextFunction } from "express";
import { db } from "../db/mysql.js";
import type { AuthenticatedRequest } from "../middleware/authMiddleware.js";

/**
 * Resolve Supabase user_id → MySQL employee record.
 * Returns null if no employee mapped to this user.
 */
export async function getEmployeeForUser(userId: string): Promise<{ id: string; employee_code: string } | null> {
  const [rows] = await db.execute<RowDataPacket[]>(
    "SELECT id, employee_code FROM employees WHERE user_id = ? AND active_status = 1 LIMIT 1",
    [userId]
  );
  return (rows as RowDataPacket[])[0] as { id: string; employee_code: string } ?? null;
}

/**
 * Check if user holds any of the given roles in MySQL user_roles.
 */
export async function hasRole(userId: string, ...roles: string[]): Promise<boolean> {
  const [rows] = await db.execute<RowDataPacket[]>(
    "SELECT role_key FROM user_roles WHERE user_id = ? AND active_status = 1",
    [userId]
  );
  const userRoles = (rows as { role_key: string }[]).map((r) => r.role_key);
  return roles.some((r) => userRoles.includes(r));
}

/**
 * Middleware: allow admin/hr to proceed for any employee.
 * Allow employee self-service only when :employeeId matches their own mapped employee record.
 * 403 otherwise.
 */
export function selfOrAdminHr(employeeIdParam = "id") {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.authUser!.id;
      const targetEmployeeId = req.params[employeeIdParam];

      if (await hasRole(userId, "admin", "hr")) return next();

      const emp = await getEmployeeForUser(userId);
      if (emp && emp.id === targetEmployeeId) return next();

      return res.status(403).json({ success: false, message: "Forbidden" });
    } catch (err) {
      return next(err);
    }
  };
}
