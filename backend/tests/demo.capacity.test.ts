import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/db/mysql.js", () => ({
  db: { execute: vi.fn() },
  pingDb: vi.fn(),
}));
vi.mock("../src/db/supabaseAdmin.js", () => ({
  supabaseAdmin: {},
  supabaseAuthClient: { auth: { getUser: vi.fn() } },
}));

import { db } from "../src/db/mysql.js";
import { accountControlService } from "../src/modules/account-control/account.control.service.js";
import { workforceMandateService } from "../src/modules/workforce-mandate/workforce.mandate.service.js";

const exec = db.execute as ReturnType<typeof vi.fn>;

beforeEach(() => vi.clearAllMocks());

// ── Mandate + Capacity ────────────────────────────────────────────────────────

const fakeMandate = {
  id: "m-1",
  process_id: "proc-1",
  branch_id: "br-1",
  role_group: "inbound_agents",
  hc_type: "production",
  mandated_hc: 100,
  buffer_pct: 10,
  shrinkage_pct: 15,
  attrition_buffer_pct: 5,
  training_buffer_pct: 5,
  effective_from: "2026-01-01",
  effective_to: null,
  active_status: 1,
};

function mockCapacitySequence(activeCount: number) {
  // 1. mandates
  exec.mockResolvedValueOnce([[fakeMandate], []]);
  // 2. active_eligible_hc
  exec.mockResolvedValueOnce([[{ cnt: activeCount }], []]);
  // 3. on_notice_hc
  exec.mockResolvedValueOnce([[{ cnt: 3 }], []]);
  // 4. long_leave_hc
  exec.mockResolvedValueOnce([[{ cnt: 2 }], []]);
  // 5. training_pipeline
  exec.mockResolvedValueOnce([[{ cnt: 10 }], []]);
  // 6. joining_confirmed
  exec.mockResolvedValueOnce([[{ cnt: 5 }], []]);
  // 7. support_role_ratio rows (empty — no further loops)
  exec.mockResolvedValueOnce([[], []]);
}

describe("workforceMandateService.getCapacitySnapshot", () => {
  it("returns a snapshot array with the correct structure", async () => {
    mockCapacitySequence(120);
    const result = await workforceMandateService.getCapacitySnapshot("proc-1");
    expect(result).toHaveLength(1);
    const snap = result[0];
    expect(snap).toHaveProperty("mandate");
    expect(snap).toHaveProperty("target_hc");
    expect(snap).toHaveProperty("active_eligible_hc");
    expect(snap).toHaveProperty("on_notice_hc");
    expect(snap).toHaveProperty("long_leave_hc");
    expect(snap).toHaveProperty("training_pipeline");
    expect(snap).toHaveProperty("certified_pending_deployment");
    expect(snap).toHaveProperty("joining_confirmed");
    expect(snap).toHaveProperty("active_production");
    expect(snap).toHaveProperty("support_staff_split");
    expect(snap).toHaveProperty("shortage_surplus");
    expect(snap).toHaveProperty("buffer_coverage_pct");
    expect(snap).toHaveProperty("staffing_risk");
  });

  it("returns empty array when no mandates exist", async () => {
    exec.mockResolvedValueOnce([[], []]);
    const result = await workforceMandateService.getCapacitySnapshot("proc-none");
    expect(result).toHaveLength(0);
  });

  it("staffing_risk is 'red' when coverage < 80%", async () => {
    // target_hc = 100 * (1 + 10/100 + 15/100) = 125; active = 95 → coverage = 76%
    mockCapacitySequence(95);
    const [snap] = await workforceMandateService.getCapacitySnapshot("proc-1");
    expect(snap.staffing_risk).toBe("red");
  });

  it("staffing_risk is 'green' when coverage >= 95%", async () => {
    // target_hc = 125; active = 125 → coverage = 100%
    mockCapacitySequence(125);
    const [snap] = await workforceMandateService.getCapacitySnapshot("proc-1");
    expect(snap.staffing_risk).toBe("green");
  });

  it("staffing_risk is 'amber' when coverage is between 80% and 95%", async () => {
    // target_hc = 125; active = 105 → coverage ~84%
    mockCapacitySequence(105);
    const [snap] = await workforceMandateService.getCapacitySnapshot("proc-1");
    expect(snap.staffing_risk).toBe("amber");
  });

  it("shortage_surplus is negative when understaffed", async () => {
    mockCapacitySequence(95);
    const [snap] = await workforceMandateService.getCapacitySnapshot("proc-1");
    expect(snap.shortage_surplus).toBeLessThan(0);
  });

  it("shortage_surplus is positive when overstaffed", async () => {
    mockCapacitySequence(150);
    const [snap] = await workforceMandateService.getCapacitySnapshot("proc-1");
    expect(snap.shortage_surplus).toBeGreaterThan(0);
  });

  it("target_hc includes buffer_pct and shrinkage_pct", async () => {
    mockCapacitySequence(120);
    const [snap] = await workforceMandateService.getCapacitySnapshot("proc-1");
    // mandated_hc=100, buffer=10%, shrinkage=15% → target = 100 * 1.25 = 125
    expect(snap.target_hc).toBe(125);
  });

  it("certified_pending_deployment is always 0 (LMS placeholder)", async () => {
    mockCapacitySequence(120);
    const [snap] = await workforceMandateService.getCapacitySnapshot("proc-1");
    expect(snap.certified_pending_deployment).toBe(0);
  });
});

