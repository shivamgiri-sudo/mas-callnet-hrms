import { randomUUID } from "crypto";
import type { Request } from "express";
import type { RowDataPacket } from "mysql2";
import { db } from "../../db/mysql.js";
import { logSensitiveAction } from "../../shared/auditLog.js";

export interface PayslipData {
  id: string;
  run_id: string;
  employee_id: string;
  payslip_ref: string;
  generated_at: string;
  generated_by: string | null;
  file_url: string | null;
  acknowledged_at: string | null;
  // Computed from prep_line
  employee_code?: string;
  run_month?: string;
  gross_salary?: number;
  total_deductions?: number;
  net_salary?: number;
  pf_employee?: number;
  esic_employee?: number;
  professional_tax?: number;
  tds?: number;
  basic?: number;
  hra?: number;
  working_days?: number;
  present_days?: number;
  lwp_days?: number;
}

export const payslipService = {
  /**
   * Generate a payslip record for a given employee within a run.
   * Fetches salary_prep_line data and inserts into salary_payslip.
   * Logs a sensitive PAYSLIP_GENERATED audit entry.
   */
  async generatePayslip(
    runId: string,
    employeeId: string,
    generatedBy: string,
    req?: Request
  ): Promise<PayslipData> {
    // Fetch the prep line
    const [lineRows] = await db.execute<RowDataPacket[]>(
      `SELECT spl.*, spr.run_month
         FROM salary_prep_line spl
         JOIN salary_prep_run  spr ON spr.id = spl.run_id
        WHERE spl.run_id = ? AND spl.employee_id = ?
        LIMIT 1`,
      [runId, employeeId]
    );
    const line = (lineRows as any[])[0];
    if (!line) {
      throw new Error("Prep line not found for this run and employee");
    }

    const payslipRef = `PS-${line.run_month}-${line.employee_code}`;
    const id = randomUUID();

    // Upsert: if payslip already exists for this run+employee, overwrite it
    await db.execute(
      `INSERT INTO salary_payslip
         (id, run_id, employee_id, payslip_ref, generated_by, acknowledged_at)
       VALUES (?, ?, ?, ?, ?, NULL)
       ON DUPLICATE KEY UPDATE
         payslip_ref  = VALUES(payslip_ref),
         generated_at = CURRENT_TIMESTAMP,
         generated_by = VALUES(generated_by),
         acknowledged_at = NULL`,
      [id, runId, employeeId, payslipRef, generatedBy]
    );

    void logSensitiveAction({
      actor_user_id: generatedBy,
      action_type: "PAYSLIP_GENERATED",
      module_key: "payroll",
      entity_type: "salary_payslip",
      entity_id: employeeId,
      change_summary: { run_id: runId, run_month: line.run_month },
      req,
    });

    return this.getPayslip(employeeId, runId);
  },

  /**
   * Retrieve a payslip with prep_line data merged in.
   * Returns text/JSON only — no PDF generation.
   */
  async getPayslip(employeeId: string, runId: string): Promise<PayslipData> {
    const [rows] = await db.execute<RowDataPacket[]>(
      `SELECT sp.*,
              spl.employee_code,
              spr.run_month,
              spl.gross_salary,
              spl.total_deductions,
              spl.net_salary,
              spl.pf_employee,
              spl.esic_employee,
              spl.professional_tax,
              spl.tds,
              spl.working_days,
              spl.present_days,
              spl.lwp_days
         FROM salary_payslip sp
         JOIN salary_prep_line spl ON spl.run_id = sp.run_id AND spl.employee_id = sp.employee_id
         JOIN salary_prep_run  spr ON spr.id = sp.run_id
        WHERE sp.employee_id = ? AND sp.run_id = ?
        LIMIT 1`,
      [employeeId, runId]
    );
    const rec = (rows as PayslipData[])[0];
    if (!rec) throw new Error("Payslip not found");
    return rec;
  },

  /**
   * Acknowledge a payslip — only the owning employee may acknowledge.
   * Enforces ownership: returns 403 if employeeId does not match.
   */
  async acknowledgePayslip(
    payslipId: string,
    requestingEmployeeId: string
  ): Promise<PayslipData> {
    const [rows] = await db.execute<RowDataPacket[]>(
      "SELECT * FROM salary_payslip WHERE id = ? LIMIT 1",
      [payslipId]
    );
    const rec = (rows as any[])[0];
    if (!rec) throw new Error("Payslip not found");

    if (rec.employee_id !== requestingEmployeeId) {
      const err: any = new Error("Forbidden: you may only acknowledge your own payslip");
      err.statusCode = 403;
      throw err;
    }

    await db.execute(
      "UPDATE salary_payslip SET acknowledged_at = NOW() WHERE id = ?",
      [payslipId]
    );

    return this.getPayslip(rec.employee_id, rec.run_id);
  },
};
