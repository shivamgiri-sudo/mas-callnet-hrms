import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import CookieConsent from "@/components/layout/CookieConsent";
import { OfflineFallback } from "@/components/layout/OfflineFallback";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import WorkforcePageGate from "@/components/security/WorkforcePageGate";
import ScrollToTop from "@/components/layout/ScrollToTop";
import Landing from "./pages/Landing";
import Features from "./pages/Features";
import HowItWorks from "./pages/HowItWorks";
import Pricing from "./pages/Pricing";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import Security from "./pages/Security";
import Index from "./pages/Index";
import Employees from "./pages/Employees";
import Onboarding from "./pages/Onboarding";
import Leaves from "./pages/Leaves";
import Assets from "./pages/Assets";
import Payroll from "./pages/Payroll";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Profile from "./pages/Profile";
import Performance from "./pages/Performance";
import ReviewsManagement from "./pages/ReviewsManagement";

import Attendance from "./pages/Attendance";
import AttendanceRegularization from "./pages/AttendanceRegularization";
import BulkUploadHub from "./pages/BulkUploadHub";
import Departments from "./pages/Departments";
import CompanyCalendar from "./pages/CompanyCalendar";
import NotificationPreferences from "./pages/NotificationPreferences";
import Changelog from "./pages/Changelog";

import ModuleLauncher from "./pages/ModuleLauncher";
import RoleJourneyDashboard from "./pages/RoleJourneyDashboard";
import NativeATSDashboard from "./pages/NativeATSDashboard";
import NativeATSCandidateRegistration from "./pages/NativeATSCandidateRegistration";
import NativeATSRecruiterDashboard from "./pages/NativeATSRecruiterDashboard";
import NativeLMSMyLearning from "./pages/NativeLMSMyLearning";
import NativeLMSCoordinator from "./pages/NativeLMSCoordinator";
import NativeWFMRoster from "./pages/NativeWFMRoster";
import UnifiedPerformanceCommandCenter from "./pages/UnifiedPerformanceCommandCenter";
import UnifiedAccessControl from "./pages/UnifiedAccessControl";
import NativePlaceholderPage from "./pages/NativePlaceholderPage";
import NativeMigrationConsole from "./pages/NativeMigrationConsole";
import NativeExitManagement from "./pages/NativeExitManagement";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";

import PortalLogin from "./pages/portal/PortalLogin";
import PortalOverview from "./pages/portal/PortalOverview";
import PortalProcessDashboard from "./pages/portal/PortalProcessDashboard";
import { PortalRoute } from "./components/portal/PortalRoute";

const queryClient = new QueryClient();

