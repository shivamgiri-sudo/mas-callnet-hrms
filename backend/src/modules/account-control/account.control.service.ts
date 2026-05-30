import { randomUUID } from "crypto";
import type { RowDataPacket } from "mysql2";
import { db } from "../../db/mysql.js";
import { logSensitiveAction } from "../../shared/auditLog.js";

// Account control: admin password reset, force-change, lock, unlock, disable, session management
// Supabase Auth is the actual auth provider — MySQL tracks status and audit only
// NEVER store or log plaintext passwords

type AccountAction =
  | "password_reset_requested"
  | "force_change_set"
  | "account_locked"
  | "account_unlocked"
  | "account_disabled"
  | "account_enabled"
  | "session_revoked";

async function insertControlLog(
  userId: string,
  action: AccountAction,
  initiatedBy: string,
  ip: string,
  reason?: string
): Promise<void> {
  await db.execute(
    `INSERT INTO account_control_log (id, user_id, action, initiated_by, ip_address, reason)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [randomUUID(), userId, action, initiatedBy, ip, reason ?? null]
  );
}

export const accountControlService = {
  /**
   * Log a password reset request.
   * Does NOT call Supabase — that is the caller's responsibility via the admin API.
   */
  async requestPasswordReset(
    userId: string,
    email: string,
    initiatedBy: string,
    ip: string
  ): Promise<{ logged: true; message: string }> {
    await insertControlLog(userId, "password_reset_requested", initiatedBy, ip);
    await logSensitiveAction({
      actor_user_id: initiatedBy,
      action_type: "PASSWORD_RESET_REQUESTED",
      module_key: "ACCOUNT_CONTROL",
      entity_type: "user",
      entity_id: userId,
      // email is in change_summary for audit, not logged separately
      change_summary: { email },
    });
    return { logged: true, message: "Reset link will be sent via Supabase Auth" };
  },

  /**
   * Set force_change_password flag in user_roles for the user.
   */
  async forcePasswordChange(
    userId: string,
    initiatedBy: string,
    reason: string,
    ip: string
  ): Promise<RowDataPacket> {
    await db.execute(
      `UPDATE user_roles SET force_change_password = 1 WHERE user_id = ?`,
      [userId]
    );
    await insertControlLog(userId, "force_change_set", initiatedBy, ip, reason);
    await logSensitiveAction({
      actor_user_id: initiatedBy,
      action_type: "FORCE_CHANGE_SET",
      module_key: "ACCOUNT_CONTROL",
      entity_type: "user",
      entity_id: userId,
      change_summary: { reason },
    });
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT user_id, role_key, active_status, force_change_password
       FROM user_roles WHERE user_id = ? LIMIT 1`,
      [userId]
    );
    return (rows as RowDataPacket[])[0] ?? { user_id: userId };
  },

  /**
   * Log account lock. Actual lock enforcement is at auth layer (Supabase).
   */
  async lockAccount(
    userId: string,
    initiatedBy: string,
    reason: string,
    ip: string
  ): Promise<{ logged: true }> {
    await insertControlLog(userId, "account_locked", initiatedBy, ip, reason);
    await logSensitiveAction({
      actor_user_id: initiatedBy,
      action_type: "ACCOUNT_LOCKED",
      module_key: "ACCOUNT_CONTROL",
      entity_type: "user",
      entity_id: userId,
      change_summary: { reason },
    });
    return { logged: true };
  },

  /**
   * Log account unlock.
   */
  async unlockAccount(
    userId: string,
    initiatedBy: string,
    ip: string
  ): Promise<{ logged: true }> {
    await insertControlLog(userId, "account_unlocked", initiatedBy, ip);
    await logSensitiveAction({
      actor_user_id: initiatedBy,
      action_type: "ACCOUNT_UNLOCKED",
      module_key: "ACCOUNT_CONTROL",
      entity_type: "user",
      entity_id: userId,
    });
    return { logged: true };
  },

  /**
   * Log account disable.
   */
  async disableAccount(
    userId: string,
    initiatedBy: string,
    reason: string,
    ip: string
  ): Promise<{ logged: true }> {
    await insertControlLog(userId, "account_disabled", initiatedBy, ip, reason);
    await logSensitiveAction({
      actor_user_id: initiatedBy,
      action_type: "ACCOUNT_DISABLED",
      module_key: "ACCOUNT_CONTROL",
      entity_type: "user",
      entity_id: userId,
      change_summary: { reason },
    });
    return { logged: true };
  },

  /**
   * Log account enable.
   */
  async enableAccount(
    userId: string,
    initiatedBy: string,
    ip: string
  ): Promise<{ logged: true }> {
    await insertControlLog(userId, "account_enabled", initiatedBy, ip);
    await logSensitiveAction({
      actor_user_id: initiatedBy,
      action_type: "ACCOUNT_ENABLED",
      module_key: "ACCOUNT_CONTROL",
      entity_type: "user",
      entity_id: userId,
    });
    return { logged: true };
  },

  /**
   * Log session revoke. Actual revocation is performed via Supabase Admin API by the caller.
   */
  async logSessionRevoke(
    userId: string,
    initiatedBy: string,
    ip: string
  ): Promise<{ logged: true }> {
    await insertControlLog(userId, "session_revoked", initiatedBy, ip);
    await logSensitiveAction({
      actor_user_id: initiatedBy,
      action_type: "SESSION_REVOKED",
      module_key: "ACCOUNT_CONTROL",
      entity_type: "user",
      entity_id: userId,
    });
    return { logged: true };
  },

  /**
   * Return recent account_control_log entries for a given user.
   */
  async getAccountAuditLog(
    userId: string,
    limit = 50
  ): Promise<RowDataPacket[]> {
    const safeLimit = Math.min(Math.max(1, limit), 200);
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT id, user_id, action, initiated_by, ip_address, reason, created_at
       FROM account_control_log
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ${safeLimit}`,
      [userId]
    );
    return rows as RowDataPacket[];
  },
};
