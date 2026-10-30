import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthTranslation } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { supabase } from "@/lib/supabase";
import { captureReferralCodeFromSearch } from "@/lib/referralTracking";
import { useToast } from "@/hooks/use-toast";
import { AuthBrandingPanel } from "@/components/auth/AuthBrandingPanel";
import { LanguageSelector } from "@/components/LanguageSelector";
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
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { ArrowLeft, Eye, EyeOff, Loader2, Moon, Sun } from "lucide-react";

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

type LoginFormValues = z.infer<ReturnType<typeof createLoginSchema>>;
type SignupFormValues = z.infer<ReturnType<typeof createSignupSchema>>;
type ForgotPasswordFormValues = z.infer<ReturnType<typeof createForgotPasswordSchema>>;
type ResetPasswordFormValues = z.infer<ReturnType<typeof createResetPasswordSchema>>;

type AuthMode = "login" | "signup";
type SummaryErrors = Record<string, { message?: string } | undefined>;

function hasRecoveryHash() {
  if (typeof window === "undefined") {
    return false;
  }

  const hash = window.location.hash;
  return Boolean(hash && hash.includes('type=recovery') && hash.includes('access_token'));
}

const authLabelClass = "text-[0.8125rem] font-semibold text-ledger-ink-2";
const authInputClass =
  "h-[46px] rounded-lg border-ledger-line-strong bg-ledger-surface px-3.5 text-base text-ledger-ink placeholder:text-ledger-muted focus-visible:border-ledger-accent focus-visible:ring-2 focus-visible:ring-ledger-accent/25 focus-visible:ring-offset-0 aria-[invalid=true]:border-ledger-danger aria-[invalid=true]:bg-ledger-danger-soft/25 aria-[invalid=true]:focus-visible:border-ledger-danger aria-[invalid=true]:focus-visible:ring-ledger-danger/25 md:text-base";
const authMessageClass = "text-[0.8125rem] font-normal leading-[1.45] text-ledger-danger";
const authLinkClass =
  "inline-flex min-h-11 items-center text-sm font-semibold text-ledger-accent underline decoration-1 underline-offset-[3px] transition-colors hover:text-ledger-accent-hover";
const authBackLinkClass =
  "inline-flex min-h-11 w-fit items-center text-sm font-medium text-ledger-muted transition-colors hover:text-ledger-ink hover:underline hover:underline-offset-[3px]";

