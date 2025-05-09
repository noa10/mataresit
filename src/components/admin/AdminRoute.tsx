
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";

export default function AdminRoute() {
  const { user, loading, isAdmin } = useAuth();
  const location = useLocation();
  const { toast } = useToast();
  const [hasShownToast, setHasShownToast] = useState(false);

  // Only show the access denied toast once the loading is complete
  // and we're certain the user doesn't have admin privileges
  useEffect(() => {
    // Only show toast if:
    // 1. Loading is complete (not in initial loading state)
    // 2. User is authenticated but not an admin
    // 3. We haven't shown the toast yet in this component lifecycle
    if (user && !loading && !isAdmin && !hasShownToast) {
      console.log("AdminRoute: Access denied, showing toast");
      toast({
        title: "Access Denied",
        description: "You don't have permission to access this area",
        variant: "destructive",
      });
      setHasShownToast(true);
    }
  }, [user, loading, isAdmin, toast, hasShownToast]);

  // Reset the toast flag if the user becomes an admin
  useEffect(() => {
    if (isAdmin && hasShownToast) {
      setHasShownToast(false);
    }
  }, [isAdmin, hasShownToast]);

  // Show loading indicator while authentication state is being determined
  if (loading) {
    console.log("AdminRoute: Authentication loading, showing spinner");
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    console.log("AdminRoute: User not authenticated, redirecting to auth page");
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Redirect to dashboard if authenticated but not an admin
  if (!isAdmin) {
    console.log("AdminRoute: User not an admin, redirecting to dashboard");
    return <Navigate to="/dashboard" replace />;
  }

  // User is authenticated and is an admin, render the admin content
  console.log("AdminRoute: User is admin, rendering admin content");
  return <Outlet />;
}
