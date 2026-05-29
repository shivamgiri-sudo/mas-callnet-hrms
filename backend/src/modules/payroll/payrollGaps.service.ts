import type { RowDataPacket } from "mysql2";
import { db } from "../../db/mysql.js";

/**
 * Payroll gap-fix service — addresses calculation gaps identified in Phase 0 audit:
 *  1. Working days calculation: holiday-calendar-aware (with 26-day fallback)
 *  2. LWP deduction formula
 *  3. Basic TDS slab projection (provisional, not filed)
 */
export const payrollGapsService = {
  /**
   * Return the number of working days for a given month and branch.
   * Queries leave_holiday_master for the month's holidays and subtracts them
   * from the total weekdays (Mon–Sat BPO standard).
   * Falls back to 26 when no holiday master entry exists for the month/branch.
   */
  async calculateWorkingDaysFromHolidays(
    month: string,  // format: YYYY-MM
    branchId?: string
  ): Promise<number> {
    const [year, mon] = month.split("-").map(Number);
    if (!year || !mon) return 26;

    try {
      const start = `${month}-01`;
      const end   = `${month}-${new Date(year, mon, 0).getDate().toString().padStart(2, "0")}`;

      const conds = ["holiday_date BETWEEN ? AND ?", "active_status = 1"];
      const params: unknown[] = [start, end];
      if (branchId) {
        conds.push("(branch_id = ? OR branch_id IS NULL)");
        params.push(branchId);
      }

      const [rows] = await db.execute<RowDataPacket[]>(
        `SELECT COUNT(*) AS holiday_count
           FROM leave_holiday_master
          WHERE ${conds.join(" AND ")}`,
        params
      );

      const holidayCount: number = (rows as any[])[0]?.holiday_count ?? 0;

      // BPO standard: Mon–Sat = 26 working days, minus holidays
      const workingDays = Math.max(1, 26 - Number(holidayCount));
      return workingDays;
    } catch {
      // Table may not exist on this schema version — safe fallback
      return 26;
    }
  },

  /**
   * Calculate LWP deduction amount.
   * Formula: lwpDays × (ctcAnnual / 12 / workingDays)
   */
  calculateLwpDeduction(
    lwpDays: number,
    ctcAnnual: number,
    workingDays: number
  ): number {
    if (lwpDays <= 0 || workingDays <= 0 || ctcAnnual <= 0) return 0;
    const dailyRate = ctcAnnual / 12 / workingDays;
    return Math.round(lwpDays * dailyRate * 100) / 100;
  },

  /**
   * Compute a basic projected TDS using statutory slab.
   * Reads from statutory_config if tds_slab_* keys exist; otherwise uses
   * FY 2026-27 new-regime defaults.
   * Result is PROVISIONAL — not a filed value.
   */
  async computeBasicTds(annualTaxable: number): Promise<number> {
    if (annualTaxable <= 0) return 0;

    let slabMap: Record<string, number> = {};
    try {
      const [rows] = await db.execute<RowDataPacket[]>(
        "SELECT config_key, config_value FROM statutory_config WHERE config_key LIKE 'tds_slab_%'"
      );
      for (const r of rows as { config_key: string; config_value: number }[]) {
        slabMap[r.config_key] = r.config_value;
      }
    } catch {
      // statutory_config may not have TDS keys; use defaults
    }

    const s1 = slabMap["tds_slab_1_limit"] ?? 300000;
    const s2 = slabMap["tds_slab_2_limit"] ?? 600000;
    const s3 = slabMap["tds_slab_3_limit"] ?? 900000;
    const s4 = slabMap["tds_slab_4_limit"] ?? 1200000;
    const s5 = slabMap["tds_slab_5_limit"] ?? 1500000;

    if (annualTaxable <= s1) return 0;

    const slabs = [
      { from: 0,  to: s1,       rate: 0    },
      { from: s1, to: s2,       rate: 0.05 },
      { from: s2, to: s3,       rate: 0.10 },
      { from: s3, to: s4,       rate: 0.15 },
      { from: s4, to: s5,       rate: 0.20 },
      { from: s5, to: Infinity, rate: 0.30 },
    ];

    let tax = 0;
    for (const slab of slabs) {
      if (annualTaxable <= slab.from) break;
      const taxable = Math.min(annualTaxable, slab.to) - slab.from;
      tax += taxable * slab.rate;
    }

    return Math.round(tax * 100) / 100;
  },
};
