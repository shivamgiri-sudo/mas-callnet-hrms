/**
 * Package B: Roster and Shift Governance — integration tests
 * Tests: shift templates, cycle lifecycle, assignments, ack, change log,
 *        coverage actions, portal aggregate, and security scoping.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

vi.mock("../src/db/supabaseAdmin.js", () => ({
  supabaseAdmin: {},
  supabaseAuthClient: { auth: { getUser: vi.fn() } },
}));
vi.mock("../src/db/mysql.js", () => ({ db: { execute: vi.fn() }, pingDb: vi.fn() }));

import { app } from "../src/app.js";
import { db } from "../src/db/mysql.js";
import { supabaseAuthClient } from "../src/db/supabaseAdmin.js";

const mockExecute = db.execute as ReturnType<typeof vi.fn>;
const mockGetUser = supabaseAuthClient.auth.getUser as ReturnType<typeof vi.fn>;

const ADMIN = { Authorization: "Bearer admin.token" };
const EMP   = { Authorization: "Bearer emp.token" };

beforeEach(() => {
  vi.clearAllMocks();
  mockExecute.mockResolvedValue([[], []]);
});

function mockAdmin() {
  mockGetUser.mockResolvedValue({ data: { user: { id: "u-admin" } }, error: null });
  mockExecute.mockResolvedValueOnce([[{ role_key: "admin" }], []]);
}

function mockEmployee(empId: string) {
  mockGetUser.mockResolvedValue({ data: { user: { id: "u-emp" } }, error: null });
  // first call: requireRole or hasRole — employee role
  mockExecute.mockResolvedValueOnce([[{ role_key: "employee" }], []]);
  // second call: getEmployeeForUser
  mockExecute.mockResolvedValueOnce([[{ id: empId, employee_code: "E001" }], []]);
}

// ── 1. GET /api/roster-gov/shifts/templates ───────────────────────────────────

describe("GET /api/roster-gov/shifts/templates", () => {
  it("returns 200 for admin with template rows", async () => {
    mockAdmin();
    mockExecute.mockResolvedValueOnce([[
      { id: "st-1", shift_code: "DAY", version: 1, shift_name: "Day Shift", start_time: "09:00:00", end_time: "18:00:00" },
    ], []]);
    const r = await request(app).get("/api/roster-gov/shifts/templates").set(ADMIN);
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.data)).toBe(true);
    expect(r.body.data.length).toBeGreaterThan(0);
  });

  it("returns 403 for employee role", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-emp" } }, error: null });
    mockExecute.mockResolvedValueOnce([[{ role_key: "employee" }], []]);
    const r = await request(app).get("/api/roster-gov/shifts/templates").set(EMP);
    expect(r.status).toBe(403);
  });
});

// ── 2. POST /api/roster-gov/shifts/templates ──────────────────────────────────

describe("POST /api/roster-gov/shifts/templates", () => {
  it("returns 201 when admin creates a shift template", async () => {
    mockAdmin();
    mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);   // INSERT
    mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);   // audit INSERT
    mockExecute.mockResolvedValueOnce([[{
      id: "st-new", shift_code: "NIGHT", version: 1, shift_name: "Night Shift",
      start_time: "22:00:00", end_time: "06:00:00", effective_from: "2026-06-01",
    }], []]);
    const r = await request(app)
      .post("/api/roster-gov/shifts/templates")
      .set(ADMIN)
      .send({ shift_code: "NIGHT", shift_name: "Night Shift", start_time: "22:00:00", end_time: "06:00:00", effective_from: "2026-06-01" });
    expect(r.status).toBe(201);
    expect(r.body.data).toBeDefined();
    expect(r.body.data.shift_code).toBe("NIGHT");
  });

  it("returns 400 when required fields are missing", async () => {
    mockAdmin();
    const r = await request(app)
      .post("/api/roster-gov/shifts/templates")
      .set(ADMIN)
      .send({ shift_code: "X" }); // missing shift_name, start_time, end_time, effective_from
    expect(r.status).toBe(400);
  });

  it("returns 403 for employee trying to create shift template", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-emp" } }, error: null });
    mockExecute.mockResolvedValueOnce([[{ role_key: "employee" }], []]);
    const r = await request(app)
      .post("/api/roster-gov/shifts/templates")
      .set(EMP)
      .send({ shift_code: "DAY", shift_name: "Day", start_time: "09:00:00", end_time: "18:00:00", effective_from: "2026-06-01" });
    expect(r.status).toBe(403);
  });
});

// ── 3. POST /api/roster-gov/cycles — create cycle ────────────────────────────

describe("POST /api/roster-gov/cycles", () => {
  it("returns 201 for admin creating a cycle", async () => {
    mockAdmin();
    mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);  // INSERT cycle
    mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);  // audit
    mockExecute.mockResolvedValueOnce([[{
      id: "cyc-1", process_id: "proc-1", week_start_date: "2026-06-02",
      week_end_date: "2026-06-08", status: "draft", created_by: "u-admin",
    }], []]);
    const r = await request(app)
      .post("/api/roster-gov/cycles")
      .set(ADMIN)
      .send({ process_id: "proc-1", week_start_date: "2026-06-02", week_end_date: "2026-06-08" });
    expect(r.status).toBe(201);
    expect(r.body.data.status).toBe("draft");
  });
});

// ── 4. POST /api/roster-gov/cycles/:id/status — status transition ─────────────

describe("POST /api/roster-gov/cycles/:id/status", () => {
  it("returns 200 for valid draft → submitted transition", async () => {
    mockAdmin();
    // getCycle call
    mockExecute.mockResolvedValueOnce([[{ id: "cyc-1", status: "draft", process_id: "p1" }], []]);
    // UPDATE
    mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    // audit
    mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    // getCycle again (return new)
    mockExecute.mockResolvedValueOnce([[{ id: "cyc-1", status: "submitted", process_id: "p1" }], []]);
    const r = await request(app)
      .post("/api/roster-gov/cycles/cyc-1/status")
      .set(ADMIN)
      .send({ status: "submitted" });
    expect(r.status).toBe(200);
    expect(r.body.data.status).toBe("submitted");
  });

  it("returns 400 for invalid transition (draft → closed)", async () => {
    mockAdmin();
    mockExecute.mockResolvedValueOnce([[{ id: "cyc-1", status: "draft", process_id: "p1" }], []]);
    const r = await request(app)
      .post("/api/roster-gov/cycles/cyc-1/status")
      .set(ADMIN)
      .send({ status: "closed" });
    expect(r.status).toBe(400);
  });
});

// ── 5. GET /api/roster-gov/cycles/:id/assignments — scoping ──────────────────

describe("GET /api/roster-gov/cycles/:id/assignments — admin sees all", () => {
  it("admin sees all assignments (no employee filter)", async () => {
    // requireAuth getUser
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-admin" } }, error: null });
    // hasRole call in route handler → user_roles
    mockExecute.mockResolvedValueOnce([[{ role_key: "admin" }], []]);
    // getAssignments all
    mockExecute.mockResolvedValueOnce([[
      { id: "a1", employee_id: "emp-1", roster_date: "2026-06-02" },
      { id: "a2", employee_id: "emp-2", roster_date: "2026-06-02" },
    ], []]);
    const r = await request(app)
      .get("/api/roster-gov/cycles/cyc-1/assignments")
      .set(ADMIN);
    expect(r.status).toBe(200);
    expect(r.body.data).toHaveLength(2);
  });
});

describe("GET /api/roster-gov/cycles/:id/assignments — employee sees own only", () => {
  it("employee only gets their own assignments", async () => {
    // requireAuth
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-emp" } }, error: null });
    // hasRole check (employee — not in admin/hr/wfm/manager): returns employee role
    mockExecute.mockResolvedValueOnce([[{ role_key: "employee" }], []]);
    // getEmployeeForUser
    mockExecute.mockResolvedValueOnce([[{ id: "emp-1", employee_code: "E001" }], []]);
    // getAssignments filtered by emp-1
    mockExecute.mockResolvedValueOnce([[
      { id: "a1", employee_id: "emp-1", roster_date: "2026-06-02" },
    ], []]);
    const r = await request(app)
      .get("/api/roster-gov/cycles/cyc-1/assignments")
      .set(EMP);
    expect(r.status).toBe(200);
    expect(r.body.data).toHaveLength(1);
    // employee_id is returned in the assignment row
    expect(r.body.data[0].employee_id).toBe("emp-1");
  });

  it("employee A cannot access endpoint as employee B (no employee record returns 403)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-other" } }, error: null });
    // hasRole check: employee
    mockExecute.mockResolvedValueOnce([[{ role_key: "employee" }], []]);
    // getEmployeeForUser returns nothing (no record for this user)
    mockExecute.mockResolvedValueOnce([[], []]);
    const r = await request(app)
      .get("/api/roster-gov/cycles/cyc-1/assignments")
      .set({ Authorization: "Bearer other.token" });
    expect(r.status).toBe(403);
  });
});

// ── 6. Employee self-acknowledgement ─────────────────────────────────────────

describe("POST /api/roster-gov/cycles/:id/acknowledge", () => {
  it("employee can acknowledge their own roster", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-emp" } }, error: null });
    // getEmployeeForUser
    mockExecute.mockResolvedValueOnce([[{ id: "emp-1", employee_code: "E001" }], []]);
    // UPDATE acknowledgement
    mockExecute.mockResolvedValueOnce([{ affectedRows: 7 }, []]);
    // audit INSERT
    mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    const r = await request(app)
      .post("/api/roster-gov/cycles/cyc-1/acknowledge")
      .set(EMP);
    expect(r.status).toBe(200);
    expect(r.body.data.acknowledged).toBe(7);
  });
});

// ── 7. Change log creation with audit ─────────────────────────────────────────

describe("POST /api/roster-gov/cycles/:id/changes", () => {
  it("creates a change log entry and calls audit", async () => {
    mockAdmin();
    // getCycle
    mockExecute.mockResolvedValueOnce([[{ id: "cyc-1", status: "published", process_id: "p1" }], []]);
    // INSERT change log
    mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    // audit INSERT
    mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    // SELECT change log
    mockExecute.mockResolvedValueOnce([[{
      id: "cl-1", cycle_id: "cyc-1", employee_id: "emp-1",
      change_type: "shift_change", reason: "Employee request",
      change_date: "2026-06-03", changed_by: "u-admin",
    }], []]);
    const r = await request(app)
      .post("/api/roster-gov/cycles/cyc-1/changes")
      .set(ADMIN)
      .send({
        employee_id: "emp-1",
        change_type: "shift_change",
        reason: "Employee request",
        change_date: "2026-06-03",
      });
    expect(r.status).toBe(201);
    expect(r.body.data).toBeDefined();
    expect(mockExecute).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO sensitive_action_log"),
      expect.any(Array)
    );
  });

  it("returns 400 when reason is missing", async () => {
    mockAdmin();
    const r = await request(app)
      .post("/api/roster-gov/cycles/cyc-1/changes")
      .set(ADMIN)
      .send({ employee_id: "emp-1", change_type: "shift_change", change_date: "2026-06-03" });
    expect(r.status).toBe(400);
  });
});

// ── 8. Coverage action create + resolve ──────────────────────────────────────

describe("Coverage actions", () => {
  it("POST /coverage-actions creates action (201)", async () => {
    mockAdmin();
    // getCycle
    mockExecute.mockResolvedValueOnce([[{ id: "cyc-1", status: "published", process_id: "p1" }], []]);
    // INSERT
    mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    // audit
    mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    // SELECT
    mockExecute.mockResolvedValueOnce([[{ id: "ca-1", cycle_id: "cyc-1", status: "open", action_date: "2026-06-03" }], []]);
    const r = await request(app)
      .post("/api/roster-gov/coverage-actions")
      .set(ADMIN)
      .send({ cycle_id: "cyc-1", action_date: "2026-06-03", coverage_gap: 5 });
    expect(r.status).toBe(201);
    expect(r.body.data.status).toBe("open");
  });

  it("POST /coverage-actions/:id/resolve resolves action (200)", async () => {
    mockAdmin();
    // SELECT existing
    mockExecute.mockResolvedValueOnce([[{ id: "ca-1", status: "open", cycle_id: "cyc-1" }], []]);
    // UPDATE
    mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    // audit
    mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    // SELECT updated
    mockExecute.mockResolvedValueOnce([[{ id: "ca-1", status: "resolved", resolved_at: "2026-06-04 10:00:00" }], []]);
    const r = await request(app)
      .post("/api/roster-gov/coverage-actions/ca-1/resolve")
      .set(ADMIN);
    expect(r.status).toBe(200);
    expect(r.body.data.status).toBe("resolved");
  });
});

// ── 9. Portal aggregate requires query params ─────────────────────────────────

describe("GET /api/roster-gov/portal-aggregate", () => {
  it("returns 400 without process_id and week_start_date", async () => {
    mockAdmin();
    const r = await request(app)
      .get("/api/roster-gov/portal-aggregate")
      .set(ADMIN);
    expect(r.status).toBe(400);
  });

  it("returns 400 without week_start_date", async () => {
    mockAdmin();
    const r = await request(app)
      .get("/api/roster-gov/portal-aggregate?process_id=p1")
      .set(ADMIN);
    expect(r.status).toBe(400);
  });

  it("returns 200 with valid params and published data only", async () => {
    mockAdmin();
    mockExecute.mockResolvedValueOnce([[
      { id: "pra-1", cycle_id: "cyc-1", process_id: "p1", week_start_date: "2026-06-02",
        required_hc: 10, rostered_hc: 9, coverage_pct: 90.00, published_at: "2026-06-01 08:00:00" },
    ], []]);
    const r = await request(app)
      .get("/api/roster-gov/portal-aggregate?process_id=p1&week_start_date=2026-06-02")
      .set(ADMIN);
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.data)).toBe(true);
    // Should not expose employee-level fields
    if (r.body.data.length > 0) {
      expect(r.body.data[0]).not.toHaveProperty("employee_id");
    }
  });
});

// ── 10. Employee 403 on admin-only endpoints ──────────────────────────────────

describe("Employee 403 on admin-only endpoints", () => {
  it("employee cannot POST /shifts/templates", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-emp" } }, error: null });
    mockExecute.mockResolvedValueOnce([[{ role_key: "employee" }], []]);
    const r = await request(app)
      .post("/api/roster-gov/shifts/templates")
      .set(EMP)
      .send({ shift_code: "X", shift_name: "X", start_time: "09:00", end_time: "18:00", effective_from: "2026-06-01" });
    expect(r.status).toBe(403);
  });

  it("employee cannot POST /cycles", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-emp" } }, error: null });
    mockExecute.mockResolvedValueOnce([[{ role_key: "employee" }], []]);
    const r = await request(app)
      .post("/api/roster-gov/cycles")
      .set(EMP)
      .send({ process_id: "p1", week_start_date: "2026-06-02", week_end_date: "2026-06-08" });
    expect(r.status).toBe(403);
  });

  it("employee cannot POST bulk assignments", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-emp" } }, error: null });
    mockExecute.mockResolvedValueOnce([[{ role_key: "employee" }], []]);
    const r = await request(app)
      .post("/api/roster-gov/cycles/cyc-1/assignments/bulk")
      .set(EMP)
      .send({ assignments: [{ employee_id: "e1", roster_date: "2026-06-02" }] });
    expect(r.status).toBe(403);
  });

  it("employee cannot GET /portal-aggregate", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-emp" } }, error: null });
    mockExecute.mockResolvedValueOnce([[{ role_key: "employee" }], []]);
    const r = await request(app)
      .get("/api/roster-gov/portal-aggregate?process_id=p1&week_start_date=2026-06-02")
      .set(EMP);
    expect(r.status).toBe(403);
  });
});
