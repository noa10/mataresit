
import { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { AppRole, UserWithRole, AuthState } from "@/types/auth";
import { invitationFlowService } from "@/services/invitationFlowService";

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
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserWithRole | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const { toast } = useToast();

  // Process pending invitations after authentication
  const processPendingInvitation = async (userId: string) => {
    try {
      const pendingInvitationData = localStorage.getItem('pending_invitation');
      if (!pendingInvitationData) {
        return;
      }

      const pendingInvitation = JSON.parse(pendingInvitationData);
      const { token, teamId, teamName, sessionId } = pendingInvitation;

      if (!token) {
        console.warn('No invitation token found in pending invitation data');
        localStorage.removeItem('pending_invitation');
        return;
      }

      console.log('Processing pending invitation for user:', userId);

      // Process the invitation acceptance
      const result = await invitationFlowService.processPostAuthInvitation(
        token,
        userId,
        'existing_session', // User just authenticated
        invitationFlowService.generateBrowserFingerprint()
      );

      if (result.success) {
        const { team_name, redirect_url } = result.data!;

        toast({
          title: 'Welcome to the Team!',
          description: `You've successfully joined ${team_name}.`,
          duration: 5000,
        });

        // Clear the pending invitation
        localStorage.removeItem('pending_invitation');

        // Redirect to the team or specified URL after a short delay
        setTimeout(() => {
          window.location.href = redirect_url || '/teams';
        }, 2000);
      } else {
        console.error('Failed to process pending invitation:', result.error);
        toast({
          title: 'Invitation Processing Failed',
          description: result.error || 'Failed to join team. Please try accepting the invitation again.',
          variant: 'destructive',
        });
        localStorage.removeItem('pending_invitation');
      }
    } catch (error) {
      console.error('Error processing pending invitation:', error);
      toast({
        title: 'Invitation Processing Error',
        description: 'An error occurred while processing your team invitation.',
        variant: 'destructive',
      });
      localStorage.removeItem('pending_invitation');
    }
  };

  // Fetch user roles
  const fetchUserRoles = async (userId: string) => {
    try {
      // Using RPC function to check if user has admin role
      const { data, error } = await supabase.rpc('has_role', {
        _user_id: userId,
        _role: 'admin'
      });

      if (error) {
        console.error('Error fetching user roles:', error);
        return [];
      }

      // If has_role returns true, user is admin, otherwise regular user
      const roles: AppRole[] = data ? ['admin'] : ['user'];
      return roles;
    } catch (error) {
      console.error('Error in fetchUserRoles:', error);
      return ['user'] as AppRole[];
    }
  };

  // Update user state with roles
  const updateUserWithRoles = async (currentUser: User | null, currentSession: Session | null, shouldSetLoading: boolean = false) => {
    if (!currentUser) {
      setUser(null);
      setIsAdmin(false);
      if (shouldSetLoading) setLoading(false);
      return;
    }

    try {
      const roles = await fetchUserRoles(currentUser.id);

      // Fetch subscription data from profiles table
      const { data: profile } = await supabase
        .from('profiles')
        .select(`
          subscription_tier,
          subscription_status,
          stripe_customer_id,
          stripe_subscription_id,
          receipts_used_this_month,
          avatar_url,
          google_avatar_url,
          first_name,
          last_name
        `)
        .eq('id', currentUser.id)
        .single();

      const userWithRole: UserWithRole = {
        ...currentUser,
        roles,
        subscription_tier: profile?.subscription_tier || 'free',
        subscription_status: profile?.subscription_status || 'active',
        stripe_customer_id: profile?.stripe_customer_id,
        stripe_subscription_id: profile?.stripe_subscription_id,
        receipts_used_this_month: profile?.receipts_used_this_month || 0,
        avatar_url: profile?.avatar_url,
        google_avatar_url: profile?.google_avatar_url,
        first_name: profile?.first_name,
        last_name: profile?.last_name,
      };

      setUser(userWithRole);
      setIsAdmin(roles.includes('admin'));

      // Process pending invitation if user just authenticated
      if (currentSession && !shouldSetLoading) {
        // Only process invitations for new sessions, not initial session checks
        await processPendingInvitation(currentUser.id);
      }
    } catch (error) {
      console.error('Error updating user with roles:', error);
      setUser({...currentUser, roles: ['user'], subscription_tier: 'free'} as UserWithRole);
      setIsAdmin(false);
    } finally {
      if (shouldSetLoading) setLoading(false);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        console.log(`AuthContext: onAuthStateChange event: ${event}, session present: ${!!newSession}`);
        setSession(newSession);

        // Handle password recovery event
        if (event === 'PASSWORD_RECOVERY') {
          console.log("AuthContext: PASSWORD_RECOVERY event detected.");
          toast({
            title: "Password Recovery Initiated",
            description: "You can now set a new password for this recovery session.",
          });
          // Do not clear the hash here.
          // Auth.tsx's onResetPasswordSubmit needs it to potentially call setSession and then updatePassword.
          // It will be cleared by Auth.tsx after successful password update.
        } else if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
          console.log(`AuthContext: ${event} event detected.`);
          if (newSession) { // Only clear if a session is truly established
            const currentHash = window.location.hash;
            // Only clear non-recovery auth-related hashes.
            // Recovery hashes (containing type=recovery) are handled by Auth.tsx.
            if ( (currentHash.includes('access_token=') || currentHash.includes('error=')) &&
                 !currentHash.includes('type=recovery') ) {
              console.log(`AuthContext: Non-recovery auth-related hash (${currentHash}) detected on ${event}. Clearing.`);
              window.history.replaceState(null, '', window.location.pathname + window.location.search);
            }
          }
        }

        // Use setTimeout to avoid auth deadlock issues
        setTimeout(() => {
          updateUserWithRoles(newSession?.user ?? null, newSession);
        }, 0);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      console.log(`AuthContext: Initial session check, session present: ${!!currentSession}`);
      setSession(currentSession);
      // Pass true to indicate this should set loading=false when complete
      updateUserWithRoles(currentSession?.user ?? null, currentSession, true);
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

    // Check if we're in a production environment (mataresit.co or vercel.app)
    const isProduction = window.location.hostname.includes('mataresit.co') || window.location.hostname.includes('vercel.app');

    // For production deployments, use the production URL to ensure consistency
    if (isProduction) {
      const productionUrl = 'https://mataresit.co';
      const redirectUrl = `${productionUrl}${normalizedPath}`;
      console.log(`Using production redirect URL: ${redirectUrl}`);
      return redirectUrl;
    }

    // For local development, use the current origin
    const baseUrl = window.location.origin;
    const redirectUrl = `${baseUrl}${normalizedPath}`;
    console.log(`Using local redirect URL: ${redirectUrl}`);
    return redirectUrl;
  };

  const resetPassword = async (email: string) => {
    try {
      // Use the getRedirectUrl function to ensure consistency with other auth methods
      const redirectUrl = getRedirectUrl('/auth'); // Or your specific password update page
      console.log(`Sending password reset email with redirect URL: ${redirectUrl}`);

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
        // This function is intended for an already authenticated user changing their password,
        // NOT for the password recovery flow handled by Auth.tsx's onResetPasswordSubmit.
        password,
      });
      if (error) {
        console.error("AuthContext - updateUser error before throw:", error);
        throw error;
      }
      console.log("AuthContext: supabase.auth.updateUser Succeeded.");
      toast({
        title: "Password updated",
        description: "Your password has been updated successfully",
      });

      // Clear the recovery hash from the URL to prevent re-triggering recovery mode
      // This is a safeguard; typically, for standard updates, no recovery hash would be present.
      if (window.location.hash.includes('type=recovery')) {
        console.log("AuthContext: Recovery hash found in updatePassword. Clearing.");
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }

      // Consider navigating the user away (e.g., to login or dashboard)
      // This is best handled by the calling UI component using a router.

    } catch (error: any) {
      console.error("AuthContext - Update password catch block:", error);
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

  const refreshUser = async () => {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (currentSession?.user) {
      await updateUserWithRoles(currentSession.user, currentSession);
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
        refreshUser,
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
