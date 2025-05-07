
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const signupSchema = loginSchema.extend({
  confirmPassword: z.string().min(6, "Password must be at least 6 characters"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

const resetPasswordSchema = z.object({
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(6, "Password must be at least 6 characters"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type LoginFormValues = z.infer<typeof loginSchema>;
type SignupFormValues = z.infer<typeof signupSchema>;
type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;
type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

export default function Auth() {
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [isPasswordResetSent, setIsPasswordResetSent] = useState(false);
  const [isRecoverySession, setIsRecoverySession] = useState(false);
  const { user, signIn, signUp, signInWithGoogle, resetPassword, updatePassword } = useAuth();
  const [activeTab, setActiveTab] = useState<"login" | "signup">("login");
  const location = useLocation();
  const { toast } = useToast();

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const signupForm = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const forgotPasswordForm = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const resetPasswordForm = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  // Function to check for recovery mode
  const checkForRecoveryMode = async () => {
    try {
      console.log("Checking for recovery mode...");

      // Check URL parameters for recovery indicators
      const url = new URL(window.location.href);
      const type = url.searchParams.get('type');
      const token = url.searchParams.get('token');
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');
      const error_description = url.searchParams.get('error_description');

      // Check for hash fragments (access_token, etc.)
      const hash = window.location.hash;
      console.log("URL hash:", hash ? "Present" : "None");

      // If we have a hash that contains access_token, this might be from a password reset
      if (hash && hash.includes('access_token')) {
        console.log("Found access_token in URL hash, likely from password reset flow");

        // Check if we have both access_token and refresh_token
        const accessToken = hash.match(/access_token=([^&]*)/)?.[1];
        const refreshToken = hash.match(/refresh_token=([^&]*)/)?.[1];

        if (accessToken && refreshToken) {
          console.log("Found both access_token and refresh_token in hash");
          setIsRecoverySession(true);
          setIsResetPasswordOpen(true);

          // Show a toast to guide the user
          toast({
            title: "Password Reset",
            description: "Please set a new password for your account.",
          });

          // We don't clean up the URL here as it might break the auth flow
          return true;
        } else {
          console.warn("Found access_token but missing refresh_token in hash");
        }
      }

      console.log("URL params:", {
        type,
        token: token?.substring(0, 5) + "..." || "None",
        code: code?.substring(0, 5) + "..." || "None",
        error,
        error_description
      });

      // If there's an error in the URL, show it to the user
      if (error || error_description) {
        console.error("Auth error from URL:", error, error_description);
        toast({
          title: "Authentication Error",
          description: error_description || "There was an error processing your request. Please try again.",
          variant: "destructive",
        });

        // Clean up URL - keep the base path
        const basePath = window.location.pathname.split('?')[0];
        window.history.replaceState({}, document.title, basePath);
      }

      // If recovery indicators are present, set recovery mode
      if (type === 'recovery' || (token && type === 'recovery')) {
        console.log("Recovery indicators found in URL");
        setIsRecoverySession(true);
        setIsResetPasswordOpen(true);

        // Show a toast to guide the user
        toast({
          title: "Password Reset",
          description: "Please set a new password for your account.",
        });

        // Clean up URL params but keep the hash - it might contain tokens we need
        const basePath = window.location.pathname;
        window.history.replaceState({}, document.title, basePath + window.location.hash);
        return true;
      }

      // Get the current session
      const { data: { session } } = await supabase.auth.getSession();

      // Check if we have a session
      if (session) {
        console.log("Session found, checking for recovery context");

        // If we have a session but no recovery indicators in the URL,
        // check if the session was created for recovery
        const accessToken = session.access_token;
        if (accessToken && !type) {
          // This is a heuristic - if we have a session but no clear indication
          // of why, and the user just arrived, it might be from a recovery link
          const justArrived = document.referrer !== window.location.href;
          if (justArrived) {
            console.log("User just arrived with a session, might be from recovery link");
            setIsRecoverySession(true);
            setIsResetPasswordOpen(true);

            toast({
              title: "Password Reset",
              description: "It looks like you clicked a password reset link. Please set a new password for your account.",
            });
            return true;
          }
        }
      }

      return false;
    } catch (error) {
      console.error("Error checking for recovery mode:", error);
      return false;
    }
  };

  // Listen for auth state changes
  useEffect(() => {
    // Check for hash fragment in URL first
    const hash = window.location.hash;
    if (hash && hash.includes('access_token')) {
      console.log("Found access_token in URL hash on initial load");

      // Extract both tokens from the hash
      const accessToken = hash.match(/access_token=([^&]*)/)?.[1];
      const refreshToken = hash.match(/refresh_token=([^&]*)/)?.[1];

      if (accessToken && refreshToken) {
        console.log("Successfully extracted access_token and refresh_token from hash");

        // This is likely a password reset flow
        setIsRecoverySession(true);
        setIsResetPasswordOpen(true);

        toast({
          title: "Password Reset",
          description: "Please set a new password for your account.",
        });
      } else {
        console.warn("Found access_token but missing refresh_token in hash on initial load");
        // Still try the normal check as a fallback
        checkForRecoveryMode();
      }
    } else {
      // If no hash with access token, run the normal check
      checkForRecoveryMode();
    }

    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Auth state change event:", event, "Session:", session ? "exists" : "null");

      if (event === 'PASSWORD_RECOVERY') {
        console.log("PASSWORD_RECOVERY event detected");
        setIsRecoverySession(true);
        setIsResetPasswordOpen(true);

        // Show a toast to guide the user
        toast({
          title: "Password Reset",
          description: "Please set a new password for your account.",
        });
      }

      // For SIGNED_IN events, check if it's from a recovery flow
      if (event === 'SIGNED_IN') {
        // Check URL parameters for recovery indicators
        const url = new URL(window.location.href);
        const type = url.searchParams.get('type');

        // Also check for hash fragment which might indicate a password reset flow
        const hash = window.location.hash;
        const accessToken = hash.match(/access_token=([^&]*)/)?.[1];
        const refreshToken = hash.match(/refresh_token=([^&]*)/)?.[1];
        const isHashRecovery = hash && accessToken && refreshToken;

        if (type === 'recovery' || isHashRecovery) {
          console.log("Recovery sign-in detected");
          setIsRecoverySession(true);
          setIsResetPasswordOpen(true);

          // We don't clean up the URL here as it might break the auth flow
          // Only clean up query parameters, not hash
          if (type === 'recovery' && !isHashRecovery) {
            const basePath = window.location.pathname.split('?')[0];
            window.history.replaceState({}, document.title, basePath + window.location.hash);
          }

          // Show a toast to guide the user
          toast({
            title: "Password Reset",
            description: "Please set a new password for your account.",
          });
        } else {
          // If we just signed in but it's not clearly from recovery,
          // check if we should be in recovery mode
          checkForRecoveryMode();
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [toast]);

  const onLoginSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    try {
      await signIn(data.email, data.password);
    } finally {
      setIsLoading(false);
    }
  };

  const onSignupSubmit = async (data: SignupFormValues) => {
    setIsLoading(true);
    try {
      await signUp(data.email, data.password);
      setActiveTab("login");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error("Google sign-in error:", error);
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const onForgotPasswordSubmit = async (data: ForgotPasswordFormValues) => {
    setIsLoading(true);
    try {
      await resetPassword(data.email);
      setIsPasswordResetSent(true);
      // Keep the dialog open to show success message
    } catch (error) {
      console.error("Password reset error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // This method is only used during the password recovery flow
  const onResetPasswordSubmit = async (data: ResetPasswordFormValues) => {
    setIsLoading(true);
    try {
      console.log("Updating password during recovery flow...");

      let sessionToUse = null;
      const { data: existingSessionData } = await supabase.auth.getSession();
      sessionToUse = existingSessionData.session;

      if (!sessionToUse) {
        console.warn("No active session found by getSession(). Attempting to set session manually from URL hash.");
        const hash = window.location.hash;
        const accessToken = hash.match(/access_token=([^&]*)/)?.[1];
        const refreshToken = hash.match(/refresh_token=([^&]*)/)?.[1]; // Extract refresh_token

        if (accessToken && refreshToken) {
          console.log("Found access_token and refresh_token in hash. Attempting supabase.auth.setSession().");
          const { data: manualSessionData, error: setError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (setError) {
            console.error("Error manually setting session:", setError);
            toast({
              title: "Session Error",
              description: `Failed to establish session for password reset: ${setError.message}. Please try the recovery link again.`,
              variant: "destructive",
            });
            setIsLoading(false);
            return; // Stop execution if session cannot be set
          }
          console.log("Manual session set successfully.");
          sessionToUse = manualSessionData.session; // Use the newly set session

          if (!sessionToUse) {
            console.error("Session still null after attempting manual setSession.");
            toast({
              title: "Session Error",
              description: "Could not verify session after manual setup. Please try again.",
              variant: "destructive",
            });
            setIsLoading(false);
            return;
          }
        } else {
          console.error("Access token or refresh token missing in hash. Cannot manually set session.");
          toast({
            title: "Recovery Error",
            description: "Incomplete recovery information in URL. Please use the link from your email again.",
            variant: "destructive",
          });
          setIsLoading(false);
          return; // Stop execution
        }
      } else {
        console.log("Active session found via getSession().");
      }

      // At this point, sessionToUse should be valid either from getSession() or manual setSession()
      console.log("Proceeding with password update...");
      const { data: updateData, error: updateError } = await supabase.auth.updateUser({
        password: data.password
      });

      if (updateError) {
        console.error("Supabase updateUser error:", updateError);
        throw updateError;
      }

      console.log("Password update successful:", updateData ? "User updated" : "No update data returned");

      // Reset the recovery session state
      setIsRecoverySession(false);
      setIsResetPasswordOpen(false);
      resetPasswordForm.reset();

      // Show success message
      toast({
        title: "Password updated",
        description: "Your password has been updated successfully. You will be signed out and can now log in with your new password.",
      });

      // Clean the hash from the URL as it's no longer needed and contains sensitive tokens
      window.history.replaceState(null, '', window.location.pathname + window.location.search);

      // Sign out the user to make them log in with the new password
      await supabase.auth.signOut();

      // Redirect to login page
      window.location.href = '/auth';

    } catch (error: any) {
      console.error("Password update error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update password. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Additional check on mount for recovery parameters
  useEffect(() => {
    // This is a backup check in case the first one didn't catch it
    if (!isRecoverySession && !isResetPasswordOpen) {
      checkForRecoveryMode();
    }
  }, [isRecoverySession, isResetPasswordOpen]);

  // Redirect if user is already logged in (but not in recovery mode)
  if (user && !isRecoverySession && !isResetPasswordOpen) {
    // Redirect to the page they were trying to access, or dashboard as fallback
    const from = location.state?.from?.pathname || "/dashboard";
    return <Navigate to={from} replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/30">
      <Navbar />
      <main className="container px-4 py-8 max-w-md mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-6 md:p-8"
        >
          <h1 className="text-2xl font-bold text-center mb-6">Welcome to ReceiptScan</h1>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "login" | "signup")}>
            <TabsList className="grid grid-cols-2 mb-6">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <Form {...loginForm}>
                <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                  <FormField
                    control={loginForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input placeholder="your@email.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={loginForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="••••••••" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Logging in
                      </>
                    ) : (
                      "Log in"
                    )}
                  </Button>

                  <div className="flex justify-end items-center mt-2 text-xs text-muted-foreground">
                    <Button
                      variant="link"
                      className="p-0 h-auto text-xs text-muted-foreground"
                      type="button"
                      onClick={() => {
                        setIsForgotPasswordOpen(true);
                        setIsPasswordResetSent(false);
                        forgotPasswordForm.reset();
                      }}
                    >
                      Forgot password?
                    </Button>
                  </div>
                </form>
              </Form>

              <div className="mt-6">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <Separator className="w-full" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      Or continue with
                    </span>
                  </div>
                </div>

                <Button
                  variant="outline"
                  type="button"
                  disabled={isGoogleLoading}
                  className="w-full mt-4"
                  onClick={handleGoogleSignIn}
                >
                  {isGoogleLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        fill="#4285F4"
                      />
                      <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                      />
                      <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        fill="#EA4335"
                      />
                      <path d="M1 1h22v22H1z" fill="none" />
                    </svg>
                  )}
                  Google
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="signup">
              <Form {...signupForm}>
                <form onSubmit={signupForm.handleSubmit(onSignupSubmit)} className="space-y-4">
                  <FormField
                    control={signupForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input placeholder="your@email.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={signupForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="••••••••" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={signupForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm Password</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="••••••••" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating account
                      </>
                    ) : (
                      "Create account"
                    )}
                  </Button>
                </form>
              </Form>

              <div className="mt-6">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <Separator className="w-full" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      Or continue with
                    </span>
                  </div>
                </div>

                <Button
                  variant="outline"
                  type="button"
                  disabled={isGoogleLoading}
                  className="w-full mt-4"
                  onClick={handleGoogleSignIn}
                >
                  {isGoogleLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        fill="#4285F4"
                      />
                      <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                      />
                      <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        fill="#EA4335"
                      />
                      <path d="M1 1h22v22H1z" fill="none" />
                    </svg>
                  )}
                  Google
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </motion.div>
      </main>

      {/* Forgot Password Dialog */}
      <Dialog open={isForgotPasswordOpen} onOpenChange={setIsForgotPasswordOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isPasswordResetSent ? "Email Sent" : "Forgot Password"}</DialogTitle>
            <DialogDescription>
              {isPasswordResetSent
                ? "Check your email for a password reset link."
                : "Enter your email address and we'll send you a link to reset your password."}
            </DialogDescription>
          </DialogHeader>

          {!isPasswordResetSent ? (
            <Form {...forgotPasswordForm}>
              <form onSubmit={forgotPasswordForm.handleSubmit(onForgotPasswordSubmit)} className="space-y-4">
                <FormField
                  control={forgotPasswordForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="your@email.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsForgotPasswordOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      "Send Reset Link"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          ) : (
            <DialogFooter>
              <Button
                type="button"
                onClick={() => setIsForgotPasswordOpen(false)}
                className="w-full"
              >
                Close
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog - Only shown during recovery flow */}
      <Dialog
        open={isResetPasswordOpen}
        onOpenChange={(open) => {
          // Only allow closing if not in recovery mode
          if (!isRecoverySession || !open) {
            setIsResetPasswordOpen(open);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Your Password</DialogTitle>
            <DialogDescription>
              You've clicked a password reset link. Please set a new password for your account.
            </DialogDescription>
          </DialogHeader>

          <Form {...resetPasswordForm}>
            <form onSubmit={resetPasswordForm.handleSubmit(onResetPasswordSubmit)} className="space-y-4">
              <FormField
                control={resetPasswordForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} autoFocus />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={resetPasswordForm.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm New Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="text-sm text-muted-foreground mt-2">
                <p>Password must be at least 6 characters long.</p>
                <p className="mt-2">
                  After setting a new password, you'll be signed out and can log in with your new password.
                </p>
              </div>

              <DialogFooter>
                <Button type="submit" disabled={isLoading} className="w-full">
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update Password"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
