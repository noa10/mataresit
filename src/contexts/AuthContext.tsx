
import { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AppRole, UserWithRole } from "@/types/auth";

type AuthContextType = {
  user: UserWithRole | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserWithRole | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const { toast } = useToast();

  // Fetch user roles
  const fetchUserRoles = async (userId: string) => {
    try {
      // Using raw SQL query to avoid type issues with the newly created table
      const { data, error } = await supabase
        .rpc('has_role', { _user_id: userId, _role: 'admin' });

      if (error) {
        console.error('Error fetching user roles:', error);
        return [];
      }

      return data ? ['admin'] : ['user'] as AppRole[];
    } catch (error) {
      console.error('Error in fetchUserRoles:', error);
      return [];
    }
  };

  // Update user state with roles
  const updateUserWithRoles = async (currentUser: User | null, currentSession: Session | null) => {
    if (!currentUser) {
      setUser(null);
      setIsAdmin(false);
      return;
    }

    try {
      const roles = await fetchUserRoles(currentUser.id);
      const userWithRole: UserWithRole = {
        ...currentUser,
        roles
      };

      setUser(userWithRole);
      setIsAdmin(roles.includes('admin'));
    } catch (error) {
      console.error('Error updating user with roles:', error);
      setUser(currentUser as UserWithRole);
      setIsAdmin(false);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        setSession(newSession);

        // Handle password recovery event
        if (event === 'PASSWORD_RECOVERY') {
          toast({
            title: "Reset your password",
            description: "You can now set a new password",
          });
        }

        // Use setTimeout to avoid auth deadlock issues
        setTimeout(() => {
          updateUserWithRoles(newSession?.user ?? null, newSession);
        }, 0);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      updateUserWithRoles(currentSession?.user ?? null, currentSession);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string) => {
    try {
      // Get the appropriate redirect URL for the current environment
      const redirectUrl = getRedirectUrl();

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
        },
      });
      if (error) throw error;
      toast({
        title: "Account created",
        description: "Please check your email for verification.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to sign up",
        variant: "destructive",
      });
      throw error;
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast({
        title: "Welcome back!",
        description: "You have successfully signed in",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to sign in",
        variant: "destructive",
      });
      throw error;
    }
  };

  const signInWithGoogle = async () => {
    try {
      // Get the appropriate redirect URL for the current environment
      const redirectUrl = getRedirectUrl();

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
        },
      });
      if (error) throw error;
      // No toast here as the user will be redirected to Google
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to sign in with Google",
        variant: "destructive",
      });
      throw error;
    }
  };

  /**
   * Get the appropriate redirect URL based on the current environment
   * This ensures that auth redirects work correctly in both development and production
   */
  const getRedirectUrl = (path: string = '/auth'): string => {
    // Make sure path starts with a slash
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;

    // Get the base URL (origin) of the current environment
    const baseUrl = window.location.origin;

    // Construct the full redirect URL
    const redirectUrl = `${baseUrl}${normalizedPath}`;

    console.log(`Using redirect URL: ${redirectUrl}`);
    return redirectUrl;
  };

  const resetPassword = async (email: string) => {
    try {
      // Get the appropriate redirect URL for the current environment
      const redirectUrl = getRedirectUrl('/auth');

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });

      if (error) throw error;
      toast({
        title: "Password reset email sent",
        description: "Check your email for a password reset link. Make sure to check your spam folder if you don't see it.",
      });
    } catch (error: any) {
      console.error("Reset password error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to send password reset email",
        variant: "destructive",
      });
      throw error;
    }
  };

  const updatePassword = async (password: string) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password,
      });
      if (error) throw error;
      toast({
        title: "Password updated",
        description: "Your password has been updated successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update password",
        variant: "destructive",
      });
      throw error;
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      toast({
        title: "Signed out",
        description: "You have been signed out successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to sign out",
        variant: "destructive",
      });
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        isAdmin,
        signUp,
        signIn,
        signInWithGoogle,
        resetPassword,
        updatePassword,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
