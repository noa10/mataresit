import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Suspense, lazy } from "react";
import { HelmetProvider } from "react-helmet-async";
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { AuthProvider } from "@/contexts/AuthContext";
import { StripeProvider } from "@/contexts/StripeContext";
import { ChatControlsProvider } from "@/contexts/ChatControlsContext";
import { TeamProvider } from "@/contexts/TeamContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { PersonalizationProvider } from "@/contexts/PersonalizationContext";
import { BackgroundSearchProvider } from "@/contexts/BackgroundSearchContext";
import { PushNotificationProvider } from "@/contexts/PushNotificationContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { searchCacheManager } from "@/services/searchCacheManager";
import { AppLayout } from "@/components/AppLayout";
import { PublicLayout } from "@/components/PublicLayout";
// Debug component disabled - uncomment to enable: import { MobileDebugInfo } from "@/components/debug/MobileDebugInfo";
import { CacheInvalidationService } from "@/services/cacheInvalidationService";
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
import AdminRoute from "./components/admin/AdminRoute";
import ProtectedRoute from "./components/auth/ProtectedRoute";

// Lazy load heavy components for better performance
const Dashboard = lazy(() => import("./pages/Dashboard"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const PerformanceTestPage = lazy(() => import("./pages/PerformanceTestPage"));
const AdminLayoutPage = lazy(() => import("./pages/admin/AdminLayout"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const UsersManagement = lazy(() => import("./pages/admin/UsersManagement"));
const ReceiptsManagement = lazy(() => import("./pages/admin/ReceiptsManagement"));
const AnalyticsPage = lazy(() => import("./pages/admin/AnalyticsPage"));
const EmbeddingMetricsPage = lazy(() => import("./pages/admin/EmbeddingMetricsPage"));
const AdminSettingsPage = lazy(() => import("./pages/admin/SettingsPage"));
const BlogManagement = lazy(() => import("./pages/admin/BlogManagement"));

// Lazy load other pages for better performance
const ViewReceipt = lazy(() => import("./pages/ViewReceipt"));
const Profile = lazy(() => import("./pages/Profile"));
const AnalysisPage = lazy(() => import("./pages/AnalysisPage"));
const SemanticSearch = lazy(() => import("./pages/SemanticSearch"));
const UnifiedSearchPage = lazy(() => import("./pages/UnifiedSearchPage"));
const FeaturesPage = lazy(() => import("./pages/FeaturesPage"));
const PricingPage = lazy(() => import("./pages/PricingPage"));
const PaymentSuccessPage = lazy(() => import("./pages/PaymentSuccessPage"));
const HelpCenter = lazy(() => import("./pages/HelpCenter"));
const DocumentationPage = lazy(() => import("./pages/DocumentationPage"));
const NewDocumentationPage = lazy(() => import("./pages/NewDocumentationPage"));
const GuideDetailPage = lazy(() => import("./pages/GuideDetailPage"));
const StatusPage = lazy(() => import("./pages/StatusPage"));
const BlogIndexPage = lazy(() => import("./pages/BlogIndexPage"));
const BlogPostPage = lazy(() => import("./pages/BlogPostPage"));
const TeamManagement = lazy(() => import("./pages/TeamManagement"));
const ClaimsManagement = lazy(() => import("./pages/ClaimsManagement"));
const ClaimDetailsPage = lazy(() => import("./pages/ClaimDetailsPage"));
const TeamInvitation = lazy(() => import("./pages/TeamInvitation"));
const UIComponentTest = lazy(() => import("./components/test/UIComponentTest"));
const CacheTest = lazy(() => import("./components/test/CacheTest"));
const PersonalizationIntegrationTest = lazy(() => import("./components/test/PersonalizationIntegrationTest").then(m => ({ default: m.PersonalizationIntegrationTest })));
const TestEnhancedSearch = lazy(() => import("./pages/TestEnhancedSearch").then(m => ({ default: m.TestEnhancedSearch })));
const PrivacyPolicyPage = lazy(() => import("./pages/PrivacyPolicyPage"));
const TermsConditionsPage = lazy(() => import("./pages/TermsConditionsPage"));
const ApiReferencePage = lazy(() => import("./pages/ApiReferencePage"));
const NotificationTestingPage = lazy(() => import("./pages/NotificationTestingPage").then(m => ({ default: m.NotificationTestingPage })));
const NotificationFilteringTestPage = lazy(() => import("./pages/NotificationFilteringTestPage").then(m => ({ default: m.NotificationFilteringTestPage })));
const BatchSessionServiceTestPage = lazy(() => import("./pages/BatchSessionServiceTestPage"));
const BatchUploadTestPage = lazy(() => import("./pages/BatchUploadTestPage"));
const ComponentFixTestPage = lazy(() => import("./pages/ComponentFixTestPage"));


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

// Initialize CacheInvalidationService with QueryClient
CacheInvalidationService.initialize(queryClient);

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider>
          <LanguageProvider>
            <TeamProvider>
              <StripeProvider>
                <PersonalizationProvider>
                  <BackgroundSearchProvider>
                    <ChatControlsProvider>
                      <NotificationProvider>
                        <PushNotificationProvider>
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
                  <NewDocumentationPage />
                </Suspense>
              } />
              <Route path="/docs/guide/:guideId" element={
                <Suspense fallback={<PageLoading />}>
                  <GuideDetailPage />
                </Suspense>
              } />
              <Route path="/docs/legacy" element={
                <Suspense fallback={<PageLoading />}>
                  <DocumentationPage />
                </Suspense>
              } />
              <Route path="/api-reference" element={
                <Suspense fallback={<PageLoading />}>
                  <ApiReferencePage />
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
              <Route path="/features" element={
                <Suspense fallback={<PageLoading />}>
                  <FeaturesPage />
                </Suspense>
              } />
              <Route path="/privacy-policy" element={
                <Suspense fallback={<PageLoading />}>
                  <PrivacyPolicyPage />
                </Suspense>
              } />
              <Route path="/terms-conditions" element={
                <Suspense fallback={<PageLoading />}>
                  <TermsConditionsPage />
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
                <Route path="/dashboard" element={
                  <Suspense fallback={<PageLoading />}>
                    <Dashboard />
                  </Suspense>
                } />
                <Route path="/upload" element={<Navigate to="/dashboard" replace />} />
                <Route path="/settings" element={
                  <Suspense fallback={<PageLoading />}>
                    <SettingsPage />
                  </Suspense>
                } />
                <Route path="/account/billing" element={<Navigate to="/settings?tab=billing" replace />} />
                <Route path="/performance-test" element={
                  <Suspense fallback={<PageLoading />}>
                    <PerformanceTestPage />
                  </Suspense>
                } />
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
                <Route path="/unified-search" element={
                  <Suspense fallback={<PageLoading />}>
                    <UnifiedSearchPage />
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
                <Route path="/claims/:claimId" element={
                  <Suspense fallback={<PageLoading />}>
                    <ClaimDetailsPage />
                  </Suspense>
                } />
                <Route path="/test/ui-components" element={
                  <Suspense fallback={<PageLoading />}>
                    <UIComponentTest />
                  </Suspense>
                } />
                <Route path="/test/cache" element={
                  <Suspense fallback={<PageLoading />}>
                    <CacheTest />
                  </Suspense>
                } />
                <Route path="/test/integration" element={
                  <Suspense fallback={<PageLoading />}>
                    <PersonalizationIntegrationTest />
                  </Suspense>
                } />
                <Route path="/test/notifications" element={
                  <Suspense fallback={<PageLoading />}>
                    <NotificationTestingPage />
                  </Suspense>
                } />
                <Route path="/test/notification-filtering" element={
                  <Suspense fallback={<PageLoading />}>
                    <NotificationFilteringTestPage />
                  </Suspense>
                } />

                <Route path="/test/enhanced-search" element={
                  <Suspense fallback={<PageLoading />}>
                    <TestEnhancedSearch />
                  </Suspense>
                } />
                <Route path="/test/batch-session-service" element={
                  <Suspense fallback={<PageLoading />}>
                    <BatchSessionServiceTestPage />
                  </Suspense>
                } />
                <Route path="/test/batch-upload" element={
                  <Suspense fallback={<PageLoading />}>
                    <BatchUploadTestPage />
                  </Suspense>
                } />
                <Route path="/test/component-fixes" element={
                  <Suspense fallback={<PageLoading />}>
                    <ComponentFixTestPage />
                  </Suspense>
                } />

              </Route>
            </Route>

            {/* Admin Routes - Require Admin Role */}
            <Route element={<AdminRoute />}>
              <Route path="/admin" element={
                <Suspense fallback={<PageLoading />}>
                  <AdminLayoutPage />
                </Suspense>
              }>
                <Route index element={
                  <Suspense fallback={<PageLoading />}>
                    <AdminDashboard />
                  </Suspense>
                } />
                <Route path="users" element={
                  <Suspense fallback={<PageLoading />}>
                    <UsersManagement />
                  </Suspense>
                } />
                <Route path="receipts" element={
                  <Suspense fallback={<PageLoading />}>
                    <ReceiptsManagement />
                  </Suspense>
                } />
                <Route path="analytics" element={
                  <Suspense fallback={<PageLoading />}>
                    <AnalyticsPage />
                  </Suspense>
                } />
                <Route path="embedding-metrics" element={
                  <Suspense fallback={<PageLoading />}>
                    <EmbeddingMetricsPage />
                  </Suspense>
                } />
                <Route path="blog" element={
                  <Suspense fallback={<PageLoading />}>
                    <BlogManagement />
                  </Suspense>
                } />
                <Route path="settings" element={
                  <Suspense fallback={<PageLoading />}>
                    <AdminSettingsPage />
                  </Suspense>
                } />
              </Route>
            </Route>
          </Routes>
          </BrowserRouter>
                      </TooltipProvider>
                    </PushNotificationProvider>
                  </NotificationProvider>
                </ChatControlsProvider>
                </BackgroundSearchProvider>
              </PersonalizationProvider>
            </StripeProvider>
          </TeamProvider>
        </LanguageProvider>
      </ThemeProvider>
    </AuthProvider>
    </QueryClientProvider>
    <Analytics />
    <SpeedInsights />
  </HelmetProvider>
);

export default App;