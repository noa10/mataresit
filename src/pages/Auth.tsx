import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthTranslation } from "@/contexts/LanguageContext";
import { supabase } from "@/lib/supabase";
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

// Schema factory functions that use translations
const createLoginSchema = (t: (key: string) => string) => z.object({
  email: z.string().email(t("validation.emailInvalid")),
  password: z.string().min(6, t("validation.passwordTooShort")),
});

const createSignupSchema = (t: (key: string) => string) => {
  const loginSchema = createLoginSchema(t);
  return loginSchema.extend({
    confirmPassword: z.string().min(6, t("validation.passwordTooShort")),
  }).refine((data) => data.password === data.confirmPassword, {
    message: t("validation.passwordMismatch"),
    path: ["confirmPassword"],
  });
};

const createForgotPasswordSchema = (t: (key: string) => string) => z.object({
  email: z.string().email(t("validation.emailInvalid")),
});

const createResetPasswordSchema = (t: (key: string) => string) => z.object({
  password: z.string().min(6, t("validation.passwordTooShort")),
  confirmPassword: z.string().min(6, t("validation.passwordTooShort")),
}).refine((data) => data.password === data.confirmPassword, {
  message: t("validation.passwordMismatch"),
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
  const { user, signIn, signUp, signInWithGoogle, resetPassword } = useAuth();
  const { t } = useAuthTranslation();
  const [activeTab, setActiveTab] = useState<"login" | "signup">("login");
  const location = useLocation();
  const { toast } = useToast();

  // Create schemas with current translations
  const loginSchema = createLoginSchema(t);
  const signupSchema = createSignupSchema(t);
  const forgotPasswordSchema = createForgotPasswordSchema(t);
  const resetPasswordSchema = createResetPasswordSchema(t);

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

  // Function to check for recovery mode based on URL hash
  // This is primarily for the initial page load.
  const checkForRecoveryModeOnMount = () => {
    console.log("Auth.tsx: checkForRecoveryModeOnMount running...");
    const hash = window.location.hash;

    // Supabase password recovery flow puts tokens and type=recovery in the hash.
    // e.g., #access_token=...&refresh_token=...&expires_in=...&token_type=bearer&type=recovery
    if (hash && hash.includes('type=recovery') && hash.includes('access_token')) {
      console.log("Auth.tsx: checkForRecoveryModeOnMount - Found 'type=recovery' and 'access_token' in hash.");
      // Check if already in recovery mode to avoid redundant toasts/state sets if called multiple times
      if (!isRecoverySession && !isResetPasswordOpen) {
        setIsRecoverySession(true);
        setIsResetPasswordOpen(true);
        toast({
          title: t("toasts.passwordReset"),
          description: t("toasts.passwordResetDescription"),
        });
      }
      // It's important NOT to clear the hash here; onResetPasswordSubmit needs it.
      return true;
    }
    console.log("Auth.tsx: checkForRecoveryModeOnMount - No clear recovery indicators in hash.");
    return false;
  };

  useEffect(() => {
    // Initial check on mount for recovery hash.
    checkForRecoveryModeOnMount();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Auth.tsx: onAuthStateChange event:", event, "Session:", session ? "exists" : "null");

      if (event === 'PASSWORD_RECOVERY') {
        console.log("Auth.tsx: PASSWORD_RECOVERY event detected by onAuthStateChange.");
        // This event implies Supabase has processed the recovery link and established a recovery session.
        setIsRecoverySession(true);
        setIsResetPasswordOpen(true);
        toast({
          title: t("toasts.passwordRecoveryConfirmed"),
          description: t("toasts.passwordRecoveryDescription"),
        });
        // Don't clear URL hash here; onResetPasswordSubmit needs it.
      } else if (event === 'SIGNED_IN') {
        // This event occurs for any successful sign-in (manual, OAuth, magic link, or session restoration).
        // We must ensure this isn't misinterpreted as needing password reset if it's a normal sign-in.
        const currentHash = window.location.hash;
        const isActualRecoveryHash = currentHash && currentHash.includes('type=recovery') && currentHash.includes('access_token');

        if (isActualRecoveryHash) {
          // If SIGNED_IN occurs and it IS a recovery hash, ensure recovery UI is active.
          // This might be redundant if PASSWORD_RECOVERY event or checkForRecoveryModeOnMount already handled it, but acts as a safeguard.
          if (!isRecoverySession) {
            console.log("Auth.tsx: SIGNED_IN event with recovery hash, but recovery state not set. Setting it now.");
            setIsRecoverySession(true);
            setIsResetPasswordOpen(true);
          }
        } else {
          // If it's a SIGNED_IN event (e.g. Google login) and NOT a recovery hash scenario,
          // ensure recovery mode is turned OFF. This prevents the loop.
          if (isRecoverySession || isResetPasswordOpen) {
            console.log("Auth.tsx: SIGNED_IN event, but no active recovery hash. Resetting recovery state.");
            setIsRecoverySession(false);
            setIsResetPasswordOpen(false);
          }
          // AuthContext should handle clearing non-recovery auth hashes (like from OAuth).
        }

        // The 'session' object is available directly from the onAuthStateChange callback parameters.
        if (session?.user) {
          console.log('Current frontend user ID (auth.uid()):', session.user.id);
        }
      } else if (event === 'SIGNED_OUT') {
        // If user signs out for any reason, clear any recovery state.
        setIsRecoverySession(false);
        setIsResetPasswordOpen(false);
        resetPasswordForm.reset(); // Clear the form fields
        // The component/logic that triggered sign-out should handle navigation/URL cleanup.
        // onResetPasswordSubmit specifically handles this after password update.
      }
      // USER_UPDATED events are generally not directly tied to starting/stopping recovery UI flow.
      // The specific action (like password update) handles its own state.
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [toast, resetPasswordForm]); // Added resetPasswordForm to deps for reset call

  const onLoginSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    try {
      await signIn(data.email, data.password);
      // Successful signIn will trigger onAuthStateChange, which handles navigation via redirect logic below
    } catch (error) {
      // Error toast is handled by signIn in AuthContext
      console.error("Login error in Auth.tsx:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const onSignupSubmit = async (data: SignupFormValues) => {
    setIsLoading(true);
    try {
      await signUp(data.email, data.password);
      // Successful signUp will show a toast (from AuthContext) and user needs to verify email.
      // Optionally, switch to login tab or show a message.
      setActiveTab("login");
    } catch (error) {
      // Error toast is handled by signUp in AuthContext
      console.error("Signup error in Auth.tsx:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      await signInWithGoogle();
      // Redirect happens, then onAuthStateChange SIGNED_IN will be triggered.
    } catch (error) {
      // Error toast is handled by signInWithGoogle in AuthContext
      console.error("Google sign-in error in Auth.tsx:", error);
    } finally {
      // This might not be reached if redirect is very fast.
      setIsGoogleLoading(false);
    }
  };

  const onForgotPasswordSubmit = async (data: ForgotPasswordFormValues) => {
    setIsLoading(true);
    try {
      await resetPassword(data.email); // This is resetPasswordForEmail from AuthContext
      setIsPasswordResetSent(true);
      // Keep the dialog open to show success message.
    } catch (error) {
      // Error toast handled by resetPassword in AuthContext
      console.error("Forgot password error in Auth.tsx:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // This method is ONLY used during the password recovery flow (new password submission)
  const onResetPasswordSubmit = async (data: ResetPasswordFormValues) => {
    setIsLoading(true);
    try {
      console.log("Auth.tsx: Updating password during recovery flow...");

      // Step 1: Ensure there's a session. Supabase's recovery link creates one.
      // If getSession doesn't immediately return it (e.g. race condition on load),
      // try to set it manually from the hash (which contains tokens for recovery).
      let { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        console.warn("Auth.tsx: No active session from getSession(). Attempting to set session from URL hash for recovery.");
        const hash = window.location.hash;
        const accessToken = hash.match(/access_token=([^&]*)/)?.[1];
        const refreshToken = hash.match(/refresh_token=([^&]*)/)?.[1];

        if (accessToken && refreshToken) {
          console.log("Auth.tsx: Found access_token and refresh_token in hash. Attempting supabase.auth.setSession().");
          const { data: manualSessionData, error: setError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (setError) {
            console.error("Auth.tsx: Error manually setting session:", setError);
            toast({
              title: "Session Error",
              description: `Failed to establish recovery session: ${setError.message}. Please try the link again.`,
              variant: "destructive",
            });
            setIsLoading(false);
            return;
          }
          session = manualSessionData.session;
          console.log("Auth.tsx: Manual session set successfully for recovery.");

          if (!session) {
            console.error("Auth.tsx: Session still null after attempting manual setSession for recovery.");
            toast({
              title: "Session Error",
              description: "Could not verify recovery session. Please try the link again.",
              variant: "destructive",
            });
            setIsLoading(false);
            return;
          }
        } else {
          console.error("Auth.tsx: Access token or refresh token missing in hash. Cannot manually set recovery session.");
          toast({
            title: "Recovery Error",
            description: "Incomplete recovery information. Please use the link from your email again.",
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }
      } else {
        console.log("Auth.tsx: Active session found via getSession() for recovery.");
      }

      // Step 2: Update the user's password.
      // We use supabase.auth.updateUser directly here because this is part of the recovery flow,
      // which is more specialized than the generic updatePassword in AuthContext.
      console.log("Auth.tsx: Proceeding with password update using the recovery session...");
      const { data: updateData, error: updateError } = await supabase.auth.updateUser({
        password: data.password
      });

      if (updateError) {
        console.error("Auth.tsx: Supabase updateUser error during recovery:", updateError);
        // Check for common errors like weak password, expired token, etc.
        let message = updateError.message;
        if (message.includes("session is not a recovery session")) {
            message = "Invalid or expired recovery session. Please request a new password reset link.";
        } else if (message.includes("Password should be at least 6 characters")) {
            message = "Password is too short. It must be at least 6 characters.";
        }
        toast({ title: "Password Update Failed", description: message, variant: "destructive" });
        setIsLoading(false); // Release loading state
        // Do not clear recovery state here, user might want to try again with a different password.
        return;
      }

      console.log("Auth.tsx: Password update successful during recovery:", updateData ? "User updated" : "No update data returned");

      // Step 3: Clean up and sign out.
      setIsRecoverySession(false);
      setIsResetPasswordOpen(false);
      resetPasswordForm.reset();

      toast({
        title: "Password Updated",
        description: "Your password has been successfully updated. You will be signed out and can now log in with your new password.",
      });

      // Clean the recovery tokens from the URL hash as they are no longer needed and sensitive.
      window.history.replaceState(null, '', window.location.pathname + window.location.search);

      // Sign out the user from the recovery session. This is crucial.
      await supabase.auth.signOut();
      console.log("Auth.tsx: User signed out after password recovery.");

      // Redirect to the login page to force a fresh login with the new password.
      // A full page reload ensures all state is fresh.
      window.location.assign('/auth'); // Using assign for a full reload effect.

    } catch (error: any) {
      console.error("Auth.tsx: Unexpected error in onResetPasswordSubmit:", error);
      toast({
        title: "Error",
        description: error.message || "An unexpected error occurred while updating password. Please try again.",
        variant: "destructive",
      });
    } finally {
      // Ensure isLoading is always reset, unless an early return happened due to error.
      // If an early return happened, setIsLoading(false) should have been called there.
      // If the flow reaches here, it implies either success or a fall-through error.
      // Given the redirects and potential early returns, this might not always execute as expected
      // for the success path. It's more critical for error paths that don't navigate away.
      // The early returns for errors already handle setIsLoading(false).
      // For the success path, navigation occurs, so this might be redundant or not hit.
      setIsLoading(false); // This will be hit if an error is thrown and caught by the outer catch.
    }
  };

  // Redirect if user is logged in AND not in an active recovery flow
  if (user && !isRecoverySession && !isResetPasswordOpen) {
    const from = location.state?.from?.pathname || "/dashboard";
    console.log(`Auth.tsx: User is logged in and not in recovery. Redirecting to ${from}.`);
    return <Navigate to={from} replace />;
  }

  // If in recovery mode, ensure the reset password dialog is open.
  // This handles cases where onAuthStateChange sets isRecoverySession but dialog state might lag.
  if (isRecoverySession && !isResetPasswordOpen) {
      setIsResetPasswordOpen(true);
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
          <h1 className="text-2xl font-bold text-center mb-6">{t("welcome")}</h1>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "login" | "signup")}>
            <TabsList className="grid grid-cols-2 mb-6">
              <TabsTrigger value="login">{t("tabs.login")}</TabsTrigger>
              <TabsTrigger value="signup">{t("tabs.signup")}</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <Form {...loginForm}>
                <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                  <FormField
                    control={loginForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("signIn.email")}</FormLabel>
                        <FormControl>
                          <Input placeholder={t("signIn.emailPlaceholder")} {...field} />
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
                        <FormLabel>{t("signIn.password")}</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder={t("signIn.passwordPlaceholder")} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t("signIn.buttonLoading")}
                      </>
                    ) : (
                      t("signIn.button")
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
                      {t("signIn.forgotPassword")}
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
                      {t("common.orContinueWith")}
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
                  {t("signIn.withGoogle")}
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
                        <FormLabel>{t("signUp.email")}</FormLabel>
                        <FormControl>
                          <Input placeholder={t("signUp.emailPlaceholder")} {...field} />
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
                        <FormLabel>{t("signUp.password")}</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder={t("signUp.passwordPlaceholder")} {...field} />
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
                        <FormLabel>{t("signUp.confirmPassword")}</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder={t("signUp.passwordPlaceholder")} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t("signUp.buttonLoading")}
                      </>
                    ) : (
                      t("signUp.button")
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
                      {t("common.orContinueWith")}
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
                  {t("signUp.withGoogle")}
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
            <DialogTitle>{isPasswordResetSent ? t("forgotPassword.titleSent") : t("forgotPassword.title")}</DialogTitle>
            <DialogDescription>
              {isPasswordResetSent
                ? t("forgotPassword.subtitleSent")
                : t("forgotPassword.subtitle")}
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
                      <FormLabel>{t("forgotPassword.email")}</FormLabel>
                      <FormControl>
                        <Input placeholder={t("forgotPassword.emailPlaceholder")} {...field} />
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
                    {t("common.cancel")}
                  </Button>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t("common.sending")}
                      </>
                    ) : (
                      t("forgotPassword.button")
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
                {t("common.close")}
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
            <DialogTitle>{t("resetPassword.title")}</DialogTitle>
            <DialogDescription>
              {t("resetPassword.subtitle")}
            </DialogDescription>
          </DialogHeader>

          <Form {...resetPasswordForm}>
            <form onSubmit={resetPasswordForm.handleSubmit(onResetPasswordSubmit)} className="space-y-4">
              <FormField
                control={resetPasswordForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("resetPassword.password")}</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder={t("resetPassword.passwordPlaceholder")} {...field} autoFocus />
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
                    <FormLabel>{t("resetPassword.confirmPassword")}</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder={t("resetPassword.passwordPlaceholder")} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="text-sm text-muted-foreground mt-2">
                <p>{t("resetPassword.requirements")}</p>
                <p className="mt-1">
                  {t("resetPassword.recoveryNote")}
                </p>
              </div>

              <DialogFooter>
                <Button type="submit" disabled={isLoading} className="w-full">
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t("common.updating")}
                    </>
                  ) : (
                    t("resetPassword.button")
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
