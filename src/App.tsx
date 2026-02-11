import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import PendingApproval from "@/pages/PendingApproval";
import AgentLayout from "@/layouts/AgentLayout";
import AgentDashboard from "@/pages/agent/AgentDashboard";
import AgentBooking from "@/pages/agent/AgentBooking";
import AgentWallet from "@/pages/agent/AgentWallet";
import AgentProfile from "@/pages/agent/AgentProfile";
import AdminLayout from "@/layouts/AdminLayout";
import AdminOverview from "@/pages/admin/AdminOverview";
import AdminBookings from "@/pages/admin/AdminBookings";
import AdminAgents from "@/pages/admin/AdminAgents";
import AdminCommissions from "@/pages/admin/AdminCommissions";
import AdminPayouts from "@/pages/admin/AdminPayouts";
import AdminServices from "@/pages/admin/AdminServices";
import AdminAnalytics from "@/pages/admin/AdminAnalytics";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function AppRoutes() {
  const { user, loading, isAdmin, isAgent, profile } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
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

  return (
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
        </Route>
      )}

      {/* Agent routes */}
      {isAgent && (
        <Route path="/agent" element={<AgentLayout />}>
          <Route index element={<AgentDashboard />} />
          <Route path="book" element={<AgentBooking />} />
          <Route path="wallet" element={<AgentWallet />} />
          <Route path="profile" element={<AgentProfile />} />
        </Route>
      )}

      {/* Default redirect */}
      <Route path="/" element={<Navigate to={isAdmin ? '/admin' : '/agent'} replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