describe("workforceMandateService.getLeadershipSummary", () => {
  it("returns array of process summaries", async () => {
    exec.mockResolvedValueOnce([
      [
        { process_id: "p1", process_name: "Sales", mandated_hc: 100, active_hc: 90, shortage_surplus: -10, staffing_risk: "red" },
        { process_id: "p2", process_name: "Support", mandated_hc: 50, active_hc: 50, shortage_surplus: 0, staffing_risk: "green" },
      ],
      [],
    ]);
    const result = await workforceMandateService.getLeadershipSummary();
    expect(result).toHaveLength(2);
    expect(result[0].staffing_risk).toBe("red");
    expect(result[1].staffing_risk).toBe("green");
  });
});

describe("workforceMandateService.upsertMandate", () => {
  it("calls INSERT ON DUPLICATE KEY UPDATE and returns the upserted row", async () => {
    exec.mockResolvedValueOnce([{ affectedRows: 1 }, []]);  // INSERT
    exec.mockResolvedValueOnce([{ affectedRows: 1 }, []]);  // logSensitiveAction audit insert
    exec.mockResolvedValueOnce([[fakeMandate], []]);          // SELECT re-fetch

    const result = await workforceMandateService.upsertMandate(
      {
        processId: "proc-1",
        branchId: "br-1",
        roleGroup: "inbound_agents",
        hcType: "production",
        mandatedHc: 100,
        bufferPct: 10,
        shrinkagePct: 15,
        attritionBufferPct: 5,
        trainingBufferPct: 5,
        effectiveFrom: "2026-01-01",
      },
      "admin-uuid"
    );

    const insertCall = exec.mock.calls[0][0] as string;
    expect(insertCall).toMatch(/ON DUPLICATE KEY UPDATE/i);
    expect(result.id).toBe("m-1");
  });
});

// ── Account Control ───────────────────────────────────────────────────────────

describe("accountControlService.lockAccount", () => {
  it("inserts a row into account_control_log and returns { logged: true }", async () => {
    exec.mockResolvedValueOnce([{ affectedRows: 1 }, []]);  // insertControlLog
    exec.mockResolvedValueOnce([{ affectedRows: 1 }, []]);  // logSensitiveAction

    const result = await accountControlService.lockAccount(
      "user-1", "admin-1", "policy violation", "127.0.0.1"
    );

    expect(result).toEqual({ logged: true });
    expect(exec).toHaveBeenCalledTimes(2);
    const sql = exec.mock.calls[0][0] as string;
    expect(sql).toMatch(/INSERT INTO account_control_log/i);
  });
});

