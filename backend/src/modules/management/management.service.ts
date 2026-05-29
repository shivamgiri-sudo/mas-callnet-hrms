import { randomUUID } from "crypto";
import type { RowDataPacket } from "mysql2";
import { db } from "../../db/mysql.js";
import { logSensitiveAction } from "../../shared/auditLog.js";
import type { Request } from "express";

export const managementService = {
  async getTeamKpiSummary(filters: { process_id?: string; period?: string; branch_id?: string }) {
    const conds: string[] = ["e.active_status = 1"];
    const params: unknown[] = [];
    if (filters.process_id) { conds.push("e.process_id = ?"); params.push(filters.process_id); }
    if (filters.branch_id)  { conds.push("e.branch_id = ?");  params.push(filters.branch_id); }
    const period = filters.period ?? "2026-05";
    conds.push("mks.period = ?"); params.push(period);
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT mks.*, e.employee_code, e.full_name, p.process_name
         FROM management_kpi_summary mks
         JOIN employees e ON e.id = mks.employee_id
         LEFT JOIN process_master p ON p.id = e.process_id
        WHERE ${conds.join(" AND ")}
        ORDER BY mks.rank_position ASC, mks.overall_score DESC LIMIT 200`,
      params
    );
    return rows as RowDataPacket[];
  },

  async listCoachingSessions(filters: { employee_id?: string; coach_user_id?: string; status?: string }) {
    const conds: string[] = ["1=1"];
    const params: unknown[] = [];
    if (filters.employee_id)   { conds.push("cs.employee_id = ?");   params.push(filters.employee_id); }
    if (filters.coach_user_id) { conds.push("cs.coach_user_id = ?"); params.push(filters.coach_user_id); }
    if (filters.status)        { conds.push("cs.status = ?");        params.push(filters.status); }
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT cs.*, e.employee_code, e.full_name FROM coaching_session cs
         JOIN employees e ON e.id = cs.employee_id
        WHERE ${conds.join(" AND ")} ORDER BY cs.session_date DESC LIMIT 200`,
      params
    );
    return rows as RowDataPacket[];
  },

  async createCoachingSession(data: {
    employee_id: string; session_date: string; session_type: string;
    notes?: string; action_items?: Record<string, unknown>[];
  }, coachUserId: string, req?: Request) {
    const id = randomUUID();
    await db.execute(
      "INSERT INTO coaching_session (id, employee_id, coach_user_id, session_date, session_type, notes, action_items) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [id, data.employee_id, coachUserId, data.session_date, data.session_type, data.notes ?? null, data.action_items ? JSON.stringify(data.action_items) : null]
    );
    await logSensitiveAction({ actor_user_id: coachUserId, action_type: "COACHING_SESSION_CREATED", module_key: "MANAGEMENT", entity_type: "employee", entity_id: data.employee_id, req });
    const [rows] = await db.execute<RowDataPacket[]>("SELECT * FROM coaching_session WHERE id = ? LIMIT 1", [id]);
    return (rows as RowDataPacket[])[0];
  },

  async listAlerts(filters: { employee_id?: string; severity?: string; acknowledged?: boolean }) {
    const conds: string[] = ["1=1"];
    const params: unknown[] = [];
    if (filters.employee_id)                { conds.push("pa.employee_id = ?"); params.push(filters.employee_id); }
    if (filters.severity)                   { conds.push("pa.severity = ?");    params.push(filters.severity); }
    if (filters.acknowledged !== undefined) { conds.push("pa.acknowledged = ?"); params.push(filters.acknowledged ? 1 : 0); }
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT pa.*, e.employee_code, e.full_name FROM performance_alert pa
         JOIN employees e ON e.id = pa.employee_id
        WHERE ${conds.join(" AND ")} ORDER BY pa.created_at DESC LIMIT 200`,
      params
    );
    return rows as RowDataPacket[];
  },

  async acknowledgeAlert(alertId: string, acknowledgedBy: string, req?: Request) {
    await db.execute("UPDATE performance_alert SET acknowledged = 1, acknowledged_by = ?, acknowledged_at = NOW() WHERE id = ?", [acknowledgedBy, alertId]);
    await logSensitiveAction({ actor_user_id: acknowledgedBy, action_type: "ALERT_ACKNOWLEDGED", module_key: "MANAGEMENT", entity_type: "performance_alert", entity_id: alertId, req });
  },

  async getDashboardSummary(processId?: string) {
    const proc = processId ? "AND e.process_id = ?" : "";
    const params: unknown[] = processId ? [processId] : [];
    const [kpiRows] = await db.execute<RowDataPacket[]>(`SELECT COUNT(*) AS employees_with_kpi, AVG(overall_score) AS avg_score FROM management_kpi_summary mks JOIN employees e ON e.id = mks.employee_id WHERE 1=1 ${proc}`, params);
    const [coachRows] = await db.execute<RowDataPacket[]>(`SELECT COUNT(*) AS pending_sessions FROM coaching_session cs JOIN employees e ON e.id = cs.employee_id WHERE cs.status = 'scheduled' ${proc}`, params);
    const [alertRows] = await db.execute<RowDataPacket[]>(`SELECT COUNT(*) AS unacked_critical FROM performance_alert pa JOIN employees e ON e.id = pa.employee_id WHERE pa.acknowledged = 0 AND pa.severity IN ('high','critical') ${proc}`, params);
    return {
      kpi: (kpiRows as RowDataPacket[])[0],
      coaching: (coachRows as RowDataPacket[])[0],
      alerts: (alertRows as RowDataPacket[])[0],
    };
  },
};
