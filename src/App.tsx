
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Suspense, lazy } from "react";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";
import Dashboard from "./pages/Dashboard";
import SettingsPage from "./pages/SettingsPage";
import AdminRoute from "./components/admin/AdminRoute";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import AdminLayoutPage from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import UsersManagement from "./pages/admin/UsersManagement";
import ReceiptsManagement from "./pages/admin/ReceiptsManagement";
import AnalyticsPage from "./pages/admin/AnalyticsPage";
import AdminSettingsPage from "./pages/admin/SettingsPage";

// Lazy load other pages for better performance
const ViewReceipt = lazy(() => import("./pages/ViewReceipt"));
const Profile = lazy(() => import("./pages/Profile"));
const AnalysisPage = lazy(() => import("./pages/AnalysisPage"));
const SemanticSearch = lazy(() => import("./pages/SemanticSearch"));
const PricingPage = lazy(() => import("./pages/PricingPage"));

// Create a loading component for suspense
const PageLoading = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="w-12 h-12 rounded-full border-4 border-primary/30 border-t-primary animate-spin"></div>
  </div>
);

// Configure React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/auth/reset-password" element={<AuthCallback />} />
            <Route path="/pricing" element={
              <Suspense fallback={<PageLoading />}>
                <PricingPage />
              </Suspense>
            } />
            <Route path="*" element={<NotFound />} />

            {/* Protected Routes - Require Authentication */}
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/upload" element={<Navigate to="/dashboard" replace />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/receipt/:id" element={
                <Suspense fallback={<PageLoading />}>
                  <ViewReceipt />
                </Suspense>
              } />
              <Route path="/profile" element={
                <Suspense fallback={<PageLoading />}>
                  <Profile />
                </Suspense>
              } />
              <Route path="/analysis" element={
                <Suspense fallback={<PageLoading />}>
                  <AnalysisPage />
                </Suspense>
              } />
              <Route path="/search" element={
                <Suspense fallback={<PageLoading />}>
                  <SemanticSearch />
                </Suspense>
              } />
            </Route>

            {/* Admin Routes - Require Admin Role */}
            <Route element={<AdminRoute />}>
              <Route path="/admin" element={<AdminLayoutPage />}>
                <Route index element={<AdminDashboard />} />
                <Route path="users" element={<UsersManagement />} />
                <Route path="receipts" element={<ReceiptsManagement />} />
                <Route path="analytics" element={<AnalyticsPage />} />
                <Route path="settings" element={<AdminSettingsPage />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
