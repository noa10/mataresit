import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

/**
 * This component is a special handler for auth callbacks, particularly for password reset flows.
 * It's designed to handle the redirect from Supabase auth flows and ensure the user gets to
 * the right place with the right state.
 */
export default function AuthCallback() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        console.log("AuthCallback: Processing auth callback");
        
        // Get the current URL and its parameters
        const url = new URL(window.location.href);
        const hash = window.location.hash;
        const type = url.searchParams.get('type');
        const accessToken = hash && hash.includes('access_token') 
          ? hash.match(/access_token=([^&]*)/)?.[1] 
          : null;
        
        console.log("AuthCallback: URL params:", { 
          type, 
          hash: hash ? "Present" : "None",
          accessToken: accessToken ? "Present" : "None" 
        });

        // If this is a recovery flow, we need to handle it specially
        if (type === 'recovery' || (accessToken && hash.includes('type=recovery'))) {
          console.log("AuthCallback: Detected password recovery flow");
          
          // Redirect to the auth page with the hash intact
          window.location.href = `/auth${hash}`;
          return;
        }
        
        // For other auth flows, just redirect to the auth page
        setIsLoading(false);
      } catch (err) {
        console.error("AuthCallback error:", err);
        setError("An error occurred during authentication. Please try again.");
        setIsLoading(false);
        
        toast({
          title: "Authentication Error",
          description: "There was a problem processing your authentication. Please try again.",
          variant: "destructive",
        });
      }
    };

    handleAuthCallback();
  }, [toast]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-lg">Processing authentication...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md p-6 bg-destructive/10 rounded-lg">
          <h2 className="text-xl font-bold text-destructive mb-2">Authentication Error</h2>
          <p>{error}</p>
          <button
            onClick={() => window.location.href = '/auth'}
            className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
          >
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  // Default redirect to auth page
  return <Navigate to="/auth" replace />;
}
