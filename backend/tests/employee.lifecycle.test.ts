/**
 * Package 2 — Employee lifecycle, assets, helpdesk, letters tests.
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

function authAs(userId: string, roles: string[]) {
  mockGetUser.mockResolvedValue({ data: { user: { id: userId, email: `${userId}@test.com` } }, error: null });
  mockExecute.mockResolvedValueOnce([roles.map((r) => ({ role_key: r })), []]);
}

const ADMIN_AUTH = { Authorization: "Bearer admin.token" };
const HR_AUTH = { Authorization: "Bearer hr.token" };
const EMP_AUTH = { Authorization: "Bearer emp.token" };

beforeEach(() => { vi.clearAllMocks(); mockExecute.mockResolvedValue([[], []]); });

// ── Employee Lifecycle Events ─────────────────────────────────────────────────

describe("GET /api/lifecycle/employees/:id/lifecycle", () => {
  it("returns 200 for authenticated user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } }, error: null });
    mockExecute.mockResolvedValueOnce([[{ id: "ev-1", event_type: "confirmation" }], []]);
    const r = await request(app).get("/api/lifecycle/employees/emp-1/lifecycle").set(ADMIN_AUTH);
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.data)).toBe(true);
  });

  it("returns 401 without token", async () => {
    const r = await request(app).get("/api/lifecycle/employees/emp-1/lifecycle");
    expect(r.status).toBe(401);
  });
});

describe("POST /api/lifecycle/employees/:id/lifecycle", () => {
  it("returns 403 for employee role", async () => {
    authAs("u-emp", ["employee"]);
    const r = await request(app).post("/api/lifecycle/employees/emp-1/lifecycle").set(EMP_AUTH)
      .send({ event_type: "promotion", effective_date: "2026-06-01" });
    expect(r.status).toBe(403);
  });

  it("creates lifecycle event for hr", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-hr" } }, error: null });
    mockExecute.mockResolvedValueOnce([[{ role_key: "hr" }], []]);   // requireRole
    mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);    // insert lifecycle_event
    mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);    // insert journey_log
    mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);    // audit log
    mockExecute.mockResolvedValueOnce([[{ id: "ev-new", event_type: "promotion" }], []]);
    const r = await request(app).post("/api/lifecycle/employees/emp-1/lifecycle").set(HR_AUTH)
      .send({ event_type: "promotion", effective_date: "2026-06-01", remarks: "Promoted to TL" });
    expect(r.status).toBe(201);
  });
});

describe("POST /api/lifecycle/documents/:id/verify", () => {
  it("returns 403 for non-hr/admin", async () => {
    authAs("u-emp", ["employee"]);
    const r = await request(app).post("/api/lifecycle/documents/doc-1/verify").set(EMP_AUTH);
    expect(r.status).toBe(403);
  });

  it("verifies document for hr and writes audit", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-hr" } }, error: null });
    mockExecute.mockResolvedValueOnce([[{ role_key: "hr" }], []]);
    mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);   // UPDATE employee_documents
    mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);   // audit log
    const r = await request(app).post("/api/lifecycle/documents/doc-1/verify").set(HR_AUTH)
      .send({ remarks: "BGV verified" });
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
  });
});

// ── Assets ────────────────────────────────────────────────────────────────────

describe("GET /api/assets-mgmt", () => {
  it("returns 200 for authenticated user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } }, error: null });
    mockExecute.mockResolvedValueOnce([[{ id: "a-1", asset_code: "LT-001", status: "available" }], []]);
    const r = await request(app).get("/api/assets-mgmt").set(ADMIN_AUTH);
    expect(r.status).toBe(200);
  });
});

describe("POST /api/assets-mgmt/:id/assign", () => {
  it("returns 403 for employee role", async () => {
    authAs("u-emp", ["employee"]);
    const r = await request(app).post("/api/assets-mgmt/a-1/assign").set(EMP_AUTH)
      .send({ employee_id: "emp-1" });
    expect(r.status).toBe(403);
  });

  it("assigns asset for hr and writes audit", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-hr" } }, error: null });
    mockExecute.mockResolvedValueOnce([[{ role_key: "hr" }], []]);   // requireRole
    mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);    // close old assignment
    mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);    // new assignment
    mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);    // update asset status
    mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);    // audit log
    mockExecute.mockResolvedValueOnce([[{ id: "aa-1", asset_id: "a-1" }], []]);
    const r = await request(app).post("/api/assets-mgmt/a-1/assign").set(HR_AUTH)
      .send({ employee_id: "emp-1" });
    expect(r.status).toBe(201);
    const auditCall = mockExecute.mock.calls.find(([sql]: [string]) =>
      typeof sql === "string" && sql.includes("sensitive_action_log")
    );
    expect(auditCall).toBeDefined();
  });
});

describe("POST /api/assets-mgmt/:id/return", () => {
  it("marks asset as returned for hr", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-hr" } }, error: null });
    mockExecute.mockResolvedValueOnce([[{ role_key: "hr" }], []]);
    mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);   // update assignment
    mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);   // update asset status
    mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);   // audit log
    const r = await request(app).post("/api/assets-mgmt/a-1/return").set(HR_AUTH)
      .send({ condition: "good" });
    expect(r.status).toBe(200);
  });
});

// ── Helpdesk ──────────────────────────────────────────────────────────────────

describe("POST /api/helpdesk/tickets", () => {
  it("creates ticket for authenticated employee", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } }, error: null });
    mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    mockExecute.mockResolvedValueOnce([[{ id: "t-1", status: "open", comments: [] }], []]);
    mockExecute.mockResolvedValueOnce([[], []]);
    const r = await request(app).post("/api/helpdesk/tickets").set(ADMIN_AUTH)
      .send({ employee_id: "emp-1", category: "hr", subject: "Leave not credited", description: "CL not reflected" });
    expect(r.status).toBe(201);
  });
});

describe("GET /api/helpdesk/grievances", () => {
  it("returns 403 for non-hr", async () => {
    authAs("u-emp", ["employee"]);
    const r = await request(app).get("/api/helpdesk/grievances").set(EMP_AUTH);
    expect(r.status).toBe(403);
  });

  it("returns grievances for hr", async () => {
    authAs("u-hr", ["hr"]);
    mockExecute.mockResolvedValueOnce([[{ id: "g-1", category: "harassment", status: "submitted" }], []]);
    const r = await request(app).get("/api/helpdesk/grievances").set(HR_AUTH);
    expect(r.status).toBe(200);
  });
});

describe("POST /api/helpdesk/grievances", () => {
  it("creates grievance (anonymous suppresses employee_id in response)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-1" } }, error: null });
    mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    mockExecute.mockResolvedValueOnce([[{ id: "g-new", grievance_code: "GRV-ABC", is_anonymous: 1, status: "submitted" }], []]);
    const r = await request(app).post("/api/helpdesk/grievances").set(ADMIN_AUTH)
      .send({ employee_id: "emp-1", category: "workplace", description: "Hostile env", is_anonymous: true });
    expect(r.status).toBe(201);
    // employee_id must not leak in anonymous grievance response
    expect(r.body.data.employee_id).toBeUndefined();
  });
});

// ── Letters ───────────────────────────────────────────────────────────────────

describe("GET /api/letters/templates", () => {
  it("returns 403 for employee role", async () => {
    authAs("u-emp", ["employee"]);
    const r = await request(app).get("/api/letters/templates").set(EMP_AUTH);
    expect(r.status).toBe(403);
  });

  it("returns templates for admin", async () => {
    authAs("u-admin", ["admin"]);
    mockExecute.mockResolvedValueOnce([[{ id: "t-1", template_code: "OFFER_LETTER" }], []]);
    const r = await request(app).get("/api/letters/templates").set(ADMIN_AUTH);
    expect(r.status).toBe(200);
  });
});

describe("POST /api/letters/generate", () => {
  it("generates letter text from template with employee data", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u-admin" } }, error: null });
    mockExecute.mockResolvedValueOnce([[{ role_key: "admin" }], []]);
    // template fetch
    mockExecute.mockResolvedValueOnce([[{
      id: "tpl-1", template_code: "OFFER_LETTER", letter_type: "offer",
      body_template: "Dear {{full_name}}, join as {{designation}}."
    }], []]);
    // employee fetch
    mockExecute.mockResolvedValueOnce([[{
      id: "emp-1", employee_code: "EMP001", full_name: "Amit Kumar",
      first_name: "Amit", last_name: "Kumar",
      designation_name: "Agent", date_of_joining: "2026-06-01",
    }], []]);
    // insert letter
    mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    const r = await request(app).post("/api/letters/generate").set(ADMIN_AUTH)
      .send({ employee_id: "emp-1", template_code: "OFFER_LETTER", issued_date: "2026-06-01" });
    expect(r.status).toBe(201);
    expect(r.body.data.generated_text).toContain("Amit Kumar");
    expect(r.body.data.generated_text).toContain("Agent");
  });
});
