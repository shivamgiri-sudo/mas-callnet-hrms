/**
 * demo.seed.ts
 * Demo Package: Account Control, Workforce Mandate and Capacity Planning
 *
 * Safety gates:
 *   - Only runs when NODE_ENV !== 'production'
 *   - Only runs when ALLOW_DEMO_SEED === 'true'
 *   - Passwords are NEVER written to MySQL (Supabase Auth owns credentials)
 *   - MySQL stores user_id (UUID), email, role, force_change_password flag only
 *   - All inserts are idempotent via ON DUPLICATE KEY UPDATE / IF NOT EXISTS logic
 */

import { randomUUID } from "node:crypto";
import { db } from "../../db/mysql.js";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DemoSeedResult {
  inserted: number;
  skipped: number;
  errors: string[];
}

interface InsertOutcome {
  affectedRows: number;
  isNew: boolean;
}

// ---------------------------------------------------------------------------
// Safety gate (enforced before any DB access)
// ---------------------------------------------------------------------------

function assertSeedAllowed(): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error("SEED_BLOCKED: demo seed must not run in production.");
  }
  if (process.env.ALLOW_DEMO_SEED !== "true") {
    throw new Error(
      "SEED_BLOCKED: set ALLOW_DEMO_SEED=true to run demo seed (non-production only)."
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Execute an INSERT … ON DUPLICATE KEY UPDATE and return outcome. */
async function upsertRow(
  sql: string,
  values: readonly unknown[]
): Promise<InsertOutcome> {
  const [result] = await db.execute<ResultSetHeader>(sql, values);
  // affectedRows=1 → new insert, affectedRows=2 → updated, affectedRows=0 → no change
  return {
    affectedRows: result.affectedRows,
    isNew: result.affectedRows === 1,
  };
}

/** Check whether a row exists in a table by a single unique column. */
async function rowExists(
  table: string,
  column: string,
  value: string
): Promise<boolean> {
  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT 1 FROM \`${table}\` WHERE \`${column}\` = ? LIMIT 1`,
    [value]
  );
  return rows.length > 0;
}

// ---------------------------------------------------------------------------
// Process / branch helpers — insert only if not already present
// ---------------------------------------------------------------------------

async function ensureProcess(
  id: string,
  name: string,
  processType: string,
  createdBy: string
): Promise<InsertOutcome> {
  return upsertRow(
    `INSERT INTO process_master
       (id, process_name, process_type, active_status, created_by, created_at, updated_at)
     VALUES (?, ?, ?, 1, ?, NOW(), NOW())
     ON DUPLICATE KEY UPDATE process_name = VALUES(process_name)`,
    [id, name, processType, createdBy]
  );
}

async function ensureBranch(
  id: string,
  name: string,
  city: string,
  createdBy: string
): Promise<InsertOutcome> {
  return upsertRow(
    `INSERT INTO branch_master
       (id, branch_name, city, active_status, created_by, created_at, updated_at)
     VALUES (?, ?, ?, 1, ?, NOW(), NOW())
     ON DUPLICATE KEY UPDATE branch_name = VALUES(branch_name)`,
    [id, name, city, createdBy]
  );
}

// ---------------------------------------------------------------------------
// Employee upsert
// ---------------------------------------------------------------------------

async function ensureEmployee(params: {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  email: string;
  designation: string;
  process_id: string;
  branch_id: string;
  user_id: string;
  created_by: string;
}): Promise<InsertOutcome> {
  return upsertRow(
    `INSERT INTO employees
       (id, employee_code, first_name, last_name, email, designation,
        process_id, branch_id, user_id, active_status, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, NOW(), NOW())
     ON DUPLICATE KEY UPDATE
       first_name   = VALUES(first_name),
       last_name    = VALUES(last_name),
       designation  = VALUES(designation)`,
    [
      params.id,
      params.employee_code,
      params.first_name,
      params.last_name,
      params.email,
      params.designation,
      params.process_id,
      params.branch_id,
      params.user_id,
      params.created_by,
    ]
  );
}

// ---------------------------------------------------------------------------
// user_roles upsert
// ---------------------------------------------------------------------------

async function ensureUserRole(
  userId: string,
  email: string,
  roleKey: string,
  createdBy: string
): Promise<InsertOutcome> {
  return upsertRow(
    `INSERT INTO user_roles
       (id, user_id, email, role_key, force_change_password, active_status,
        created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, 1, 1, ?, NOW(), NOW())
     ON DUPLICATE KEY UPDATE
       role_key              = VALUES(role_key),
       force_change_password = 1`,
    [randomUUID(), userId, email, roleKey, createdBy]
  );
}

// ---------------------------------------------------------------------------
// Workforce mandate upsert
// ---------------------------------------------------------------------------

async function ensureMandate(params: {
  processId: string;
  branchId: string;
  roleGroup: string;
  hcType: "production" | "support";
  mandatedHc: number;
  bufferPct: number;
  shrinkagePct: number;
  attritionBufferPct: number;
  trainingBufferPct: number;
  createdBy: string;
}): Promise<InsertOutcome> {
  const effectiveFrom = "2025-01-01";
  return upsertRow(
    `INSERT INTO workforce_mandate
       (id, process_id, branch_id, role_group, hc_type, mandated_hc,
        buffer_pct, shrinkage_pct, attrition_buffer_pct, training_buffer_pct,
        effective_from, active_status, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, NOW(), NOW())
     ON DUPLICATE KEY UPDATE
       mandated_hc           = VALUES(mandated_hc),
       buffer_pct            = VALUES(buffer_pct),
       shrinkage_pct         = VALUES(shrinkage_pct),
       attrition_buffer_pct  = VALUES(attrition_buffer_pct),
       training_buffer_pct   = VALUES(training_buffer_pct)`,
    [
      randomUUID(),
      params.processId,
      params.branchId,
      params.roleGroup,
      params.hcType,
      params.mandatedHc,
      params.bufferPct,
      params.shrinkagePct,
      params.attritionBufferPct,
      params.trainingBufferPct,
      effectiveFrom,
      params.createdBy,
    ]
  );
}

// ---------------------------------------------------------------------------
// Support role ratio upsert
// ---------------------------------------------------------------------------

async function ensureSupportRatio(params: {
  processId: string;
  supportRole: string;
  ratioType: "per_agents" | "per_tl" | "per_batch" | "per_trainee_count";
  ratioValue: number;
}): Promise<InsertOutcome> {
  const effectiveFrom = "2025-01-01";
  return upsertRow(
    `INSERT INTO support_role_ratio
       (id, process_id, support_role, ratio_type, ratio_value,
        effective_from, active_status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, NOW(), NOW())
     ON DUPLICATE KEY UPDATE
       ratio_value = VALUES(ratio_value)`,
    [
      randomUUID(),
      params.processId,
      params.supportRole,
      params.ratioType,
      params.ratioValue,
      effectiveFrom,
    ]
  );
}

// ---------------------------------------------------------------------------
// Tally helper
// ---------------------------------------------------------------------------

function tally(
  result: DemoSeedResult,
  outcome: InsertOutcome,
  label: string
): void {
  if (outcome.isNew) {
    result.inserted += 1;
  } else {
    result.skipped += 1;
  }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function runDemoSeed(): Promise<DemoSeedResult> {
  assertSeedAllowed();

  const result: DemoSeedResult = { inserted: 0, skipped: 0, errors: [] };

  // System seed actor — stable UUID for "created_by" attribution
  const SEED_ACTOR = "00000000-0000-0000-0000-000000000001";

  // Well-known process / branch UUIDs (deterministic for idempotency)
  const PROC_INBOUND  = "10000001-demo-0000-0000-000000000001";
  const PROC_OUTBOUND = "10000001-demo-0000-0000-000000000002";
  const BRANCH_MUMBAI = "20000001-demo-0000-0000-000000000001";
  const BRANCH_DELHI  = "20000001-demo-0000-0000-000000000002";
  const BRANCH_HO     = "20000001-demo-0000-0000-000000000003";

  // ------------------------------------------------------------------
  // 1. Processes
  // ------------------------------------------------------------------
  const processes: Array<[string, string, string]> = [
    [PROC_INBOUND,  "Neemans_Inbound",  "inbound"],
    [PROC_OUTBOUND, "Neemans_Outbound", "outbound"],
  ];
  for (const [id, name, type] of processes) {
    try {
      tally(result, await ensureProcess(id, name, type, SEED_ACTOR), name);
    } catch (e: unknown) {
      result.errors.push(`process ${name}: ${(e as Error).message}`);
    }
  }

  // ------------------------------------------------------------------
  // 2. Branches
  // ------------------------------------------------------------------
  const branches: Array<[string, string, string]> = [
    [BRANCH_MUMBAI, "Mumbai",    "Mumbai"],
    [BRANCH_DELHI,  "Delhi",     "Delhi"],
    [BRANCH_HO,     "HO Mumbai", "Mumbai"],
  ];
  for (const [id, name, city] of branches) {
    try {
      tally(result, await ensureBranch(id, name, city, SEED_ACTOR), name);
    } catch (e: unknown) {
      result.errors.push(`branch ${name}: ${(e as Error).message}`);
    }
  }

  // ------------------------------------------------------------------
  // 3. Demo employees
  //    user_ids are stable placeholder UUIDs. Real Supabase Auth users
  //    are created separately and these UUIDs get replaced at that time.
  //    Passwords are NEVER stored here.
  // ------------------------------------------------------------------

  type EmpRow = {
    id: string;
    employee_code: string;
    first_name: string;
    last_name: string;
    email: string;
    designation: string;
    process_id: string;
    branch_id: string;
    user_id: string;
  };

  const employees: EmpRow[] = [
    // --- Neemans_Inbound, Mumbai (agents MAS70001-MAS70005) ---
    {
      id: "emp-demo-0001", employee_code: "MAS70001",
      first_name: "Priya",  last_name: "Sharma",
      email: "priya.sharma@demo.peopleOS.ai",  designation: "Agent",
      process_id: PROC_INBOUND, branch_id: BRANCH_MUMBAI,
      user_id: "uid-demo-0001-0000-0000-000000000001",
    },
    {
      id: "emp-demo-0002", employee_code: "MAS70002",
      first_name: "Aarav",  last_name: "Kumar",
      email: "aarav.kumar@demo.peopleOS.ai",   designation: "Agent",
      process_id: PROC_INBOUND, branch_id: BRANCH_MUMBAI,
      user_id: "uid-demo-0002-0000-0000-000000000001",
    },
    {
      id: "emp-demo-0003", employee_code: "MAS70003",
      first_name: "Sneha",  last_name: "Patel",
      email: "sneha.patel@demo.peopleOS.ai",   designation: "Agent",
      process_id: PROC_INBOUND, branch_id: BRANCH_MUMBAI,
      user_id: "uid-demo-0003-0000-0000-000000000001",
    },
    {
      id: "emp-demo-0004", employee_code: "MAS70004",
      first_name: "Rahul",  last_name: "Singh",
      email: "rahul.singh@demo.peopleOS.ai",   designation: "Agent",
      process_id: PROC_INBOUND, branch_id: BRANCH_MUMBAI,
      user_id: "uid-demo-0004-0000-0000-000000000001",
    },
    {
      id: "emp-demo-0005", employee_code: "MAS70005",
      first_name: "Kavya",  last_name: "Gupta",
      email: "kavya.gupta@demo.peopleOS.ai",   designation: "Agent",
      process_id: PROC_INBOUND, branch_id: BRANCH_MUMBAI,
      user_id: "uid-demo-0005-0000-0000-000000000001",
    },
    // Inbound TL / QA / RTM / AM
    {
      id: "emp-demo-0010", employee_code: "MAS70010",
      first_name: "Rohit",  last_name: "Verma",
      email: "rohit.verma@demo.peopleOS.ai",   designation: "Team Leader",
      process_id: PROC_INBOUND, branch_id: BRANCH_MUMBAI,
      user_id: "uid-demo-0010-0000-0000-000000000001",
    },
    {
      id: "emp-demo-0011", employee_code: "MAS70011",
      first_name: "Anjali", last_name: "Mehta",
      email: "anjali.mehta@demo.peopleOS.ai",  designation: "Quality Analyst",
      process_id: PROC_INBOUND, branch_id: BRANCH_MUMBAI,
      user_id: "uid-demo-0011-0000-0000-000000000001",
    },
    {
      id: "emp-demo-0012", employee_code: "MAS70012",
      first_name: "Dev",    last_name: "Pandey",
      email: "dev.pandey@demo.peopleOS.ai",    designation: "RTM/RTA",
      process_id: PROC_INBOUND, branch_id: BRANCH_MUMBAI,
      user_id: "uid-demo-0012-0000-0000-000000000001",
    },
    {
      id: "emp-demo-0013", employee_code: "MAS70013",
      first_name: "Meera",  last_name: "Joshi",
      email: "meera.joshi@demo.peopleOS.ai",   designation: "Assistant Manager",
      process_id: PROC_INBOUND, branch_id: BRANCH_MUMBAI,
      user_id: "uid-demo-0013-0000-0000-000000000001",
    },

    // --- Neemans_Outbound, Delhi (agents MAS70020-MAS70024) ---
    {
      id: "emp-demo-0020", employee_code: "MAS70020",
      first_name: "Arjun",   last_name: "Yadav",
      email: "arjun.yadav@demo.peopleOS.ai",   designation: "Agent",
      process_id: PROC_OUTBOUND, branch_id: BRANCH_DELHI,
      user_id: "uid-demo-0020-0000-0000-000000000002",
    },
    {
      id: "emp-demo-0021", employee_code: "MAS70021",
      first_name: "Divya",   last_name: "Chauhan",
      email: "divya.chauhan@demo.peopleOS.ai", designation: "Agent",
      process_id: PROC_OUTBOUND, branch_id: BRANCH_DELHI,
      user_id: "uid-demo-0021-0000-0000-000000000002",
    },
    {
      id: "emp-demo-0022", employee_code: "MAS70022",
      first_name: "Manish",  last_name: "Saxena",
      email: "manish.saxena@demo.peopleOS.ai", designation: "Agent",
      process_id: PROC_OUTBOUND, branch_id: BRANCH_DELHI,
      user_id: "uid-demo-0022-0000-0000-000000000002",
    },
    {
      id: "emp-demo-0023", employee_code: "MAS70023",
      first_name: "Simran",  last_name: "Arora",
      email: "simran.arora@demo.peopleOS.ai",  designation: "Agent",
      process_id: PROC_OUTBOUND, branch_id: BRANCH_DELHI,
      user_id: "uid-demo-0023-0000-0000-000000000002",
    },
    {
      id: "emp-demo-0024", employee_code: "MAS70024",
      first_name: "Nikhil",  last_name: "Pillai",
      email: "nikhil.pillai@demo.peopleOS.ai", designation: "Agent",
      process_id: PROC_OUTBOUND, branch_id: BRANCH_DELHI,
      user_id: "uid-demo-0024-0000-0000-000000000002",
    },
    // Outbound TL / QA / AM
    {
      id: "emp-demo-0030", employee_code: "MAS70030",
      first_name: "Suresh",  last_name: "Nair",
      email: "suresh.nair@demo.peopleOS.ai",   designation: "Team Leader",
      process_id: PROC_OUTBOUND, branch_id: BRANCH_DELHI,
      user_id: "uid-demo-0030-0000-0000-000000000002",
    },
    {
      id: "emp-demo-0031", employee_code: "MAS70031",
      first_name: "Pooja",   last_name: "Reddy",
      email: "pooja.reddy@demo.peopleOS.ai",   designation: "Quality Analyst",
      process_id: PROC_OUTBOUND, branch_id: BRANCH_DELHI,
      user_id: "uid-demo-0031-0000-0000-000000000002",
    },
    {
      id: "emp-demo-0032", employee_code: "MAS70032",
      first_name: "Vikram",  last_name: "Shah",
      email: "vikram.shah@demo.peopleOS.ai",   designation: "Assistant Manager",
      process_id: PROC_OUTBOUND, branch_id: BRANCH_DELHI,
      user_id: "uid-demo-0032-0000-0000-000000000002",
    },

    // --- Support Staff, HO Mumbai ---
    {
      id: "emp-demo-0040", employee_code: "MAS70040",
      first_name: "Anand",   last_name: "Krishnan",
      email: "anand.krishnan@demo.peopleOS.ai", designation: "Process Manager",
      process_id: PROC_INBOUND, branch_id: BRANCH_HO,
      user_id: "uid-demo-0040-0000-0000-000000000003",
    },
    {
      id: "emp-demo-0041", employee_code: "MAS70041",
      first_name: "Ritu",    last_name: "Agarwal",
      email: "ritu.agarwal@demo.peopleOS.ai",  designation: "Manager",
      process_id: PROC_INBOUND, branch_id: BRANCH_HO,
      user_id: "uid-demo-0041-0000-0000-000000000003",
    },
    {
      id: "emp-demo-0042", employee_code: "MAS70042",
      first_name: "Kiran",   last_name: "Bose",
      email: "kiran.bose@demo.peopleOS.ai",    designation: "WFM Analyst",
      process_id: PROC_INBOUND, branch_id: BRANCH_HO,
      user_id: "uid-demo-0042-0000-0000-000000000003",
    },
    {
      id: "emp-demo-0043", employee_code: "MAS70043",
      first_name: "Sunita",  last_name: "Roy",
      email: "sunita.roy@demo.peopleOS.ai",    designation: "Trainer",
      process_id: PROC_INBOUND, branch_id: BRANCH_HO,
      user_id: "uid-demo-0043-0000-0000-000000000003",
    },
    {
      id: "emp-demo-0044", employee_code: "MAS70044",
      first_name: "Arun",    last_name: "Tiwari",
      email: "arun.tiwari@demo.peopleOS.ai",   designation: "MIS Analyst",
      process_id: PROC_INBOUND, branch_id: BRANCH_HO,
      user_id: "uid-demo-0044-0000-0000-000000000003",
    },
    {
      id: "emp-demo-0045", employee_code: "MAS70045",
      first_name: "Neha",    last_name: "Malhotra",
      email: "neha.malhotra@demo.peopleOS.ai", designation: "HR Business Partner",
      process_id: PROC_INBOUND, branch_id: BRANCH_HO,
      user_id: "uid-demo-0045-0000-0000-000000000003",
    },
  ];

  for (const emp of employees) {
    try {
      tally(
        result,
        await ensureEmployee({ ...emp, created_by: SEED_ACTOR }),
        emp.employee_code
      );
    } catch (e: unknown) {
      result.errors.push(`employee ${emp.employee_code}: ${(e as Error).message}`);
    }
  }

  // ------------------------------------------------------------------
  // 4. Demo role users → user_roles (MySQL only; Supabase Auth is separate)
  //    Stable UUIDs so re-runs are idempotent.
  // ------------------------------------------------------------------

  const roleUsers: Array<{ email: string; role: string; userId: string }> = [
    { email: "superadmin@demo.peopleOS.ai",     role: "super_admin",      userId: "role-demo-0001-0000-0000-00000000demo" },
    { email: "hradmin@demo.peopleOS.ai",         role: "hr",               userId: "role-demo-0002-0000-0000-00000000demo" },
    { email: "recruiter@demo.peopleOS.ai",       role: "recruiter",        userId: "role-demo-0003-0000-0000-00000000demo" },
    { email: "employee@demo.peopleOS.ai",        role: "employee",         userId: "role-demo-0004-0000-0000-00000000demo" },
    { email: "wfm@demo.peopleOS.ai",             role: "wfm",              userId: "role-demo-0005-0000-0000-00000000demo" },
    { email: "processmanager@demo.peopleOS.ai",  role: "process_manager",  userId: "role-demo-0006-0000-0000-00000000demo" },
    { email: "am@demo.peopleOS.ai",              role: "assistant_manager", userId: "role-demo-0007-0000-0000-00000000demo" },
    { email: "tl@demo.peopleOS.ai",              role: "team_leader",      userId: "role-demo-0008-0000-0000-00000000demo" },
    { email: "qa@demo.peopleOS.ai",              role: "qa",               userId: "role-demo-0009-0000-0000-00000000demo" },
    { email: "trainer@demo.peopleOS.ai",         role: "trainer",          userId: "role-demo-0010-0000-0000-00000000demo" },
    { email: "payroll@demo.peopleOS.ai",         role: "finance",          userId: "role-demo-0011-0000-0000-00000000demo" },
    { email: "branchhead@demo.peopleOS.ai",      role: "branch_head",      userId: "role-demo-0012-0000-0000-00000000demo" },
    { email: "ceo@demo.peopleOS.ai",             role: "ceo",              userId: "role-demo-0013-0000-0000-00000000demo" },
    { email: "client@demo.peopleOS.ai",          role: "client_user",      userId: "role-demo-0014-0000-0000-00000000demo" },
  ];

  for (const u of roleUsers) {
    try {
      tally(
        result,
        await ensureUserRole(u.userId, u.email, u.role, SEED_ACTOR),
        u.email
      );
    } catch (e: unknown) {
      result.errors.push(`user_role ${u.email}: ${(e as Error).message}`);
    }
  }

  // ------------------------------------------------------------------
  // 5. Workforce mandates
  // ------------------------------------------------------------------

  const mandateParams = {
    bufferPct: 15,
    shrinkagePct: 18,
    attritionBufferPct: 8,
    trainingBufferPct: 5,
    createdBy: SEED_ACTOR,
  };

  const mandates: Array<{
    processId: string;
    branchId: string;
    roleGroup: string;
    hcType: "production" | "support";
    mandatedHc: number;
  }> = [
    { processId: PROC_INBOUND,  branchId: BRANCH_MUMBAI, roleGroup: "inbound_agents",  hcType: "production", mandatedHc: 20 },
    { processId: PROC_OUTBOUND, branchId: BRANCH_DELHI,  roleGroup: "outbound_agents", hcType: "production", mandatedHc: 15 },
  ];

  for (const m of mandates) {
    try {
      tally(
        result,
        await ensureMandate({ ...m, ...mandateParams }),
        `mandate:${m.roleGroup}`
      );
    } catch (e: unknown) {
      result.errors.push(`mandate ${m.roleGroup}: ${(e as Error).message}`);
    }
  }

  // ------------------------------------------------------------------
  // 6. Support role ratios (per-process)
  // ------------------------------------------------------------------

  type RatioType = "per_agents" | "per_tl" | "per_batch" | "per_trainee_count";

  const ratioRules: Array<{
    supportRole: string;
    ratioType: RatioType;
    ratioValue: number;
  }> = [
    { supportRole: "team_leader", ratioType: "per_agents", ratioValue: 15 },
    { supportRole: "qa",          ratioType: "per_agents", ratioValue: 20 },
    { supportRole: "rtm_rta",     ratioType: "per_agents", ratioValue: 40 },
    { supportRole: "trainer",     ratioType: "per_batch",  ratioValue: 20 },
  ];

  for (const processId of [PROC_INBOUND, PROC_OUTBOUND]) {
    for (const rule of ratioRules) {
      try {
        tally(
          result,
          await ensureSupportRatio({ processId, ...rule }),
          `ratio:${processId}:${rule.supportRole}`
        );
      } catch (e: unknown) {
        result.errors.push(
          `support_ratio ${processId}/${rule.supportRole}: ${(e as Error).message}`
        );
      }
    }
  }

  return result;
}
