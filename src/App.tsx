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
import InstallPrompt from "@/components/InstallPrompt";
import NetworkStatus from "@/components/NetworkStatus";
import { useOfflineSync } from "@/hooks/useOfflineSync";

// Lazy-loaded dashboard pages
const AgentDashboard = lazy(() => import("@/pages/agent/AgentDashboard"));
const AgentBooking = lazy(() => import("@/pages/agent/AgentBooking"));
const AgentWallet = lazy(() => import("@/pages/agent/AgentWallet"));
const AgentProfile = lazy(() => import("@/pages/agent/AgentProfile"));
const AgentMessages = lazy(() => import("@/pages/agent/AgentMessages"));
const AdminOverview = lazy(() => import("@/pages/admin/AdminOverview"));
const AdminBookings = lazy(() => import("@/pages/admin/AdminBookings"));
const AdminAgents = lazy(() => import("@/pages/admin/AdminAgents"));
const AdminCommissions = lazy(() => import("@/pages/admin/AdminCommissions"));
const AdminPayouts = lazy(() => import("@/pages/admin/AdminPayouts"));
const AdminServices = lazy(() => import("@/pages/admin/AdminServices"));
const AdminAnalytics = lazy(() => import("@/pages/admin/AdminAnalytics"));
const AdminNotices = lazy(() => import("@/pages/admin/AdminNotices"));
const AdminMessages = lazy(() => import("@/pages/admin/AdminMessages"));
const AdminMassEmails = lazy(() => import("@/pages/admin/AdminMassEmails"));
const AdminSmtpSettings = lazy(() => import("@/pages/admin/AdminSmtpSettings"));

const queryClient = new QueryClient();

function AppRoutes() {
  const { user, loading, isAdmin, isAgent, profile } = useAuth();
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
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
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
        {/* Admin routes */}
        {isAdmin && (
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminOverview />} />
            <Route path="bookings" element={<AdminBookings />} />
            <Route path="agents" element={<AdminAgents />} />
            <Route path="commissions" element={<AdminCommissions />} />
            <Route path="payouts" element={<AdminPayouts />} />
            <Route path="services" element={<AdminServices />} />
            <Route path="analytics" element={<AdminAnalytics />} />
            <Route path="notices" element={<AdminNotices />} />
            <Route path="messages" element={<AdminMessages />} />
            <Route path="mass-emails" element={<AdminMassEmails />} />
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

        {/* Default redirect */}
        <Route path="/" element={<Navigate to={isAdmin ? '/admin' : '/agent'} replace />} />
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
      <InstallPrompt />
      <NetworkStatus />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