function GoogleMark() {
  return (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}

function PasswordToggle({
  visible,
  onToggle,
  showLabel,
  hideLabel,
}: {
  visible: boolean;
  onToggle: () => void;
  showLabel: string;
  hideLabel: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={visible}
      aria-label={visible ? hideLabel : showLabel}
      onClick={onToggle}
      className="absolute right-0.5 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-md text-ledger-muted transition-colors hover:bg-ledger-surface-2 hover:text-ledger-ink"
    >
      {visible ? (
        <EyeOff className="h-[18px] w-[18px]" strokeWidth={1.5} aria-hidden="true" />
      ) : (
        <Eye className="h-[18px] w-[18px]" strokeWidth={1.5} aria-hidden="true" />
      )}
    </button>
  );
}

function AuthThemeToggle({ label }: { label: string }) {
  const { isDarkMode, toggleMode } = useTheme();

  return (
    <button
      type="button"
      onClick={() => {
        void toggleMode();
      }}
      aria-label={label}
      title={label}
      aria-pressed={isDarkMode}
      className="grid h-9 w-9 place-items-center rounded-lg text-ledger-ink-2 transition-colors hover:bg-ledger-surface-2 hover:text-ledger-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ledger-accent/40"
    >
      {isDarkMode ? (
        <Sun aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={1.7} />
      ) : (
        <Moon aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={1.7} />
      )}
    </button>
  );
}

function AuthErrorSummary({
  errors,
  title,
  onFocus,
}: {
  errors: SummaryErrors;
  title: string;
  onFocus: (field: string) => void;
}) {
  const entries = Object.entries(errors).filter(([, error]) => Boolean(error?.message));

  if (entries.length === 0) {
    return null;
  }

  return (
    <div
      role="alert"
      className="rounded-lg border border-ledger-danger/30 bg-ledger-danger-soft px-3.5 py-3"
    >
      <p className="text-[0.8125rem] font-bold text-ledger-danger">{title}</p>
      <ul className="mt-1.5 grid gap-[3px]">
        {entries.map(([field, error]) => (
          <li key={field}>
            <button
              type="button"
              onClick={() => onFocus(field)}
              className="text-left text-[0.8125rem] leading-[1.45] text-ledger-danger underline underline-offset-2"
            >
              {String(error?.message)}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Auth() {
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isForgotView, setIsForgotView] = useState(false);
  const [isPasswordResetSent, setIsPasswordResetSent] = useState(false);
  const [isRecoverySession, setIsRecoverySession] = useState(hasRecoveryHash);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(hasRecoveryHash);
  const recoveryToastShown = useRef(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showSignupConfirmPassword, setShowSignupConfirmPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showResetConfirmPassword, setShowResetConfirmPassword] = useState(false);
  const { user, signIn, signUp, signInWithGoogle, resetPassword } = useAuth();
  const { t } = useAuthTranslation();
  const [activeMode, setActiveMode] = useState<AuthMode>("login");
  const location = useLocation();
  const { toast } = useToast();

  // Create schemas with current translations
  const loginSchema = createLoginSchema(t);
  const signupSchema = createSignupSchema(t);
  const forgotPasswordSchema = createForgotPasswordSchema(t);
  const resetPasswordSchema = createResetPasswordSchema(t);

  // Keep the latest translator and toast callback available to the auth
  // subscription without re-subscribing on every render.
  const tRef = useRef(t);
  const toastRef = useRef(toast);
  useEffect(() => {
    tRef.current = t;
    toastRef.current = toast;
  }, [t, toast]);

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

  const openForgotPassword = useCallback(() => {
    setIsForgotView(true);
    setIsPasswordResetSent(false);
    forgotPasswordForm.reset({ email: loginForm.getValues("email") });
    forgotPasswordForm.clearErrors();
  }, [forgotPasswordForm, loginForm]);

  const backToLogin = useCallback(() => {
    setIsForgotView(false);
    setIsPasswordResetSent(false);
    forgotPasswordForm.clearErrors();
  }, [forgotPasswordForm]);

  const selectMode = useCallback((mode: AuthMode) => {
    setActiveMode(mode);
    setIsForgotView(false);
    setIsPasswordResetSent(false);
    loginForm.clearErrors();
    signupForm.clearErrors();
  }, [loginForm, signupForm]);

  useEffect(() => {
    captureReferralCodeFromSearch(location.search);
  }, [location.search]);

  useEffect(() => {
    const translate = (key: string) => tRef.current(key);
    const showToast = (...args: Parameters<typeof toast>) => toastRef.current(...args);

    // Supabase password recovery flow puts tokens and type=recovery in the hash.
    // e.g., #access_token=...&refresh_token=...&expires_in=...&token_type=bearer&type=recovery
    // The hash is not cleared here because onResetPasswordSubmit needs it.
    if (hasRecoveryHash() && !recoveryToastShown.current) {
      recoveryToastShown.current = true;
      showToast({
        title: translate("toasts.passwordReset"),
        description: translate("toasts.passwordResetDescription"),
      });
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        // This event implies Supabase has processed the recovery link and established a recovery session.
        setIsRecoverySession(true);
        setIsResetPasswordOpen(true);
        if (!recoveryToastShown.current) {
          recoveryToastShown.current = true;
          showToast({
            title: translate("toasts.passwordRecoveryConfirmed"),
            description: translate("toasts.passwordRecoveryDescription"),
          });
        }
        // Don't clear URL hash here; onResetPasswordSubmit needs it.
      } else if (event === 'SIGNED_IN') {
        // This event occurs for any successful sign-in (manual, OAuth, magic link, or session restoration).
        // We must ensure this isn't misinterpreted as needing password reset if it's a normal sign-in.
        const currentHash = window.location.hash;
        const isActualRecoveryHash = currentHash && currentHash.includes('type=recovery') && currentHash.includes('access_token');

        // If SIGNED_IN occurs and it IS a recovery hash, ensure recovery UI is active.
        // This might be redundant if the PASSWORD_RECOVERY event already handled it, but acts as a safeguard.
        setIsRecoverySession(Boolean(isActualRecoveryHash));
        setIsResetPasswordOpen(Boolean(isActualRecoveryHash));
        // AuthContext should handle clearing non-recovery auth hashes (like from OAuth).
      } else if (event === 'SIGNED_OUT') {
        // If user signs out for any reason, clear any recovery state.
        setIsRecoverySession(false);
        setIsResetPasswordOpen(false);
        setIsForgotView(false);
        if (!hasRecoveryHash()) {
          recoveryToastShown.current = false;
        }
        resetPasswordForm.reset(); // Clear the form fields
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [resetPasswordForm]);

  const onLoginSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    try {
      await signIn(data.email, data.password, rememberMe);
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
      // Bring the user back to the login form while they confirm their address.
      setActiveMode("login");
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
      // Keep the view open to show the confirmation status.
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
      // Step 1: Ensure there's a session. Supabase's recovery link creates one.
      // If getSession doesn't immediately return it (e.g. race condition on load),
      // try to set it manually from the hash (which contains tokens for recovery).
      let { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        const hash = window.location.hash;
        const accessToken = hash.match(/access_token=([^&]*)/)?.[1];
        const refreshToken = hash.match(/refresh_token=([^&]*)/)?.[1];

        if (accessToken && refreshToken) {
          const { data: manualSessionData, error: setError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (setError) {
            console.error("Auth.tsx: Error manually setting session:", setError);
            toast({
              title: t("toasts.sessionError"),
              description: t("errors.sessionRecoveryFailed", { message: setError.message }),
              variant: "destructive",
            });
            setIsLoading(false);
            return;
          }
          session = manualSessionData.session;

          if (!session) {
            console.error("Auth.tsx: Session still null after attempting manual setSession for recovery.");
            toast({
              title: t("toasts.sessionError"),
              description: t("errors.sessionVerificationFailed"),
              variant: "destructive",
            });
            setIsLoading(false);
            return;
          }
        } else {
          console.error("Auth.tsx: Access token or refresh token missing in hash. Cannot manually set recovery session.");
          toast({
            title: t("toasts.recoveryError"),
            description: t("errors.incompleteRecoveryInfo"),
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }
      }

      // Step 2: Update the user's password.
      // We use supabase.auth.updateUser directly here because this is part of the recovery flow,
      // which is more specialized than the generic updatePassword in AuthContext.
      const { error: updateError } = await supabase.auth.updateUser({
        password: data.password
      });

      if (updateError) {
        console.error("Auth.tsx: Supabase updateUser error during recovery:", updateError);
        let message = updateError.message;
        if (message.includes("session is not a recovery session")) {
          message = t("errors.invalidRecoverySession");
        } else if (message.includes("Password should be at least 6 characters")) {
          message = t("errors.weakPassword");
        }
        toast({ title: t("toasts.passwordUpdateFailed"), description: message, variant: "destructive" });
        setIsLoading(false); // Release loading state
        // Do not clear recovery state here, user might want to try again with a different password.
        return;
      }

      // Step 3: Clean up and sign out.
      setIsRecoverySession(false);
      setIsResetPasswordOpen(false);
      resetPasswordForm.reset();

      toast({
        title: t("toasts.passwordUpdated"),
        description: t("toasts.passwordUpdatedDescription"),
      });

      // Clean the recovery tokens from the URL hash as they are no longer needed and sensitive.
      window.history.replaceState(null, '', window.location.pathname + window.location.search);

      // Sign out the user from the recovery session. This is crucial.
      await supabase.auth.signOut();

      // Redirect to the login page to force a fresh login with the new password.
      // A full page reload ensures all state is fresh.
      window.location.assign('/auth');
    } catch (error: unknown) {
      const message = error instanceof Error
        ? error.message
        : t("errors.unexpectedError");

      console.error("Auth.tsx: Unexpected error in onResetPasswordSubmit:", error);
      toast({
        title: t("common.error"),
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onCancelRecovery = async () => {
    resetPasswordForm.reset();
    window.history.replaceState(null, '', '/auth');
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Auth.tsx: Error signing out of recovery session:", error);
    }
    window.location.assign('/auth');
  };

  const showRecovery = isRecoverySession || isResetPasswordOpen;
  const view: "auth" | "forgot" | "reset" = showRecovery
    ? "reset"
    : isForgotView
      ? "forgot"
      : "auth";

  useEffect(() => {
    const pageTitle = view === "reset"
      ? t("resetPassword.title")
      : view === "forgot"
        ? t("forgotPassword.title")
        : activeMode === "login"
          ? t("signIn.title")
          : t("signUp.title");
    document.title = `${pageTitle} — Mataresit`;
  }, [activeMode, t, view]);

  // Redirect if user is logged in AND not in an active recovery flow
  if (user && !isRecoverySession && !isResetPasswordOpen) {
    const from = location.state?.from?.pathname || "/dashboard";
    return <Navigate to={from} replace />;
  }

  const headerCopy = view === "reset"
    ? {
        eyebrow: t("resetEyebrow"),
        title: t("resetPassword.title"),
        subtitle: t("resetPassword.subtitle"),
      }
    : view === "forgot"
      ? {
          eyebrow: t("eyebrow"),
          title: t("forgotPassword.title"),
          subtitle: t("forgotPassword.subtitle"),
        }
      : {
          eyebrow: t("eyebrow"),
          title: t("welcome"),
          subtitle: activeMode === "login" ? t("signIn.subtitle") : t("signUp.subtitle"),
        };

  return (
    <div className="min-h-svh bg-ledger-paper text-ledger-ink">
      <a
        href="#auth-panel"
        className="absolute left-4 top-[-64px] z-[100] rounded-md bg-ledger-ink px-4 py-2.5 text-sm text-ledger-paper transition-[top] focus:top-3"
      >
        {t("common.skipToSignIn")}
      </a>

      <div className="grid min-h-svh content-start min-[980px]:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)]">
        <AuthBrandingPanel />

        <main
          id="auth-panel"
          className="flex flex-col px-5 pb-8 pt-3 min-[980px]:min-h-svh min-[980px]:px-8 min-[980px]:pb-10 min-[980px]:pt-5"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1">
              <LanguageSelector
                variant="globe-code"
                showFlag={false}
                ariaLabel={t("common.language")}
                menuClassName="w-60"
                className="h-9 rounded-lg px-2.5 text-ledger-ink-2 hover:bg-ledger-surface-2 hover:text-ledger-ink"
              />
              <AuthThemeToggle label={t("common.toggleTheme")} />
            </div>

            <Link
              to="/"
              className="inline-flex min-h-11 items-center gap-[7px] rounded-[7px] px-2.5 text-sm font-medium text-ledger-muted transition-colors hover:bg-ledger-surface-2 hover:text-ledger-ink"
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={1.7} aria-hidden="true" />
              {t("common.backToSite")}
            </Link>
          </div>

          <div className="mx-auto flex w-full max-w-[440px] flex-1 flex-col justify-center py-7 min-[980px]:py-8">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
            >
              <header className="grid gap-2 text-center">
                <p className="font-data text-[0.625rem] uppercase tracking-[0.16em] text-ledger-muted">
                  {headerCopy.eyebrow}
                </p>
                <h1 className="font-display text-[clamp(1.85rem,2.6vw,2.2rem)] font-normal leading-[1.1] tracking-[-0.02em] text-ledger-ink">
                  {headerCopy.title}
                </h1>
                <p className="mx-auto max-w-[36ch] text-[0.9375rem] leading-[1.55] text-ledger-muted">
                  {headerCopy.subtitle}
                </p>
              </header>

              {view === "auth" && (
                <>
                  <div
                    role="group"
                    aria-label={t("common.accountAccess")}
                    className="mt-[26px] grid grid-cols-2 gap-1 rounded-[9px] border border-ledger-line bg-ledger-surface-2 p-1"
                  >
                    {(["login", "signup"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        aria-pressed={activeMode === mode}
                        onClick={() => selectMode(mode)}
                        className={cn(
                          "min-h-11 rounded-md text-[0.9375rem] font-semibold transition-colors",
                          activeMode === mode
                            ? "bg-ledger-surface text-ledger-ink shadow-[inset_0_0_0_1px_var(--ledger-line),0_1px_2px_rgba(18,23,21,0.06)]"
                            : "text-ledger-muted hover:text-ledger-ink"
                        )}
                      >
                        {mode === "login" ? t("tabs.login") : t("tabs.signup")}
                      </button>
                    ))}
                  </div>

                  {activeMode === "login" ? (
                    <>
                      <Form {...loginForm}>
                        <form
                          noValidate
                          onSubmit={loginForm.handleSubmit(onLoginSubmit)}
                          className="mt-6 grid gap-[18px]"
                        >
                          {loginForm.formState.isSubmitted && Object.keys(loginForm.formState.errors).length > 0 && (
                            <AuthErrorSummary
                              title={t("errors.checkDetails")}
                              errors={loginForm.formState.errors as SummaryErrors}
                              onFocus={(field) => loginForm.setFocus(field as "email" | "password")}
                            />
                          )}

                          <FormField
                            control={loginForm.control}
                            name="email"
                            render={({ field }) => (
                              <FormItem className="space-y-1.5">
                                <FormLabel className={authLabelClass}>
                                  {t("signIn.email")} <span aria-hidden="true" className="font-normal text-ledger-muted">*</span>
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    className={authInputClass}
                                    type="email"
                                    inputMode="email"
                                    autoComplete="email"
                                    aria-required="true"
                                    placeholder={t("signIn.emailPlaceholder")}
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage className={authMessageClass} />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={loginForm.control}
                            name="password"
                            render={({ field }) => (
                              <FormItem className="space-y-1.5">
                                <FormLabel className={authLabelClass}>
                                  {t("signIn.password")} <span aria-hidden="true" className="font-normal text-ledger-muted">*</span>
                                </FormLabel>
                                <div className="relative">
                                  <FormControl>
                                    <Input
                                      className={cn(authInputClass, "pr-12")}
                                      type={showLoginPassword ? "text" : "password"}
                                      autoComplete="current-password"
                                      aria-required="true"
                                      {...field}
                                    />
                                  </FormControl>
                                  <PasswordToggle
                                    visible={showLoginPassword}
                                    onToggle={() => setShowLoginPassword((prev) => !prev)}
                                    showLabel={t("signIn.showPassword")}
                                    hideLabel={t("signIn.hidePassword")}
                                  />
                                </div>
                                <FormMessage className={authMessageClass} />
                              </FormItem>
                            )}
                          />

                          <div className="flex flex-wrap items-center justify-between gap-x-3">
                            <label
                              htmlFor="rememberMe"
                              className="inline-flex min-h-11 cursor-pointer items-center gap-[9px] text-sm text-ledger-ink-2"
                            >
                              <Checkbox
                                id="rememberMe"
                                size="sm"
                                checked={rememberMe}
                                onCheckedChange={(checked) => setRememberMe(checked === true)}
                                className="rounded-[3px] border-ledger-line-strong data-[state=checked]:border-ledger-accent data-[state=checked]:bg-ledger-accent data-[state=checked]:text-ledger-accent-foreground"
                              />
                              {t("signIn.rememberMe")}
                            </label>
                            <button type="button" className={authLinkClass} onClick={openForgotPassword}>
                              {t("signIn.forgotPassword")}
                            </button>
                          </div>

                          <Button
                            type="submit"
                            variant="accent"
                            disabled={isLoading}
                            aria-busy={isLoading}
                            className="h-12 w-full rounded-lg text-[0.9375rem] font-semibold disabled:opacity-75"
                          >
                            {isLoading ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                {t("signIn.buttonLoading")}
                              </>
                            ) : (
                              t("signIn.button")
                            )}
                          </Button>
                        </form>
                      </Form>

                      <div className="mt-[26px] grid grid-cols-[1fr_auto_1fr] items-center gap-3.5">
                        <span className="border-t border-ledger-line" />
                        <span className="font-data text-[0.625rem] uppercase tracking-[0.14em] text-ledger-muted">
                          {t("common.orContinueWith")}
                        </span>
                        <span className="border-t border-ledger-line" />
                      </div>

                      <Button
                        variant="accent-outline"
                        type="button"
                        disabled={isGoogleLoading}
                        aria-busy={isGoogleLoading}
                        className="mt-4 h-12 w-full gap-2.5 rounded-lg border-ledger-line-strong bg-ledger-surface text-[0.9375rem] font-semibold hover:border-ledger-ink-2 hover:bg-ledger-surface-2 disabled:opacity-75"
                        onClick={handleGoogleSignIn}
                      >
                        {isGoogleLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <GoogleMark />
                        )}
                        {t("signIn.withGoogle")}
                      </Button>

                      <p className="mt-5 text-center text-sm text-ledger-muted">
                        {t("signIn.noAccount")}{" "}
                        <button
                          type="button"
                          onClick={() => selectMode("signup")}
                          className={cn(authLinkClass, "ml-1")}
                        >
                          {t("signIn.signUp")}
                        </button>
                      </p>
                    </>
                  ) : (
                    <>
                      <Form {...signupForm}>
                        <form
                          noValidate
                          onSubmit={signupForm.handleSubmit(onSignupSubmit)}
                          className="mt-6 grid gap-[18px]"
                        >
                          {signupForm.formState.isSubmitted && Object.keys(signupForm.formState.errors).length > 0 && (
                            <AuthErrorSummary
                              title={t("errors.checkDetails")}
                              errors={signupForm.formState.errors as SummaryErrors}
                              onFocus={(field) => signupForm.setFocus(field as "email" | "password" | "confirmPassword")}
                            />
                          )}

                          <FormField
                            control={signupForm.control}
                            name="email"
                            render={({ field }) => (
                              <FormItem className="space-y-1.5">
                                <FormLabel className={authLabelClass}>
                                  {t("signUp.email")} <span aria-hidden="true" className="font-normal text-ledger-muted">*</span>
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    className={authInputClass}
                                    type="email"
                                    inputMode="email"
                                    autoComplete="email"
                                    aria-required="true"
                                    placeholder={t("signUp.emailPlaceholder")}
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage className={authMessageClass} />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={signupForm.control}
                            name="password"
                            render={({ field }) => (
                              <FormItem className="space-y-1.5">
                                <FormLabel className={authLabelClass}>
                                  {t("signUp.password")} <span aria-hidden="true" className="font-normal text-ledger-muted">*</span>
                                </FormLabel>
                                <div className="relative">
                                  <FormControl>
                                    <Input
                                      className={cn(authInputClass, "pr-12")}
                                      type={showSignupPassword ? "text" : "password"}
                                      autoComplete="new-password"
                                      aria-required="true"
                                      {...field}
                                    />
                                  </FormControl>
                                  <PasswordToggle
                                    visible={showSignupPassword}
                                    onToggle={() => setShowSignupPassword((prev) => !prev)}
                                    showLabel={t("signIn.showPassword")}
                                    hideLabel={t("signIn.hidePassword")}
                                  />
                                </div>
                                <FormMessage className={authMessageClass} />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={signupForm.control}
                            name="confirmPassword"
                            render={({ field }) => (
                              <FormItem className="space-y-1.5">
                                <FormLabel className={authLabelClass}>
                                  {t("signUp.confirmPassword")} <span aria-hidden="true" className="font-normal text-ledger-muted">*</span>
                                </FormLabel>
                                <div className="relative">
                                  <FormControl>
                                    <Input
                                      className={cn(authInputClass, "pr-12")}
                                      type={showSignupConfirmPassword ? "text" : "password"}
                                      autoComplete="new-password"
                                      aria-required="true"
                                      {...field}
                                    />
                                  </FormControl>
                                  <PasswordToggle
                                    visible={showSignupConfirmPassword}
                                    onToggle={() => setShowSignupConfirmPassword((prev) => !prev)}
                                    showLabel={t("signIn.showPassword")}
                                    hideLabel={t("signIn.hidePassword")}
                                  />
                                </div>
                                <FormMessage className={authMessageClass} />
                              </FormItem>
                            )}
                          />

                          <p className="text-[0.8125rem] leading-[1.55] text-ledger-muted">
                            {t("signUp.termsNotice")}
                          </p>

                          <Button
                            type="submit"
                            variant="accent"
                            disabled={isLoading}
                            aria-busy={isLoading}
                            className="h-12 w-full rounded-lg text-[0.9375rem] font-semibold disabled:opacity-75"
                          >
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

                      <div className="mt-[26px] grid grid-cols-[1fr_auto_1fr] items-center gap-3.5">
                        <span className="border-t border-ledger-line" />
                        <span className="font-data text-[0.625rem] uppercase tracking-[0.14em] text-ledger-muted">
                          {t("common.orContinueWith")}
                        </span>
                        <span className="border-t border-ledger-line" />
                      </div>

                      <Button
                        variant="accent-outline"
                        type="button"
                        disabled={isGoogleLoading}
                        aria-busy={isGoogleLoading}
                        className="mt-4 h-12 w-full gap-2.5 rounded-lg border-ledger-line-strong bg-ledger-surface text-[0.9375rem] font-semibold hover:border-ledger-ink-2 hover:bg-ledger-surface-2 disabled:opacity-75"
                        onClick={handleGoogleSignIn}
                      >
                        {isGoogleLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <GoogleMark />
                        )}
                        {t("signUp.withGoogle")}
                      </Button>

                      <p className="mt-5 text-center text-sm text-ledger-muted">
                        {t("signUp.hasAccount")}{" "}
                        <button
                          type="button"
                          onClick={() => selectMode("login")}
                          className={cn(authLinkClass, "ml-1")}
                        >
                          {t("signUp.signIn")}
                        </button>
                      </p>
                    </>
                  )}
                </>
              )}

              {view === "forgot" && (
                <div className="mt-[26px] grid gap-4">
                  <Form {...forgotPasswordForm}>
                    <form
                      noValidate
                      onSubmit={forgotPasswordForm.handleSubmit(onForgotPasswordSubmit)}
                      className="grid gap-[18px]"
                    >
                      <FormField
                        control={forgotPasswordForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem className="space-y-1.5">
                            <FormLabel className={authLabelClass}>
                              {t("forgotPassword.email")} <span aria-hidden="true" className="font-normal text-ledger-muted">*</span>
                            </FormLabel>
                            <FormControl>
                              <Input
                                className={authInputClass}
                                type="email"
                                inputMode="email"
                                autoComplete="email"
                                aria-required="true"
                                placeholder={t("forgotPassword.emailPlaceholder")}
                                {...field}
                                autoFocus
                              />
                            </FormControl>
                            <FormMessage className={authMessageClass} />
                          </FormItem>
                        )}
                      />

                      <Button
                        type="submit"
                        variant="accent"
                        disabled={isLoading}
                        aria-busy={isLoading}
                        className="h-12 w-full rounded-lg text-[0.9375rem] font-semibold disabled:opacity-75"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {t("common.sending")}
                          </>
                        ) : (
                          t("forgotPassword.button")
                        )}
                      </Button>
                    </form>
                  </Form>

                  {isPasswordResetSent && (
                    <p
                      role="status"
                      className="rounded-lg border border-ledger-accent/20 bg-ledger-accent-soft px-3.5 py-3 text-[0.8125rem] leading-[1.5] text-ledger-accent"
                    >
                      {t("forgotPassword.subtitleSent")}
                    </p>
                  )}

                  <button type="button" onClick={backToLogin} className={authBackLinkClass}>
                    {t("forgotPassword.backToSignIn")}
                  </button>
                </div>
              )}

              {view === "reset" && (
                <div className="mt-[26px] grid gap-4">
                  <Form {...resetPasswordForm}>
                    <form
                      noValidate
                      onSubmit={resetPasswordForm.handleSubmit(onResetPasswordSubmit)}
                      className="grid gap-[18px]"
                    >
                      <FormField
                        control={resetPasswordForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem className="space-y-1.5">
                            <FormLabel className={authLabelClass}>
                              {t("resetPassword.password")} <span aria-hidden="true" className="font-normal text-ledger-muted">*</span>
                            </FormLabel>
                            <div className="relative">
                              <FormControl>
                                <Input
                                  className={cn(authInputClass, "pr-12")}
                                  type={showResetPassword ? "text" : "password"}
                                  autoComplete="new-password"
                                  aria-required="true"
                                  {...field}
                                  autoFocus
                                />
                              </FormControl>
                              <PasswordToggle
                                visible={showResetPassword}
                                onToggle={() => setShowResetPassword((prev) => !prev)}
                                showLabel={t("signIn.showPassword")}
                                hideLabel={t("signIn.hidePassword")}
                              />
                            </div>
                            <FormMessage className={authMessageClass} />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={resetPasswordForm.control}
                        name="confirmPassword"
                        render={({ field }) => (
                          <FormItem className="space-y-1.5">
                            <FormLabel className={authLabelClass}>
                              {t("resetPassword.confirmPassword")} <span aria-hidden="true" className="font-normal text-ledger-muted">*</span>
                            </FormLabel>
                            <div className="relative">
                              <FormControl>
                                <Input
                                  className={cn(authInputClass, "pr-12")}
                                  type={showResetConfirmPassword ? "text" : "password"}
                                  autoComplete="new-password"
                                  aria-required="true"
                                  {...field}
                                />
                              </FormControl>
                              <PasswordToggle
                                visible={showResetConfirmPassword}
                                onToggle={() => setShowResetConfirmPassword((prev) => !prev)}
                                showLabel={t("signIn.showPassword")}
                                hideLabel={t("signIn.hidePassword")}
                              />
                            </div>
                            <FormMessage className={authMessageClass} />
                          </FormItem>
                        )}
                      />

                      <div className="text-[0.8125rem] leading-[1.55] text-ledger-muted">
                        <p>{t("resetPassword.requirements")}</p>
                        <p className="mt-1">{t("resetPassword.recoveryNote")}</p>
                      </div>

                      <Button
                        type="submit"
                        variant="accent"
                        disabled={isLoading}
                        aria-busy={isLoading}
                        className="h-12 w-full rounded-lg text-[0.9375rem] font-semibold disabled:opacity-75"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {t("common.updating")}
                          </>
                        ) : (
                          t("resetPassword.button")
                        )}
                      </Button>
                    </form>
                  </Form>

                  <button type="button" onClick={onCancelRecovery} className={authBackLinkClass}>
                    {t("forgotPassword.backToSignIn")}
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        </main>
      </div>
    </div>
  );
}
