import { randomUUID } from "crypto";
import type { Request } from "express";
import type { RowDataPacket } from "mysql2";
import { db } from "../../db/mysql.js";
import { logSensitiveAction } from "../../shared/auditLog.js";

export interface FfInput {
  calculationDate: string;
  noticePeriodDays?: number;
  noticeShortfallDays?: number;
  noticeRecovery?: number;
  earnedLeaveEncashment?: number;
  gratuityAmount?: number;
  salaryHold?: number;
  advancesRecovery?: number;
  netPayable?: number;
}

export interface FullFinalCalculation {
  id: string;
  exit_request_id: string;
  employee_id: string;
  calculation_date: string;
  notice_period_days: number;
  notice_shortfall_days: number;
  notice_recovery: number;
  earned_leave_encashment: number;
  gratuity_amount: number;
  salary_hold: number;
  advances_recovery: number;
  net_payable: number;
  status: "draft" | "verified" | "approved" | "paid";
  prepared_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  // joined fields
  employee_name?: string;
}

export const ffService = {
  /**
   * Create a Full & Final calculation for an exit request.
   * Logs FULL_FINAL_CREATED audit entry.
   */
  async createFF(
    exitRequestId: string,
    data: FfInput,
    preparedBy: string,
    req?: Request
  ): Promise<FullFinalCalculation> {
    // Verify exit_request exists and get employee_id
    const [exitRows] = await db.execute<RowDataPacket[]>(
      "SELECT id, employee_id FROM exit_request WHERE id = ? LIMIT 1",
      [exitRequestId]
    );
    const exitReq = (exitRows as any[])[0];
    if (!exitReq) throw new Error("Exit request not found");

    const id = randomUUID();
    await db.execute(
      `INSERT INTO full_final_calculation
         (id, exit_request_id, employee_id, calculation_date,
          notice_period_days, notice_shortfall_days, notice_recovery,
          earned_leave_encashment, gratuity_amount, salary_hold,
          advances_recovery, net_payable, status, prepared_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)`,
      [
        id,
        exitRequestId,
        exitReq.employee_id,
        data.calculationDate,
        data.noticePeriodDays    ?? 0,
        data.noticeShortfallDays ?? 0,
        data.noticeRecovery      ?? 0,
        data.earnedLeaveEncashment ?? 0,
        data.gratuityAmount      ?? 0,
        data.salaryHold          ?? 0,
        data.advancesRecovery    ?? 0,
        data.netPayable          ?? 0,
        preparedBy,
      ]
    );

    void logSensitiveAction({
      actor_user_id: preparedBy,
      action_type: "FULL_FINAL_CREATED",
      module_key: "exit",
      entity_type: "full_final_calculation",
      entity_id: id,
      change_summary: { exit_request_id: exitRequestId, employee_id: exitReq.employee_id },
      req,
    });

    return this.getFF(exitRequestId);
  },

  /**
   * Fetch F&F calculation with employee name joined.
   */
  async getFF(exitRequestId: string): Promise<FullFinalCalculation> {
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT ff.*,
              CONCAT_WS(' ', e.first_name, e.last_name) AS employee_name
         FROM full_final_calculation ff
         LEFT JOIN employees e ON e.id = ff.employee_id
        WHERE ff.exit_request_id = ?
        LIMIT 1`,
      [exitRequestId]
    );
    const rec = (rows as FullFinalCalculation[])[0];
    if (!rec) throw new Error("F&F calculation not found");
    return rec;
  },

  /**
   * Approve an F&F calculation. Admin only (enforced at route level).
   * Logs FULL_FINAL_APPROVED audit entry.
   */
  async approveFF(
    id: string,
    approvedBy: string,
    req?: Request
  ): Promise<FullFinalCalculation> {
    const [rows] = await db.execute<RowDataPacket[]>(
      "SELECT * FROM full_final_calculation WHERE id = ? LIMIT 1",
      [id]
    );
    const rec = (rows as any[])[0];
    if (!rec) throw new Error("F&F calculation not found");
    if (rec.status === "paid") throw new Error("F&F already paid — cannot re-approve");

    await db.execute(
      `UPDATE full_final_calculation
          SET status = 'approved', approved_by = ?, approved_at = NOW(), updated_at = NOW()
        WHERE id = ?`,
      [approvedBy, id]
    );

    void logSensitiveAction({
      actor_user_id: approvedBy,
      action_type: "FULL_FINAL_APPROVED",
      module_key: "exit",
      entity_type: "full_final_calculation",
      entity_id: id,
      change_summary: { exit_request_id: rec.exit_request_id },
      req,
    });

    return this.getFF(rec.exit_request_id);
  },

  /**
   * Gratuity calculation per Payment of Gratuity Act.
   * Eligibility: continuous service >= 5 years.
   * Formula: (lastGrossMonthly / 26) * 15 * completedYears
   *
   * @param doj   - Date of joining (ISO string or Date)
   * @param exitDate - Last working date (ISO string or Date)
   * @param lastGross - Last month's gross salary (monthly)
   * @returns Gratuity amount in INR; 0 if tenure < 5 years
   */
  calculateGratuity(
    doj: string | Date,
    exitDate: string | Date,
    lastGross: number
  ): number {
    const joinDate  = new Date(doj);
    const lwd       = new Date(exitDate);

    // Tenure in fractional years
    const diffMs   = lwd.getTime() - joinDate.getTime();
    const tenureYears = diffMs / (365.25 * 24 * 60 * 60 * 1000);
    const completedYears = Math.floor(tenureYears);

    if (completedYears < 5) return 0;

    const gratuity = (lastGross / 26) * 15 * completedYears;
    return Math.round(gratuity * 100) / 100;
  },
};
