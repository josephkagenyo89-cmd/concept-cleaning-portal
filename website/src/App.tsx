import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { useEffect } from "react";
import { HelmetProvider } from "react-helmet-async";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import { CartProvider } from "@/contexts/CartContext";
import { AuthProvider } from "@/hooks/useAuth";
import PublicLayout from "@/components/PublicLayout";
import PortalLayout from "@/components/PortalLayout";
import Index from "./pages/Index";
import About from "./pages/About";
import Services from "./pages/Services";
import ServiceDetail from "./pages/ServiceDetail";
import Pricing from "./pages/Pricing";
import Portfolio from "./pages/Portfolio";
import Booking from "./pages/Booking";
import Contact from "./pages/Contact";
import Shop from "./pages/Shop";
import Blog from "./pages/Blog";
import BlogPost from "./pages/BlogPost";
import Auth from "./pages/Auth";
import PortalDashboard from "./pages/portal/PortalDashboard";
import PortalBookings from "./pages/portal/PortalBookings";
import PortalDocuments from "./pages/portal/PortalDocuments";
import PortalRewards from "./pages/portal/PortalRewards";
import PortalRefer from "./pages/portal/PortalRefer";
import PortalProfile from "./pages/portal/PortalProfile";
import PortalProperties from "./pages/portal/PortalProperties";
import PortalAssets from "./pages/portal/PortalAssets";
import NotFound from "./pages/NotFound";
import ScrollToTop from "@/components/ScrollToTop";


const ERP_LOGIN_URL = "https://concept-cleaning-portal.vercel.app/login";

const ERPLoginRedirect = () => {
  useEffect(() => {
    window.location.replace(ERP_LOGIN_URL);
  }, []);
  return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Redirecting to staff login…</div>;
};

const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
        <CartProvider>
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
            {/* Public */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<Index />} />
              <Route path="/about" element={<About />} />
              <Route path="/services" element={<Services />} />
              <Route path="/services/:slug" element={<ServiceDetail />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/portfolio" element={<Portfolio />} />
              <Route path="/booking" element={<Booking />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/shop" element={<Shop />} />
              <Route path="/blog" element={<Blog />} />
              <Route path="/blog/:slug" element={<BlogPost />} />
            </Route>

            <Route path="/auth" element={<Auth />} />

            {/* Customer Portal */}
            <Route path="/portal" element={<PortalLayout />}>
              <Route index element={<PortalDashboard />} />
              <Route path="bookings" element={<PortalBookings />} />
              <Route path="documents" element={<PortalDocuments />} />
              <Route path="rewards" element={<PortalRewards />} />
              <Route path="refer" element={<PortalRefer />} />
              <Route path="profile" element={<PortalProfile />} />
              <Route path="properties" element={<PortalProperties />} />
              <Route path="assets" element={<PortalAssets />} />
            </Route>

            {/* Legacy website admin routes redirect to the authenticated ERP login. */}
            <Route path="/admin/*" element={<ERPLoginRedirect />} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
        </CartProvider>
        </AuthProvider>

      </TooltipProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
