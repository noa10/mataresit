
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Suspense, lazy } from "react";
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider } from "@/contexts/AuthContext";
import { StripeProvider } from "@/contexts/StripeContext";
import { ChatControlsProvider } from "@/contexts/ChatControlsContext";
import { TeamProvider } from "@/contexts/TeamContext";
import { AppLayout } from "@/components/AppLayout";
import { PublicLayout } from "@/components/PublicLayout";
// Debug component disabled - uncomment to enable: import { MobileDebugInfo } from "@/components/debug/MobileDebugInfo";
import Index from "./pages/Index";

// Cross-browser testing disabled - uncomment to enable debug mode
// if (process.env.NODE_ENV === 'development') {
//   import("@/utils/cross-browser-test");
//   import("@/utils/validate-cross-browser");
//   import("@/utils/verify-fix");
// }
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
import BlogManagement from "./pages/admin/BlogManagement";

// Lazy load other pages for better performance
const ViewReceipt = lazy(() => import("./pages/ViewReceipt"));
const Profile = lazy(() => import("./pages/Profile"));
const AnalysisPage = lazy(() => import("./pages/AnalysisPage"));
const SemanticSearch = lazy(() => import("./pages/SemanticSearch"));
const FeaturesPage = lazy(() => import("./pages/FeaturesPage"));
const PricingPage = lazy(() => import("./pages/PricingPage"));
const PaymentSuccessPage = lazy(() => import("./pages/PaymentSuccessPage"));
const HelpCenter = lazy(() => import("./pages/HelpCenter"));
const DocumentationPage = lazy(() => import("./pages/DocumentationPage"));
const StatusPage = lazy(() => import("./pages/StatusPage"));
const BlogIndexPage = lazy(() => import("./pages/BlogIndexPage"));
const BlogPostPage = lazy(() => import("./pages/BlogPostPage"));
const TeamManagement = lazy(() => import("./pages/TeamManagement"));
const ClaimsManagement = lazy(() => import("./pages/ClaimsManagement"));
const TeamInvitation = lazy(() => import("./pages/TeamInvitation"));
const ClaimsReceiptIntegrationTest = lazy(() => import("./pages/ClaimsReceiptIntegrationTest"));
const TestInvitation = lazy(() => import("./pages/TestInvitation"));
const TestInvitationAcceptance = lazy(() => import("./pages/TestInvitationAcceptance"));
const ProductionInvitationDebug = lazy(() => import("./pages/ProductionInvitationDebug"));


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
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TeamProvider>
          <StripeProvider>
            <ChatControlsProvider>
              <TooltipProvider>
            <Toaster />
            <Sonner />
            {/* Debug info disabled - uncomment to enable: <MobileDebugInfo /> */}
            <BrowserRouter>
          <Routes>
            {/* Public Routes with Layout */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<Index />} />
              <Route path="/pricing" element={
                <Suspense fallback={<PageLoading />}>
                  <PricingPage />
                </Suspense>
              } />
              <Route path="/help" element={
                <Suspense fallback={<PageLoading />}>
                  <HelpCenter />
                </Suspense>
              } />
              <Route path="/docs" element={
                <Suspense fallback={<PageLoading />}>
                  <DocumentationPage />
                </Suspense>
              } />
              <Route path="/status" element={
                <Suspense fallback={<PageLoading />}>
                  <StatusPage />
                </Suspense>
              } />
              <Route path="/blog" element={
                <Suspense fallback={<PageLoading />}>
                  <BlogIndexPage />
                </Suspense>
              } />
              <Route path="/blog/:slug" element={
                <Suspense fallback={<PageLoading />}>
                  <BlogPostPage />
                </Suspense>
              } />
              <Route path="/payment-success" element={
                <Suspense fallback={<PageLoading />}>
                  <PaymentSuccessPage />
                </Suspense>
              } />
            </Route>

            {/* Auth Routes (no layout) */}
            <Route path="/auth" element={<Auth />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/auth/reset-password" element={<AuthCallback />} />

            {/* Team Invitation Route (no layout) */}
            <Route path="/invite/:token" element={
              <Suspense fallback={<PageLoading />}>
                <TeamInvitation />
              </Suspense>
            } />

            <Route path="*" element={<NotFound />} />

            {/* Protected Routes - Require Authentication */}
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
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
                <Route path="/features" element={
                  <Suspense fallback={<PageLoading />}>
                    <FeaturesPage />
                  </Suspense>
                } />
                <Route path="/teams" element={
                  <Suspense fallback={<PageLoading />}>
                    <TeamManagement />
                  </Suspense>
                } />
                <Route path="/claims" element={
                  <Suspense fallback={<PageLoading />}>
                    <ClaimsManagement />
                  </Suspense>
                } />
                <Route path="/test/claims-receipt-integration" element={
                  <Suspense fallback={<PageLoading />}>
                    <ClaimsReceiptIntegrationTest />
                  </Suspense>
                } />
                <Route path="/test/invitation" element={
                  <Suspense fallback={<PageLoading />}>
                    <TestInvitation />
                  </Suspense>
                } />
                <Route path="/test/invitation-acceptance" element={
                  <Suspense fallback={<PageLoading />}>
                    <TestInvitationAcceptance />
                  </Suspense>
                } />
                <Route path="/test/production-invitation-debug" element={
                  <Suspense fallback={<PageLoading />}>
                    <ProductionInvitationDebug />
                  </Suspense>
                } />
              </Route>
            </Route>

            {/* Admin Routes - Require Admin Role */}
            <Route element={<AdminRoute />}>
              <Route path="/admin" element={<AdminLayoutPage />}>
                <Route index element={<AdminDashboard />} />
                <Route path="users" element={<UsersManagement />} />
                <Route path="receipts" element={<ReceiptsManagement />} />
                <Route path="analytics" element={<AnalyticsPage />} />
                <Route path="blog" element={<BlogManagement />} />
                <Route path="settings" element={<AdminSettingsPage />} />
              </Route>
            </Route>
          </Routes>
          </BrowserRouter>
              </TooltipProvider>
            </ChatControlsProvider>
          </StripeProvider>
        </TeamProvider>
      </AuthProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
