import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
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


import AdminLogin from "./pages/admin/AdminLogin";
import AdminLayout from "./pages/admin/AdminLayout";
import Dashboard from "./pages/admin/Dashboard";
import AdminBookings from "./pages/admin/AdminBookings";
import AdminServices from "./pages/admin/AdminServices";
import AdminPortfolio from "./pages/admin/AdminPortfolio";
import AdminInvoices from "./pages/admin/AdminInvoices";
import AdminClients from "./pages/admin/AdminClients";
import AdminProcurement from "./pages/admin/AdminProcurement";
import AdminAccounting from "./pages/admin/AdminAccounting";
import AdminHR from "./pages/admin/AdminHR";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminRewards from "./pages/admin/AdminRewards";
import AdminProducts from "./pages/admin/AdminProducts";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminBlog from "./pages/admin/AdminBlog";

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

            {/* Admin */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="bookings" element={<AdminBookings />} />
              <Route path="services" element={<AdminServices />} />
              <Route path="portfolio" element={<AdminPortfolio />} />
              <Route path="invoices" element={<AdminInvoices />} />
              <Route path="clients" element={<AdminClients />} />
              <Route path="procurement" element={<AdminProcurement />} />
              <Route path="accounting" element={<AdminAccounting />} />
              <Route path="hr" element={<AdminHR />} />
              <Route path="rewards" element={<AdminRewards />} />
              <Route path="products" element={<AdminProducts />} />
              <Route path="orders" element={<AdminOrders />} />
              <Route path="blog" element={<AdminBlog />} />
              <Route path="settings" element={<AdminSettings />} />
            </Route>

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
