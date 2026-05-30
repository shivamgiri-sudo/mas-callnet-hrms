import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

type DemoUser = {
  email: string;
  role: string;
  note: string;
};

const demoUsers: DemoUser[] = [
  { email: "superadmin@demo.peopleOS.ai", role: "super_admin", note: "Full internal platform access" },
  { email: "hradmin@demo.peopleOS.ai", role: "hr", note: "HR Admin" },
  { email: "recruiter@demo.peopleOS.ai", role: "recruiter", note: "ATS recruiter queue" },
  { email: "employee@demo.peopleOS.ai", role: "employee", note: "Employee self-service" },
  { email: "wfm@demo.peopleOS.ai", role: "wfm", note: "WFM / RTA" },
  { email: "processmanager@demo.peopleOS.ai", role: "process_manager", note: "Mapped process owner" },
  { email: "am@demo.peopleOS.ai", role: "assistant_manager", note: "Assistant Manager" },
  { email: "tl@demo.peopleOS.ai", role: "team_leader", note: "Team Leader" },
  { email: "qa@demo.peopleOS.ai", role: "qa", note: "Quality Analyst" },
  { email: "trainer@demo.peopleOS.ai", role: "trainer", note: "Training / LMS readiness" },
  { email: "payroll@demo.peopleOS.ai", role: "finance", note: "Payroll / Finance" },
  { email: "branchhead@demo.peopleOS.ai", role: "branch_head", note: "Branch leadership" },
  { email: "ceo@demo.peopleOS.ai", role: "ceo", note: "Leadership dashboard" },
  { email: "client@demo.peopleOS.ai", role: "client_user", note: "Client Portal aggregate-only" },
  { email: "shivam.giri@teammas.in", role: "super_admin", note: "Shivam Super Admin mapping" },
];

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function assertNonProduction(): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Blocked: demo auth users must not be created in production.");
  }
  if (process.env.ALLOW_DEMO_AUTH_SEED !== "true") {
    throw new Error("Blocked: set ALLOW_DEMO_AUTH_SEED=true to create demo auth users.");
  }
}

async function main() {
  assertNonProduction();

  const supabaseUrl = requireEnv("SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const password = requireEnv("PEOPLEOS_DEMO_PASSWORD");

  if (password.length < 10) {
    throw new Error("PEOPLEOS_DEMO_PASSWORD must be at least 10 characters.");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const created: Array<{ email: string; role: string; id: string; action: "created" | "exists" }> = [];

  for (const user of demoUsers) {
    const createResult = await supabase.auth.admin.createUser({
      email: user.email,
      password,
      email_confirm: true,
      user_metadata: {
        peopleos_demo_user: true,
        peopleos_role: user.role,
        force_change_password: true,
        note: user.note,
      },
    });

    if (!createResult.error && createResult.data.user?.id) {
      created.push({ email: user.email, role: user.role, id: createResult.data.user.id, action: "created" });
      continue;
    }

    const message = createResult.error?.message ?? "unknown error";
    const lower = message.toLowerCase();
    if (!lower.includes("already") && !lower.includes("registered") && !lower.includes("exists")) {
      throw new Error(`Failed creating ${user.email}: ${message}`);
    }

    const listed = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listed.error) throw listed.error;
    const existing = listed.data.users.find((entry) => entry.email?.toLowerCase() === user.email.toLowerCase());
    if (!existing?.id) throw new Error(`User exists but UUID not found for ${user.email}`);
    created.push({ email: user.email, role: user.role, id: existing.id, action: "exists" });
  }

  console.log("\nPeopleOS demo users ready. Use this MySQL mapping SQL for mas_hrms.user_roles:\n");
  for (const row of created) {
    console.log(`-- ${row.email} (${row.action})`);
    console.log("INSERT INTO user_roles (id, user_id, role_key, active_status)");
    console.log(`VALUES (UUID(), '${row.id}', '${row.role}', 1)`);
    console.log("ON DUPLICATE KEY UPDATE active_status = 1;\n");
  }

  console.log("Demo password source: PEOPLEOS_DEMO_PASSWORD env var. Do not commit or share real credentials.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
