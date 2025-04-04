
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Suspense, lazy, useEffect } from "react";
import { AuthProvider } from "@/contexts/AuthContext";
import { initializeTheme } from "@/lib/theme";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";

// Lazy load other pages for better performance
const ViewReceipt = lazy(() => import("./pages/ViewReceipt"));
const Profile = lazy(() => import("./pages/Profile"));

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

const App = () => {
  // Initialize theme on app load
  useEffect(() => {
    initializeTheme();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="*" element={<NotFound />} />
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
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
