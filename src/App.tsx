import { lazy, Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
const Login = lazy(() => import("@/pages/Login"));
const Signup = lazy(() => import("@/pages/Signup"));
const ForgotPassword = lazy(() => import("@/pages/ForgotPassword"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const PendingApproval = lazy(() => import("@/pages/PendingApproval"));
const AgentLayout = lazy(() => import("@/layouts/AgentLayout"));
const AdminLayout = lazy(() => import("@/layouts/AdminLayout"));
const ClientSignature = lazy(() => import("@/pages/ClientSignature"));
import NetworkStatus from "@/components/NetworkStatus";
import ErpPwaManager from "@/components/ErpPwaManager";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import OAuthConsent from "@/pages/OAuthConsent";
import ScrollToTop from "@/components/ScrollToTop";
// Lazy-loaded dashboard pages
const AgentDashboard = lazy(() => import("@/pages/agent/AgentDashboard"));
const AgentBooking = lazy(() => import("@/pages/agent/AgentBooking"));
const AgentWallet = lazy(() => import("@/pages/agent/AgentWallet"));
const AgentProfile = lazy(() => import("@/pages/agent/AgentProfile"));
const AgentMessages = lazy(() => import("@/pages/agent/AgentMessages"));
const AdminOverview = lazy(() => import("@/pages/admin/AdminOverview"));
const AdminApprovalCentre = lazy(() => import("@/pages/admin/AdminApprovalCentre"));
const AdminGuestRequests = lazy(() => import("@/pages/admin/AdminGuestRequests"));
const AdminBookings = lazy(() => import("@/pages/admin/AdminBookings"));
const AdminBookingDetails = lazy(() => import("@/pages/admin/AdminBookingDetails"));
const AdminAgents = lazy(() => import("@/pages/admin/AdminAgents"));
const AdminCommissions = lazy(() => import("@/pages/admin/AdminCommissions"));
const AdminPayouts = lazy(() => import("@/pages/admin/AdminPayouts"));
const AdminServices = lazy(() => import("@/pages/admin/AdminServices"));
const AdminAnalytics = lazy(() => import("@/pages/admin/AdminAnalytics"));
const SystemMonitoring = lazy(() => import("@/pages/admin/SystemMonitoring"));
const AdminNotices = lazy(() => import("@/pages/admin/AdminNotices"));
const AdminMessages = lazy(() => import("@/pages/admin/AdminMessages"));
const ErpDashboard = lazy(() => import("@/pages/admin/ErpDashboard"));
const ErpIncome = lazy(() => import("@/pages/admin/ErpIncome"));
const ErpExpenses = lazy(() => import("@/pages/admin/ErpExpenses"));
const ErpInvoices = lazy(() => import("@/pages/admin/ErpInvoices"));
const ErpReports = lazy(() => import("@/pages/admin/ErpReports"));
const AccountingFinance = lazy(() => import("@/pages/admin/AccountingFinance"));
const CommercialContracts = lazy(() => import("@/pages/admin/CommercialContracts"));
const AdminBookService = lazy(() => import("@/pages/admin/AdminBookService"));
const AdminQuotations = lazy(() => import("@/pages/admin/AdminQuotations"));
const AdminDocuments = lazy(() => import("@/pages/admin/AdminDocuments"));
const AdminClients = lazy(() => import("@/pages/admin/AdminClients"));
const AdminLeads = lazy(() => import("@/pages/admin/AdminLeads"));
const AdminLeadProfile = lazy(() => import("@/pages/admin/AdminLeadProfile"));
const AdminClientProfile = lazy(() => import("@/pages/admin/AdminClientProfile"));
const AdminSettings = lazy(() => import("@/pages/admin/AdminSettings"));
const AdminCertificates = lazy(() => import("@/pages/admin/AdminCertificates"));
const AdminFeedback = lazy(() => import("@/pages/admin/AdminFeedback"));
const AdminPestJobs = lazy(() => import("@/pages/admin/AdminPestJobs"));
const AdminPestJobDetail = lazy(() => import("@/pages/admin/AdminPestJobDetail"));
const AdminPestChemicals = lazy(() => import("@/pages/admin/AdminPestChemicals"));
const AdminPestRevisits = lazy(() => import("@/pages/admin/AdminPestRevisits"));
const AdminDiscountApprovals = lazy(() => import("@/pages/admin/AdminDiscountApprovals"));
const AdminDiscountReports = lazy(() => import("@/pages/admin/AdminDiscountReports"));
const HrDashboard = lazy(() => import("@/pages/admin/hr/HrDashboard"));
const HrEmployees = lazy(() => import("@/pages/admin/hr/HrEmployees"));
const HrEmployee360 = lazy(() => import("@/pages/admin/hr/HrEmployee360"));
const HrDepartments = lazy(() => import("@/pages/admin/hr/HrDepartments"));
const HrPositions = lazy(() => import("@/pages/admin/hr/HrPositions"));
const HrPayroll = lazy(() => import("@/pages/admin/hr/HrPayroll"));
const HrPayrollRun = lazy(() => import("@/pages/admin/hr/HrPayrollRun"));

const NotFound = lazy(() => import("@/pages/NotFound"));

const queryClient = new QueryClient();

function AdminGate() {
  const { user, loading, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="h-8 w-8 rounded-full border-4 border-muted border-t-primary animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/login" replace />;

  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">
      <div className="h-8 w-8 rounded-full border-4 border-muted border-t-primary animate-spin" />
    </div>}>
    <Routes>
      <Route path="/" element={<AdminLayout />}>
        <Route index element={<AdminOverview />} />
        <Route path="approval-centre" element={<AdminApprovalCentre />} />
        <Route path="bookings" element={<AdminBookings />} />
        <Route path="bookings/:id" element={<AdminBookingDetails />} />
        <Route path="discount-approvals" element={<AdminDiscountApprovals />} />
        <Route path="discount-reports" element={<AdminDiscountReports />} />
        <Route path="book-service" element={<AdminBookService />} />
        <Route path="quotations" element={<AdminQuotations />} />
        <Route path="documents" element={<AdminDocuments />} />
        <Route path="certificates" element={<AdminCertificates />} />
        <Route path="agents" element={<AdminAgents />} />
        <Route path="commissions" element={<AdminCommissions />} />
        <Route path="payouts" element={<AdminPayouts />} />
        <Route path="services" element={<AdminServices />} />
        <Route path="analytics" element={<AdminAnalytics />} />
        <Route path="system-monitoring" element={<SuperAdminGate />} />
        <Route path="leads/:id" element={<AdminLeadProfile />} />
        <Route path="leads" element={<AdminLeads />} />
        <Route path="guest-requests" element={<AdminGuestRequests />} />
        <Route path="clients" element={<AdminClients />} />
        <Route path="clients/:id" element={<AdminClientProfile />} />
        <Route path="notices" element={<AdminNotices />} />
        <Route path="messages" element={<AdminMessages />} />
        <Route path="settings" element={<AdminSettings />} />
        <Route path="feedback" element={<AdminFeedback />} />
        <Route path="pest" element={<AdminPestJobs />} />
        <Route path="pest/chemicals" element={<AdminPestChemicals />} />
        <Route path="pest/revisits" element={<AdminPestRevisits />} />
        <Route path="pest/:id" element={<AdminPestJobDetail />} />
        <Route path="hr" element={<HrDashboard />} />
        <Route path="hr/employees" element={<HrEmployees />} />
        <Route path="hr/employees/:id" element={<HrEmployee360 />} />
        <Route path="hr/departments" element={<HrDepartments />} />
        <Route path="hr/positions" element={<HrPositions />} />
        <Route path="hr/payroll" element={<HrPayroll />} />
        <Route path="hr/payroll/:id" element={<HrPayrollRun />} />
        <Route path="erp" element={<ErpDashboard />} />
        <Route path="erp/income" element={<ErpIncome />} />
        <Route path="erp/expenses" element={<ErpExpenses />} />
        <Route path="erp/invoices" element={<ErpInvoices />} />
        <Route path="erp/reports" element={<ErpReports />} />
        <Route path="accounting" element={<Navigate to="/admin/accounting/overview" replace />} />
        <Route path="accounting/:section" element={<AccountingFinance />} />
        <Route path="contracts" element={<CommercialContracts />} />
      </Route>
    </Routes>
    </Suspense>
  );
}

function SuperAdminGate() {
  const { loading, isSuperAdmin } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  if (!isSuperAdmin) return <Navigate to="/admin" replace />;

  return <SystemMonitoring />;
}

function AgentGate() {
  const { user, loading, isAgent, isAdmin, profile } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="h-8 w-8 rounded-full border-4 border-muted border-t-primary animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!isAgent && !isAdmin) return <Navigate to="/login" replace />;

  if (isAgent && !isAdmin && profile?.status === 'pending') {
    return <Suspense fallback={<div className="flex items-center justify-center min-h-screen">
      <div className="h-8 w-8 rounded-full border-4 border-muted border-t-primary animate-spin" />
    </div>}><PendingApproval /></Suspense>;
  }

  if (isAgent && !isAdmin && profile?.status === 'suspended') {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 text-center">
        <div>
          <h1 className="text-xl font-bold text-destructive mb-2">Account Suspended</h1>
          <p className="text-muted-foreground">Your account has been suspended. Contact admin for support.</p>
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">
      <div className="h-8 w-8 rounded-full border-4 border-muted border-t-primary animate-spin" />
    </div>}>
    <Routes>
      <Route path="/" element={<AgentLayout />}>
        <Route index element={<AgentDashboard />} />
        <Route path="book" element={<AgentBooking />} />
        <Route path="wallet" element={<AgentWallet />} />
        <Route path="messages" element={<AgentMessages />} />
        <Route path="profile" element={<AgentProfile />} />
      </Route>
    </Routes>
    </Suspense>
  );
}
function RouteTheme() {
  const location = useLocation();

  useEffect(() => {
    // Apply the new brand tokens everywhere except the ERP module.
    const root = document.getElementById("root");
    if (!root) return;
    const isErpRoute = location.pathname === "/admin/erp" || location.pathname.startsWith("/admin/erp/") || location.pathname.startsWith("/admin/accounting");
    root.classList.toggle("ccs-modern-theme", !isErpRoute);
    return () => root.classList.remove("ccs-modern-theme");
  }, [location.pathname]);

  return null;
}

function AppRoutes() {
  const { user, isAdmin, isAgent } = useAuth();
  useOfflineSync();

  const suspenseFallback = (
    <div className="flex items-center justify-center p-8 text-muted-foreground">
      <div className="h-8 w-8 rounded-full border-4 border-muted border-t-primary animate-spin" />
    </div>
  );

  return (
    <Suspense fallback={suspenseFallback}>
      <Routes>
        <Route path="/" element={<Navigate to={user ? (isAdmin ? '/admin' : isAgent ? '/agent' : '/login') : '/login'} replace />} />

        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/sign" element={<ClientSignature />} />
        <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />

        {/* Admin & agent — each gated independently, only these wait on auth */}
        <Route path="/admin/*" element={<AdminGate />} />
        <Route path="/agent/*" element={<AgentGate />} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <NetworkStatus />
      <BrowserRouter>
        <RouteTheme />
        <ScrollToTop />
        <AuthProvider>
          <ErpPwaManager />
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;