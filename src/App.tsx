import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
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
import CustomerProfileRequiredDialog from "@/components/marketplace/CustomerProfileRequiredDialog";
// Lazy-loaded dashboard pages
const AgentDashboard = lazy(() => import("@/pages/agent/AgentDashboard"));
const AgentBooking = lazy(() => import("@/pages/agent/AgentBooking"));
const AgentWallet = lazy(() => import("@/pages/agent/AgentWallet"));
const AgentProfile = lazy(() => import("@/pages/agent/AgentProfile"));
const AgentMessages = lazy(() => import("@/pages/agent/AgentMessages"));
const AdminOverview = lazy(() => import("@/pages/admin/AdminOverview"));
const AdminBookings = lazy(() => import("@/pages/admin/AdminBookings"));
const AdminBookingDetails = lazy(() => import("@/pages/admin/AdminBookingDetails"));
const AdminAgents = lazy(() => import("@/pages/admin/AdminAgents"));
const AdminCommissions = lazy(() => import("@/pages/admin/AdminCommissions"));
const AdminPayouts = lazy(() => import("@/pages/admin/AdminPayouts"));
const AdminServices = lazy(() => import("@/pages/admin/AdminServices"));
const AdminAnalytics = lazy(() => import("@/pages/admin/AdminAnalytics"));
const AdminNotices = lazy(() => import("@/pages/admin/AdminNotices"));
const AdminMessages = lazy(() => import("@/pages/admin/AdminMessages"));
const ErpDashboard = lazy(() => import("@/pages/admin/ErpDashboard"));
const ErpIncome = lazy(() => import("@/pages/admin/ErpIncome"));
const ErpExpenses = lazy(() => import("@/pages/admin/ErpExpenses"));
const ErpInvoices = lazy(() => import("@/pages/admin/ErpInvoices"));
const ErpReports = lazy(() => import("@/pages/admin/ErpReports"));
const AdminBookService = lazy(() => import("@/pages/admin/AdminBookService"));
const AdminQuotations = lazy(() => import("@/pages/admin/AdminQuotations"));
const AdminDocuments = lazy(() => import("@/pages/admin/AdminDocuments"));
const AdminClients = lazy(() => import("@/pages/admin/AdminClients"));
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

// Marketplace + customer portal
const MarketplaceLayout = lazy(() => import("@/components/marketplace/MarketplaceLayout"));
const MarketHome = lazy(() => import("@/pages/marketplace/MarketHome"));
const MarketCategories = lazy(() => import("@/pages/marketplace/MarketCategories"));
const MarketServiceDetail = lazy(() => import("@/pages/marketplace/MarketServiceDetail"));
const CustomerAuth = lazy(() => import("@/pages/marketplace/CustomerAuth"));
const CustomerBookings = lazy(() => import("@/pages/marketplace/CustomerBookings"));
const CustomerDocuments = lazy(() => import("@/pages/marketplace/CustomerDocuments"));
const CustomerMessages = lazy(() => import("@/pages/marketplace/CustomerMessages"));
const CustomerAccount = lazy(() => import("@/pages/marketplace/CustomerAccount"));
const CustomerDashboard = lazy(() => import("@/pages/marketplace/CustomerDashboard"));
const CustomerSupport = lazy(() => import("@/pages/marketplace/CustomerSupport"));
const CustomerNotifications = lazy(() => import("@/pages/marketplace/CustomerNotifications"));
const PrivacyPolicy = lazy(() => import("@/pages/PrivacyPolicy"));
const TermsAndConditions = lazy(() => import("@/pages/TermsAndConditions"));

const marketplaceRoutes = (
  <Route element={<MarketplaceLayout />}>
    <Route path="/privacy-policy" element={<PrivacyPolicy />} />
    <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
    <Route path="/" element={<MarketHome />} />
    <Route path="/categories" element={<MarketCategories />} />
    <Route path="/service/:id" element={<MarketServiceDetail />} />
    <Route path="/customer-auth" element={<CustomerAuth />} />

    <Route element={<CustomerGate />}>
      <Route path="/my" element={<CustomerDashboard />} />
      <Route path="/my/bookings" element={<CustomerBookings />} />
      <Route path="/my/documents" element={<CustomerDocuments />} />
      <Route path="/my/messages" element={<CustomerMessages />} />
      <Route path="/my/notifications" element={<CustomerNotifications />} />
      <Route path="/my/support" element={<CustomerSupport />} />
    </Route>

    <Route path="/my/account" element={<CustomerAccount />} />
  </Route>
);

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
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">
      <div className="h-8 w-8 rounded-full border-4 border-muted border-t-primary animate-spin" />
    </div>}>
    <Routes>
      <Route path="/" element={<AdminLayout />}>
        <Route index element={<AdminOverview />} />
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
        <Route path="erp" element={<ErpDashboard />} />
        <Route path="erp/income" element={<ErpIncome />} />
        <Route path="erp/expenses" element={<ErpExpenses />} />
        <Route path="erp/invoices" element={<ErpInvoices />} />
        <Route path="erp/reports" element={<ErpReports />} />
      </Route>
    </Routes>
    </Suspense>
  );
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
  if (!isAgent && !isAdmin) return <Navigate to="/" replace />;

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
function CustomerGate() {
  const { user, loading, isCustomer, customerClient } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="h-8 w-8 rounded-full border-4 border-muted border-t-primary animate-spin" />
      </div>
    );
  }

  if (!user || !isCustomer) return <Navigate to="/customer-auth" replace />;
  const profileIncomplete =
    !customerClient ||
    !customerClient.full_name?.trim() ||
    !customerClient.phone?.trim() ||
    !customerClient.location?.trim();

  return (
    <>
      <Outlet />
      {profileIncomplete && <CustomerProfileRequiredDialog />}
    </>
  );
 }
function AppRoutes() {
  const { user, isAdmin, isAgent, isCustomer } = useAuth();
  useOfflineSync();

  const suspenseFallback = (
    <div className="flex items-center justify-center p-8 text-muted-foreground">
      <div className="h-8 w-8 rounded-full border-4 border-muted border-t-primary animate-spin" />
    </div>
  );

  return (
    <Suspense fallback={suspenseFallback}>
      <Routes>
        {/* Public marketplace + customer portal — always renders immediately, no auth wait */}
        {marketplaceRoutes}

        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/sign" element={<ClientSignature />} />
        <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />

        {/* Admin & agent — each gated independently, only these wait on auth */}
        <Route path="/admin/*" element={<AdminGate />} />
        <Route path="/agent/*" element={<AgentGate />} />

        {/* Logged-in staff landing on "/" get bounced to their dashboard */}
        {user && !isCustomer && (
          <Route path="/" element={<Navigate to={isAdmin ? '/admin' : isAgent ? '/agent' : '/'} replace />} />
        )}

        <Route path="*" element={<Navigate to="/" replace />} />
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
        <AuthProvider>
          <ErpPwaManager />
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;