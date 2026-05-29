import { randomUUID } from "crypto";
import type { RowDataPacket } from "mysql2";
import { db } from "../../db/mysql.js";

export interface TaxDeclarationInput {
  regime?: "old" | "new";
  totalInvestment?: number;
  declaredHra?: number;
  declared80c?: number;
  declared80d?: number;
}

export interface TaxDeclaration {
  id: string;
  employee_id: string;
  financial_year: string;
  regime: "old" | "new";
  total_investment: number;
  declared_hra: number;
  declared_80c: number;
  declared_80d: number;
  tds_projected: number;
  submitted_by: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Compute a basic projected TDS figure.
 * Reads tds_slab from statutory_config if available; else uses statutory defaults.
 * Result is a provisional projection only — not a filed / challan value.
 */
async function computeBasicTds(annualTaxable: number): Promise<number> {
  // Attempt to read slab from statutory_config
  const [rows] = await db.execute<RowDataPacket[]>(
    "SELECT config_key, config_value FROM statutory_config WHERE config_key LIKE 'tds_slab_%'"
  );
  const slabMap: Record<string, number> = {};
  for (const r of rows as { config_key: string; config_value: number }[]) {
    slabMap[r.config_key] = r.config_value;
  }

  // Use configurable thresholds or statutory defaults (FY 2026-27 new regime)
  const s1 = slabMap["tds_slab_1_limit"] ?? 300000;   // 0%  up to ₹3L
  const s2 = slabMap["tds_slab_2_limit"] ?? 600000;   // 5%  ₹3L–6L
  const s3 = slabMap["tds_slab_3_limit"] ?? 900000;   // 10% ₹6L–9L
  const s4 = slabMap["tds_slab_4_limit"] ?? 1200000;  // 15% ₹9L–12L
  const s5 = slabMap["tds_slab_5_limit"] ?? 1500000;  // 20% ₹12L–15L
  // Above ₹15L: 30%

  const r2 = (n: number) => Math.round(n * 100) / 100;

  if (annualTaxable <= s1) return 0;

  let tax = 0;
  const slabs = [
    { from: 0,    to: s1, rate: 0    },
    { from: s1,   to: s2, rate: 0.05 },
    { from: s2,   to: s3, rate: 0.10 },
    { from: s3,   to: s4, rate: 0.15 },
    { from: s4,   to: s5, rate: 0.20 },
    { from: s5,   to: Infinity, rate: 0.30 },
  ];

  for (const slab of slabs) {
    if (annualTaxable <= slab.from) break;
    const taxable = Math.min(annualTaxable, slab.to) - slab.from;
    tax += taxable * slab.rate;
  }

  return r2(tax);
}

export const taxDeclarationService = {
  /**
   * Upsert a tax declaration for an employee and financial year.
   * Recomputes tds_projected on each save.
   */
  async upsert(
    employeeId: string,
    financialYear: string,
    data: TaxDeclarationInput,
    submittedBy: string
  ): Promise<TaxDeclaration> {
    // Fetch employee annual CTC for projection base
    const [salRows] = await db.execute<RowDataPacket[]>(
      "SELECT ctc_annual FROM employee_salary_assignment WHERE employee_id = ? AND active_status = 1 LIMIT 1",
      [employeeId]
    );
    const ctcAnnual: number = (salRows as any[])[0]?.ctc_annual ?? 0;

    const regime = data.regime ?? "new";
    const inv80c  = data.declared80c ?? 0;
    const inv80d  = data.declared80d ?? 0;
    const invHra  = data.declaredHra ?? 0;
    const totalInv = data.totalInvestment ?? (inv80c + inv80d);

    // Basic taxable income — gross minus standard deduction and exemptions
    const standardDeduction = 75000; // FY 2026-27 new regime
    let taxable = ctcAnnual - standardDeduction;
    if (regime === "old") {
      taxable = taxable - inv80c - inv80d - invHra;
    }
    taxable = Math.max(0, taxable);

    const tdsProjected = await computeBasicTds(taxable);

    const id = randomUUID();
    await db.execute(
      `INSERT INTO tax_declaration
         (id, employee_id, financial_year, regime, total_investment,
          declared_hra, declared_80c, declared_80d, tds_projected, submitted_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         regime            = VALUES(regime),
         total_investment  = VALUES(total_investment),
         declared_hra      = VALUES(declared_hra),
         declared_80c      = VALUES(declared_80c),
         declared_80d      = VALUES(declared_80d),
         tds_projected     = VALUES(tds_projected),
         submitted_by      = VALUES(submitted_by),
         updated_at        = CURRENT_TIMESTAMP`,
      [id, employeeId, financialYear, regime, totalInv, invHra, inv80c, inv80d, tdsProjected, submittedBy]
    );

    return this.get(employeeId, financialYear);
  },

  async get(employeeId: string, financialYear: string): Promise<TaxDeclaration> {
    const [rows] = await db.execute<RowDataPacket[]>(
      "SELECT * FROM tax_declaration WHERE employee_id = ? AND financial_year = ? LIMIT 1",
      [employeeId, financialYear]
    );
    const rec = (rows as TaxDeclaration[])[0];
    if (!rec) throw new Error("Tax declaration not found");
    return rec;
  },
};