const Gate = ({ pageCode, children }: { pageCode: string; children: React.ReactNode }) => (
  <WorkforcePageGate pageCode={pageCode}>{children}</WorkforcePageGate>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ScrollToTop />
          <Routes>
            <Route path="/" element={<Navigate to="/auth" replace />} />
            <Route path="/features" element={<Features />} />
            <Route path="/how-it-works" element={<HowItWorks />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/terms-of-service" element={<TermsOfService />} />
            <Route path="/security" element={<Security />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            <Route path="/interview-registration" element={<NativeATSCandidateRegistration />} />
            <Route path="/candidate-registration" element={<Navigate to="/interview-registration" replace />} />
            <Route path="/walkin-registration" element={<Navigate to="/interview-registration" replace />} />

            <Route path="/dashboard" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/employees" element={<ProtectedRoute><Employees /></ProtectedRoute>} />
            <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
            <Route path="/onboarding-requests" element={<Navigate to="/onboarding?tab=requests" replace />} />
            <Route path="/leaves" element={<ProtectedRoute><Leaves /></ProtectedRoute>} />
            <Route path="/leave-approvals" element={<Navigate to="/leaves" replace />} />
            <Route path="/assets" element={<ProtectedRoute><Assets /></ProtectedRoute>} />
            <Route path="/payroll" element={<ProtectedRoute><Payroll /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/performance" element={<ProtectedRoute><Performance /></ProtectedRoute>} />
            <Route path="/reviews-management" element={<ProtectedRoute><ReviewsManagement /></ProtectedRoute>} />
            <Route path="/attendance" element={<ProtectedRoute><Attendance /></ProtectedRoute>} />
            <Route path="/attendance-regularization" element={<ProtectedRoute><AttendanceRegularization /></ProtectedRoute>} />
            <Route path="/bulk-upload" element={<ProtectedRoute><BulkUploadHub /></ProtectedRoute>} />
            <Route path="/departments" element={<ProtectedRoute><Departments /></ProtectedRoute>} />
            <Route path="/calendar" element={<ProtectedRoute><CompanyCalendar /></ProtectedRoute>} />
            <Route path="/notification-preferences" element={<ProtectedRoute><NotificationPreferences /></ProtectedRoute>} />

            <Route path="/modules" element={<ProtectedRoute><ModuleLauncher /></ProtectedRoute>} />
            <Route path="/role-journeys" element={<ProtectedRoute><RoleJourneyDashboard /></ProtectedRoute>} />
            <Route path="/ats/dashboard" element={<ProtectedRoute><Gate pageCode="ATS_DASHBOARD"><NativeATSDashboard /></Gate></ProtectedRoute>} />
            <Route path="/ats/candidate-registration" element={<ProtectedRoute><NativeATSCandidateRegistration /></ProtectedRoute>} />
            <Route path="/ats/recruiter/my-candidates" element={<ProtectedRoute><Gate pageCode="ATS_RECRUITER_QUEUE"><NativeATSRecruiterDashboard /></Gate></ProtectedRoute>} />
            <Route path="/ats/sourcing-analysis" element={<ProtectedRoute><Gate pageCode="ATS_DASHBOARD"><NativePlaceholderPage title="ATS Sourcing Analysis" module="ATS" /></Gate></ProtectedRoute>} />
            <Route path="/lms/my-learning" element={<ProtectedRoute><Gate pageCode="LMS_MY_LEARNING"><NativeLMSMyLearning /></Gate></ProtectedRoute>} />
            <Route path="/lms/coordinator" element={<ProtectedRoute><Gate pageCode="LMS_COORDINATOR"><NativeLMSCoordinator /></Gate></ProtectedRoute>} />
            <Route path="/lms/admin" element={<ProtectedRoute><Gate pageCode="LMS_ADMIN"><NativePlaceholderPage title="LMS Admin" module="LMS" /></Gate></ProtectedRoute>} />
            <Route path="/lms/management-dashboard" element={<ProtectedRoute><Gate pageCode="LMS_MANAGEMENT_DASHBOARD"><NativePlaceholderPage title="LMS Management Dashboard" module="LMS" /></Gate></ProtectedRoute>} />
            <Route path="/wfm/roster" element={<ProtectedRoute><Gate pageCode="WFM_ROSTER"><NativeWFMRoster /></Gate></ProtectedRoute>} />
            <Route path="/wfm/live-tracker" element={<ProtectedRoute><Gate pageCode="WFM_LIVE_TRACKER"><NativePlaceholderPage title="WFM Live Tracker" module="WFM" /></Gate></ProtectedRoute>} />
            <Route path="/quality/dashboard" element={<ProtectedRoute><Gate pageCode="QUALITY_DASHBOARD"><NativePlaceholderPage title="Quality Dashboard" module="Quality" /></Gate></ProtectedRoute>} />
            <Route path="/operations/dashboard" element={<ProtectedRoute><Gate pageCode="OPERATIONS_DASHBOARD"><NativePlaceholderPage title="Operations Dashboard" module="Operations" /></Gate></ProtectedRoute>} />
            <Route path="/performance/command-center" element={<ProtectedRoute><Gate pageCode="WORKFORCE_COMMAND_CENTER"><UnifiedPerformanceCommandCenter /></Gate></ProtectedRoute>} />
            <Route path="/settings/access-control" element={<ProtectedRoute><Gate pageCode="ACCESS_CONTROL"><UnifiedAccessControl /></Gate></ProtectedRoute>} />

            {/* Client Portal Routes */}
            <Route path="/portal/login" element={<PortalLogin />} />
            <Route path="/portal" element={<PortalRoute><PortalOverview /></PortalRoute>} />
            <Route path="/portal/processes/:id" element={<PortalRoute><PortalProcessDashboard /></PortalRoute>} />

            <Route path="/migration-console" element={<ProtectedRoute><NativeMigrationConsole /></ProtectedRoute>} />
            <Route path="/exit-management" element={<ProtectedRoute><NativeExitManagement /></ProtectedRoute>} />

            <Route path="/changelog" element={<ProtectedRoute><Changelog /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <CookieConsent />
          <OfflineFallback />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
