import { Link } from "react-router-dom";
import {
  ArrowRight,
  BadgeCheck,
  Briefcase,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  GraduationCap,
  LayoutDashboard,
  LockKeyhole,
  ShieldCheck,
  Target,
  UserCheck,
  Users,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useWorkforceAccess } from "@/hooks/useUserRole";

const roleJourneys = [
  {
    role: "Super Admin",
    roleKeys: ["super_admin", "admin"],
    purpose: "Full platform control, RBAC, account control, data governance and system setup.",
    ready: 72,
    priority: "P0",
    homeRoute: "/modules",
    modules: ["Access Control", "Employees", "ATS", "WFM", "Payroll", "Client Portal", "Reports"],
    working: ["Module launcher", "Access Control", "Employee master", "Migration console", "Account-control API foundation"],
    remaining: ["Production account reset enforcement", "Full role simulation switcher", "System health command center"],
    icon: ShieldCheck,
  },
  {
    role: "HR Admin",
    roleKeys: ["hr"],
    purpose: "Employee lifecycle, onboarding, documents, leave, exit and HR governance.",
    ready: 68,
    priority: "P0",
    homeRoute: "/employees",
    modules: ["Employees", "Onboarding", "Leave", "Exit", "Documents", "Assets"],
    working: ["Employee CRUD foundation", "Onboarding", "Leave pages", "Exit Management", "Assets"],
    remaining: ["Document checklist completion", "Lifecycle journey timeline", "HR compliance dashboard"],
    icon: Users,
  },
  {
    role: "Recruiter",
    roleKeys: ["recruiter"],
    purpose: "Assigned ATS candidate queue, sourcing follow-up, joining pipeline and recruiter productivity.",
    ready: 60,
    priority: "P0",
    homeRoute: "/ats/recruiter/my-candidates",
    modules: ["ATS Queue", "Candidate Registration", "Sourcing Analysis"],
    working: ["Candidate registration", "Recruiter queue route", "ATS backend extension APIs"],
    remaining: ["Recruiter dashboard action UX", "Duplicate/reprocess UX", "Offer/joining follow-up view"],
    icon: Briefcase,
  },
  {
    role: "Employee",
    roleKeys: ["employee"],
    purpose: "Self-service profile, attendance, leave, payslip, assets, learning and helpdesk.",
    ready: 62,
    priority: "P0",
    homeRoute: "/dashboard",
    modules: ["Profile", "Attendance", "Leave", "Payslip", "Assets", "Learning"],
    working: ["Dashboard", "Profile", "Attendance", "Leaves", "My Learning route", "Notification preferences"],
    remaining: ["Self document vault", "Own roster calendar", "Helpdesk self-tracking", "Password reset UI"],
    icon: UserCheck,
  },
  {
    role: "WFM",
    roleKeys: ["wfm"],
    purpose: "Roster planning, live adherence, shrinkage, attendance reconciliation and capacity risk.",
    ready: 66,
    priority: "P0",
    homeRoute: "/wfm/roster",
    modules: ["Roster", "RTA", "Shrinkage", "Capacity", "Attendance"],
    working: ["Roster governance page", "RTA backend package", "Workforce mandate APIs", "Attendance pages"],
    remaining: ["Live tracker UI", "Shrinkage dashboard", "Mandate UI", "Coverage action cockpit"],
    icon: CalendarDays,
  },
  {
    role: "Process Manager",
    roleKeys: ["process_manager", "manager"],
    purpose: "Mapped process ownership for staffing, roster publishing, performance, risk and action closure.",
    ready: 58,
    priority: "P0",
    homeRoute: "/performance/command-center",
    modules: ["Process Dashboard", "Roster", "Capacity", "Performance", "Actions"],
    working: ["Performance command center", "Roster owner backend rules", "Capacity APIs"],
    remaining: ["Process Manager homepage", "Team gap drilldown", "Action closure UX", "Mapped scope filters"],
    icon: Target,
  },
  {
    role: "Assistant Manager / Team Leader",
    roleKeys: ["assistant_manager", "am", "team_leader", "tl"],
    purpose: "Scoped team monitoring, attendance follow-up, roster exceptions and coaching actions.",
    ready: 48,
    priority: "P1",
    homeRoute: "/performance",
    modules: ["Team Attendance", "Performance", "Coaching", "Roster Exceptions"],
    working: ["Performance pages", "Team role boundaries in roster package", "Leave/attendance base pages"],
    remaining: ["TL/AM cockpit", "Exception queue", "Agent drilldown", "Coaching action closure"],
    icon: ClipboardList,
  },
  {
    role: "QA",
    roleKeys: ["qa"],
    purpose: "Quality dashboard, defects, coaching, TNI, CAPA and agent performance feedback.",
    ready: 42,
    priority: "P1",
    homeRoute: "/quality/dashboard",
    modules: ["Quality", "Coaching", "Performance", "Reports"],
    working: ["Quality dashboard route", "Performance command center", "Placeholder dashboard"],
    remaining: ["Call Master integration", "QA scorecards", "TNI/CAPA workflow", "Client-safe quality summary"],
    icon: ShieldCheck,
  },
  {
    role: "Trainer",
    roleKeys: ["trainer"],
    purpose: "Training batch pipeline, LMS readiness, certification and manpower projection.",
    ready: 40,
    priority: "P1",
    homeRoute: "/lms/coordinator",
    modules: ["LMS Snapshot", "Training Pipeline", "Certification"],
    working: ["LMS coordinator route", "My Learning route", "LMS integration-only guidance"],
    remaining: ["External LMS snapshot sync", "Training projection dashboard", "Certification-to-deployment handoff"],
    icon: GraduationCap,
  },
  {
    role: "Payroll / Finance",
    roleKeys: ["finance", "payroll"],
    purpose: "Payroll preparation, payslips, tax declarations, F&F and statutory workflows.",
    ready: 55,
    priority: "P1",
    homeRoute: "/payroll",
    modules: ["Payroll", "Payslip", "Tax", "F&F"],
    working: ["Payroll page", "Payroll/F&F backend foundation", "Safety validations"],
    remaining: ["PF/UAN/ESIC/TDS policy UI", "Maker-checker payroll runs", "Payslip preview/download", "Bank export"],
    icon: CreditCard,
  },
  {
    role: "CEO / Leadership / Branch Head",
    roleKeys: ["ceo", "branch_head"],
    purpose: "Leadership health view across manpower, performance, quality, client, finance and risk.",
    ready: 50,
    priority: "P0",
    homeRoute: "/reports",
    modules: ["Leadership Dashboard", "Reports", "Capacity", "Client Health"],
    working: ["Reports route", "Workforce mandate leadership summary API", "Performance command center"],
    remaining: ["CEO cockpit UI", "Branch/process filter layer", "Client health score", "Risk/action drilldowns"],
    icon: LayoutDashboard,
  },
  {
    role: "Client User",
    roleKeys: ["client_user"],
    purpose: "Client Portal aggregate-only process performance, staffing readiness and governance actions.",
    ready: 46,
    priority: "P0",
    homeRoute: "/portal",
    modules: ["Client Portal", "Process Dashboard", "Published Reports"],
    working: ["Portal login", "Portal overview", "Process dashboard route", "Client data blocklist"],
    remaining: ["SOW/SLA master", "Published metrics workflow", "Client requests/MOM", "Approved staffing and quality summaries"],
    icon: Building2,
  },
];

