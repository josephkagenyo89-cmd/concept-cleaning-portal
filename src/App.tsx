import { lazy, Suspense } from "react";
import { Sparkles } from "lucide-react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import PendingApproval from "@/pages/PendingApproval";
import AgentLayout from "@/layouts/AgentLayout";
import AdminLayout from "@/layouts/AdminLayout";
import NotFound from "@/pages/NotFound";
import ClientSignature from "@/pages/ClientSignature";
import NetworkStatus from "@/components/NetworkStatus";
import ErpPwaManager from "@/components/ErpPwaManager";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import OAuthConsent from "@/pages/OAuthConsent";

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

const marketplaceRoutes = (
  <Route element={<MarketplaceLayout />}>
    <Route path="/" element={<MarketHome />} />
    <Route path="/categories" element={<MarketCategories />} />
    <Route path="/service/:id" element={<MarketServiceDetail />} />
    <Route path="/customer-auth" element={<CustomerAuth />} />
    <Route path="/my" element={<CustomerDashboard />} />
    <Route path="/my/bookings" element={<CustomerBookings />} />
    <Route path="/my/documents" element={<CustomerDocuments />} />
    <Route path="/my/messages" element={<CustomerMessages />} />
    <Route path="/my/account" element={<CustomerAccount />} />
    <Route path="/my/support" element={<CustomerSupport />} />
  </Route>
);

const queryClient = new QueryClient();

function AppRoutes() {
  const { user, loading, isAdmin, isAgent, isCustomer, profile } = useAuth();
  useOfflineSync();

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background transition-opacity duration-500">
        <div className="flex flex-col items-center gap-6 animate-fade-in">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary">
            <Sparkles className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Concept Cleaning Services</h1>
          <div className="h-10 w-10 rounded-full border-4 border-muted border-t-primary animate-spin" />
          <div className="text-center space-y-1">
            <p className="text-sm font-medium text-foreground">Preparing your workspace...</p>
            <p className="text-xs text-muted-foreground">Please wait while we load your dashboard.</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Suspense fallback={null}>
      <Routes>
        {marketplaceRoutes}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/sign" element={<ClientSignature />} />
        <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
        <Route path="/admin/*" element={<Navigate to="/login" replace />} />
        <Route path="/agent/*" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    );
  }

  // Agent pending approval
  if (isAgent && !isAdmin && profile?.status === 'pending') {
    return (
      <Routes>
        <Route path="*" element={<PendingApproval />} />
      </Routes>
    );
  }

  // Agent suspended
  if (isAgent && !isAdmin && profile?.status === 'suspended') {
    return (
      <Routes>
        <Route path="*" element={
          <div className="flex min-h-screen items-center justify-center p-4 text-center">
            <div>
              <h1 className="text-xl font-bold text-destructive mb-2">Account Suspended</h1>
              <p className="text-muted-foreground">Your account has been suspended. Contact admin for support.</p>
            </div>
          </div>
        } />
      </Routes>
    );
  }

  const suspenseFallback = (
    <div className="flex items-center justify-center p-8 text-muted-foreground">
      <div className="h-8 w-8 rounded-full border-4 border-muted border-t-primary animate-spin" />
    </div>
  );

  return (
    <Suspense fallback={suspenseFallback}>
      <Routes>
        {/* Public marketplace + customer portal */}
        {marketplaceRoutes}

        {/* Admin routes */}
        {isAdmin && (
          <Route path="/admin" element={<AdminLayout />}>
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
        )}

        {/* Agent routes */}
        {isAgent && (
          <Route path="/agent" element={<AgentLayout />}>
            <Route index element={<AgentDashboard />} />
            <Route path="book" element={<AgentBooking />} />
            <Route path="wallet" element={<AgentWallet />} />
            <Route path="messages" element={<AgentMessages />} />
            <Route path="profile" element={<AgentProfile />} />
          </Route>
        )}

        {/* Public routes */}
        <Route path="/sign" element={<ClientSignature />} />
        <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />

        {/* Default redirect */}
        {!isCustomer && <Route path="/" element={<Navigate to={isAdmin ? '/admin' : '/agent'} replace />} />}
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
