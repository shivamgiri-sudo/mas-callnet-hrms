import type { RowDataPacket } from "mysql2";
import { db } from "../../db/mysql.js";
import { supabaseAdmin } from "../../db/supabaseAdmin.js";

export interface RbacMismatch {
  user_id: string;
  mysql_roles: string[];
  supabase_roles: string[];
  in_supabase_only: string[];
  in_mysql_only: string[];
}

export interface ReconciliationReport {
  total_mysql_users: number;
  total_supabase_users: number;
  mismatches: RbacMismatch[];
  checked_at: string;
}

/**
 * Read-only RBAC reconciliation.
 * Compares MySQL user_roles (backend authority) against Supabase user_roles (UI mirror).
 * No writes, no auto-fix, no backfill, no permission elevation.
 */
export async function getRbacReconciliation(): Promise<ReconciliationReport> {
  // 1. Fetch all active MySQL user_roles
  const [mysqlRows] = await db.execute<RowDataPacket[]>(
    "SELECT user_id, role_key FROM user_roles WHERE active_status = 1 ORDER BY user_id"
  );

  const mysqlByUser = new Map<string, string[]>();
  for (const row of mysqlRows as { user_id: string; role_key: string }[]) {
    const existing = mysqlByUser.get(row.user_id) ?? [];
    existing.push(row.role_key);
    mysqlByUser.set(row.user_id, existing);
  }

  // 2. Fetch all Supabase user_roles (UI visibility mirror)
  const { data: sbRows, error } = await supabaseAdmin
    .from("user_roles")
    .select("user_id, role")
    .order("user_id");

  if (error) throw Object.assign(new Error(`Supabase role fetch failed: ${error.message}`), { statusCode: 502 });

  const sbByUser = new Map<string, string[]>();
  for (const row of (sbRows ?? []) as { user_id: string; role: string }[]) {
    const existing = sbByUser.get(row.user_id) ?? [];
    existing.push(row.role);
    sbByUser.set(row.user_id, existing);
  }

  // 3. Union of all user_ids
  const allUsers = new Set([...mysqlByUser.keys(), ...sbByUser.keys()]);

  const mismatches: RbacMismatch[] = [];

  for (const userId of allUsers) {
    const mysqlRoles = mysqlByUser.get(userId) ?? [];
    const sbRoles = sbByUser.get(userId) ?? [];

    const inSbOnly = sbRoles.filter((r) => !mysqlRoles.includes(r));
    const inMysqlOnly = mysqlRoles.filter((r) => !sbRoles.includes(r));

    if (inSbOnly.length > 0 || inMysqlOnly.length > 0) {
      mismatches.push({
        user_id: userId,
        mysql_roles: mysqlRoles,
        supabase_roles: sbRoles,
        in_supabase_only: inSbOnly,
        in_mysql_only: inMysqlOnly,
      });
    }
  }

  return {
    total_mysql_users: mysqlByUser.size,
    total_supabase_users: sbByUser.size,
    mismatches,
    checked_at: new Date().toISOString(),
  };
}