describe("accountControlService.unlockAccount", () => {
  it("logs account_unlocked and returns { logged: true }", async () => {
    exec.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    exec.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    const result = await accountControlService.unlockAccount("user-1", "admin-1", "127.0.0.1");
    expect(result).toEqual({ logged: true });
  });
});

describe("accountControlService.disableAccount", () => {
  it("logs account_disabled and returns { logged: true }", async () => {
    exec.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    exec.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    const result = await accountControlService.disableAccount(
      "user-1", "admin-1", "terminated", "10.0.0.1"
    );
    expect(result).toEqual({ logged: true });
  });
});

describe("accountControlService.enableAccount", () => {
  it("logs account_enabled and returns { logged: true }", async () => {
    exec.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    exec.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    const result = await accountControlService.enableAccount("user-1", "admin-1", "10.0.0.1");
    expect(result).toEqual({ logged: true });
  });
});

describe("accountControlService.logSessionRevoke", () => {
  it("logs session_revoked and returns { logged: true }", async () => {
    exec.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    exec.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    const result = await accountControlService.logSessionRevoke("user-1", "admin-1", "10.0.0.1");
    expect(result).toEqual({ logged: true });
  });
});

describe("accountControlService.requestPasswordReset", () => {
  it("logs password_reset_requested and returns correct message", async () => {
    exec.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    exec.mockResolvedValueOnce([{ affectedRows: 1 }, []]);

    const result = await accountControlService.requestPasswordReset(
      "user-1", "user@example.com", "admin-1", "10.0.0.1"
    );
    expect(result.logged).toBe(true);
    expect(result.message).toMatch(/Supabase Auth/i);
  });
});

describe("accountControlService.forcePasswordChange", () => {
  it("updates user_roles and logs force_change_set", async () => {
    exec.mockResolvedValueOnce([{ affectedRows: 1 }, []]);  // UPDATE user_roles
    exec.mockResolvedValueOnce([{ affectedRows: 1 }, []]);  // insertControlLog
    exec.mockResolvedValueOnce([{ affectedRows: 1 }, []]);  // logSensitiveAction
    exec.mockResolvedValueOnce([[{ user_id: "user-1", force_change_password: 1 }], []]);  // SELECT

    const result = await accountControlService.forcePasswordChange(
      "user-1", "admin-1", "expired password", "10.0.0.1"
    );

    const updateSql = exec.mock.calls[0][0] as string;
    expect(updateSql).toMatch(/UPDATE user_roles/i);
    expect(result).toHaveProperty("user_id", "user-1");
  });
});

describe("accountControlService.getAccountAuditLog", () => {
  it("queries account_control_log for userId ordered by created_at DESC", async () => {
    const fakeLog = [
      { id: "log-1", user_id: "user-1", action: "account_locked", created_at: "2026-05-30T10:00:00Z" },
      { id: "log-2", user_id: "user-1", action: "account_unlocked", created_at: "2026-05-29T09:00:00Z" },
    ];
    exec.mockResolvedValueOnce([fakeLog, []]);

    const result = await accountControlService.getAccountAuditLog("user-1", 10);
    expect(result).toHaveLength(2);
    expect(result[0].action).toBe("account_locked");

    const sql = exec.mock.calls[0][0] as string;
    expect(sql).toMatch(/ORDER BY created_at DESC/i);
    expect(sql).toMatch(/WHERE user_id = \?/i);
  });

  it("caps limit at 200", async () => {
    exec.mockResolvedValueOnce([[], []]);
    await accountControlService.getAccountAuditLog("user-1", 9999);
    const sql = exec.mock.calls[0][0] as string;
    expect(sql).toMatch(/LIMIT 200/);
  });
});
