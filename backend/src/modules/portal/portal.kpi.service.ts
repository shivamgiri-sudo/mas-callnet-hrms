import type { RowDataPacket } from "mysql2";
import { db } from "../../db/mysql.js";
import type { KpiScorecard } from "./portal.types.js";

export const portalKpiService = {
  computeAchievement(actual: number, target: number, direction: string): number {
    if (target === 0) return 0;
    const raw = direction === "higher_is_better" ? (actual / target) * 100 : (target / actual) * 100;
    return Math.min(Math.round(raw * 100) / 100, 120);
  },

  ragFromAchievement(pct: number): "green" | "amber" | "red" {
    if (pct >= 100) return "green";
    if (pct >= 85) return "amber";
    return "red";
  },

  async getScorecards(processId: string, period: string, allowedProcessIds?: string[]): Promise<KpiScorecard[]> {
    // Defence-in-depth: verify the caller is allowed to access this processId.
    // The controller already calls assertProcessAccess but this layer adds a second check.
    if (!processId) throw Object.assign(new Error("processId is required"), { statusCode: 400 });
    if (allowedProcessIds !== undefined && !allowedProcessIds.includes(processId)) {
      throw Object.assign(new Error("Process not in your access list"), { statusCode: 403 });
    }
    if (!/^\d{4}-\d{2}$/.test(period)) throw new Error(`Invalid period format: ${period}`);

    // Fetch process name first to build a safe parameterized LIKE
    const [procRows] = await db.execute<RowDataPacket[]>(
      "SELECT process_name FROM process_master WHERE id = ? LIMIT 1",
      [processId]
    );
    const procName = (procRows as RowDataPacket[])[0]?.process_name as string | undefined;
    if (!procName) return [];

    const [metricRows] = await db.execute<RowDataPacket[]>(
      `SELECT
         m.id AS metric_id, m.metric_code, m.metric_name, m.unit, m.direction,
         tm.target_value,
         ks.actual_value
       FROM kpi_template kt
       JOIN kpi_template_metric tm ON tm.template_id = kt.id
       JOIN kpi_metric_master m ON m.id = tm.metric_id
       LEFT JOIN kpi_score ks ON ks.metric_id = m.id AND ks.period = ?
       WHERE kt.template_name LIKE ?
       ORDER BY m.category, m.metric_name`,
      [period, `%${procName.replace(/[%_\\]/g, "\\$&")}%`]
    );

    const metricIds = (metricRows as RowDataPacket[]).map(r => r.metric_id);
    const sparkMap = new Map<string, Array<{ period: string; value: number }>>();

    if (metricIds.length > 0) {
      const sixMonthsAgo = getSixMonthsAgo(period);
      const placeholders = metricIds.map(() => "?").join(",");
      const [sparkRows] = await db.execute<RowDataPacket[]>(
        `SELECT metric_id, period, actual_value
         FROM kpi_score
         WHERE metric_id IN (${placeholders}) AND period >= ? AND period <= ?
         ORDER BY metric_id, period`,
        [...metricIds, sixMonthsAgo, period]
      );
      for (const row of sparkRows as RowDataPacket[]) {
        if (!sparkMap.has(row.metric_id)) sparkMap.set(row.metric_id, []);
        sparkMap.get(row.metric_id)!.push({ period: row.period, value: row.actual_value });
      }
    }

    return (metricRows as RowDataPacket[]).map(row => {
      const ach = row.actual_value != null
        ? portalKpiService.computeAchievement(row.actual_value, row.target_value, row.direction)
        : 0;
      return {
        metric_id: row.metric_id,
        metric_code: row.metric_code,
        metric_name: row.metric_name,
        unit: row.unit,
        direction: row.direction,
        target: row.target_value,
        actual: row.actual_value ?? null,
        achievement_pct: ach,
        rag: portalKpiService.ragFromAchievement(ach),
        sparkline: sparkMap.get(row.metric_id) ?? [],
      };
    });
  },
};

function getSixMonthsAgo(period: string): string {
  const [y, m] = period.split("-").map(Number);
  let year = y;
  let month = m - 6;
  while (month <= 0) { month += 12; year -= 1; }
  return `${year}-${String(month).padStart(2, "0")}`;
}