const statusClass = (ready: number) => {
  if (ready >= 70) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (ready >= 50) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-rose-50 text-rose-700 border-rose-200";
};

export default function RoleJourneyDashboard() {
  const access = useWorkforceAccess();
  const userRoleSet = new Set(access.roleKeys);

  const activeRoleCards = roleJourneys.filter((journey) =>
    journey.roleKeys.some((roleKey) => userRoleSet.has(roleKey))
  );

  const visibleCards = activeRoleCards.length > 0 ? activeRoleCards : roleJourneys;
  const averageReady = Math.round(roleJourneys.reduce((sum, role) => sum + role.ready, 0) / roleJourneys.length);
  const p0Open = roleJourneys.filter((role) => role.priority === "P0" && role.ready < 80).length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <section className="rounded-3xl border bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6 text-white shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-cyan-200">PeopleOS Frontend Role Journey</p>
              <h1 className="mt-2 text-3xl font-bold">Role-wise operating cockpit</h1>
              <p className="mt-2 max-w-4xl text-sm text-slate-300">
                Use this page to review what each role can do today, which pages are already usable, and what remains before PeopleOS becomes production-complete.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-200">
                {(access.roleKeys.length ? access.roleKeys : ["no role loaded"]).map((role) => (
                  <span key={role} className="rounded-full bg-white/10 px-3 py-1">{role}</span>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                <p className="text-2xl font-bold">{roleJourneys.length}</p>
                <p className="text-xs text-slate-300">role journeys</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                <p className="text-2xl font-bold">{averageReady}%</p>
                <p className="text-xs text-slate-300">avg readiness</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                <p className="text-2xl font-bold">{p0Open}</p>
                <p className="text-xs text-slate-300">P0 gaps</p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-slate-800"><BadgeCheck className="h-5 w-5" /><h2 className="font-semibold">Built foundation</h2></div>
            <p className="text-sm text-slate-600">RBAC, module launcher, ATS, WFM roster, attendance/RTA backend, account-control foundation, workforce mandate APIs and client portal shell.</p>
          </div>
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-slate-800"><LockKeyhole className="h-5 w-5" /><h2 className="font-semibold">Safety boundary</h2></div>
            <p className="text-sm text-slate-600">Client users must only see aggregate published data. Payroll, PII, raw roster, attendance reasons and grievances remain blocked.</p>
          </div>
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-slate-800"><CheckCircle2 className="h-5 w-5" /><h2 className="font-semibold">Next build focus</h2></div>
            <p className="text-sm text-slate-600">Convert placeholders into real role cockpits, wire API-backed cards and finish role-specific action queues.</p>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          {visibleCards.map((journey) => {
            const Icon = journey.icon;
            return (
              <article key={journey.role} className="rounded-3xl border bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-bold text-slate-900">{journey.role}</h2>
                        <span className="rounded-full border px-2 py-0.5 text-[11px] font-semibold text-slate-600">{journey.priority}</span>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">{journey.purpose}</p>
                    </div>
                  </div>
                  <div className={`rounded-full border px-3 py-1 text-sm font-bold ${statusClass(journey.ready)}`}>{journey.ready}% ready</div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {journey.modules.map((module) => (
                    <span key={module} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{module}</span>
                  ))}
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div>
                    <h3 className="text-sm font-semibold text-emerald-700">Working / foundation ready</h3>
                    <ul className="mt-2 space-y-1 text-sm text-slate-600">
                      {journey.working.map((item) => <li key={item}>• {item}</li>)}
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-amber-700">Remaining to finish</h3>
                    <ul className="mt-2 space-y-1 text-sm text-slate-600">
                      {journey.remaining.map((item) => <li key={item}>• {item}</li>)}
                    </ul>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between border-t pt-4">
                  <p className="text-xs text-slate-500">Role keys: {journey.roleKeys.join(", ")}</p>
                  <Link to={journey.homeRoute} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700">
                    Open journey <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </DashboardLayout>
  );
}
