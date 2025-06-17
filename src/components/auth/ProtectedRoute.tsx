import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useAuthTranslation } from "@/contexts/LanguageContext";
import { useEffect, useState } from "react";

export default function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const { toast } = useToast();
  const { t } = useAuthTranslation();
  const [hasShownToast, setHasShownToast] = useState(false);

  // Only show the toast notification once the loading is complete
  // and we're certain the user is not authenticated
  useEffect(() => {
    // Only show toast if:
    // 1. Loading is complete (not in initial loading state)
    // 2. User is not authenticated
    // 3. We haven't shown the toast yet in this component lifecycle
    if (!user && !loading && !hasShownToast) {
      console.log("ProtectedRoute: Authentication required, showing toast");
      toast({
        title: t("errors.authRequired"),
        description: t("errors.authRequiredDescription"),
        variant: "destructive",
      });
      setHasShownToast(true);
    }
  }, [user, loading, toast, hasShownToast]);

  // Reset the toast flag if the user becomes authenticated
  useEffect(() => {
    if (user && hasShownToast) {
      setHasShownToast(false);
    }
  }, [user, hasShownToast]);

  // Show loading indicator while authentication state is being determined
  if (loading) {
    console.log("ProtectedRoute: Authentication loading, showing spinner");
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    console.log("ProtectedRoute: User not authenticated, redirecting to auth page");
    // Save the current location to redirect back after login
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // User is authenticated, render the protected content
  console.log("ProtectedRoute: User authenticated, rendering protected content");
  return <Outlet />;
}
