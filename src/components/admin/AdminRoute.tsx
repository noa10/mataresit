
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Spinner } from "@/components/ui/spinner"; // Assuming you have a spinner component
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";

export default function AdminRoute() {
  const { user, loading, isAdmin } = useAuth();
  const location = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    if (user && !loading && !isAdmin) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to access this area",
        variant: "destructive",
      });
    }
  }, [user, loading, isAdmin, toast]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
