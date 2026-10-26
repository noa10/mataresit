import { useEffect, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthTranslation } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

/**
 * This component is a special handler for auth callbacks, particularly for password reset flows.
 * It's designed to handle the redirect from Supabase auth flows and ensure the user gets to
 * the right place with the right state.
 */
export default function AuthCallback() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { t } = useAuthTranslation();
  const { toast } = useToast();
  const tRef = useRef(t);
  const toastRef = useRef(toast);

  useEffect(() => {
    tRef.current = t;
    toastRef.current = toast;
  }, [t, toast]);

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Get the current URL and its parameters
        const url = new URL(window.location.href);
        const hash = window.location.hash;
        const type = url.searchParams.get('type');
        const accessToken = hash && hash.includes('access_token')
          ? hash.match(/access_token=([^&]*)/)?.[1]
          : null;

        // If this is a recovery flow, we need to handle it specially
        if (type === 'recovery' || (accessToken && hash.includes('type=recovery'))) {
          // Redirect to the auth page with the hash intact
          window.location.href = `/auth${hash}`;
          return;
        }

        // For other auth flows, just redirect to the auth page
        setIsLoading(false);
      } catch (err) {
        console.error("AuthCallback error:", err);
        setError(tRef.current("callback.unexpectedError"));
        setIsLoading(false);

        toastRef.current({
          title: tRef.current("callback.errorTitle"),
          description: tRef.current("callback.errorDescription"),
          variant: "destructive",
        });
      }
    };

    handleAuthCallback();
  }, []);

  return (
    <div className="flex min-h-svh flex-col bg-ledger-paper px-5 py-4 text-ledger-ink min-[980px]:px-8">
      <Link
        to="/"
        aria-label="Mataresit home"
        className="inline-flex w-fit items-center gap-2.5 rounded-[7px] text-[1.0625rem] font-semibold tracking-[-0.01em] text-ledger-ink"
      >
        <span
          aria-hidden="true"
          className="grid h-8 w-8 place-items-center rounded-[7px] bg-ledger-ink pt-0.5 font-display text-[1.35rem] leading-none text-ledger-paper"
        >
          M
        </span>
        <span>Mataresit</span>
      </Link>

      <main className="flex flex-1 items-center justify-center pb-16">
        {isLoading ? (
          <div className="flex flex-col items-center text-center">
            <span
              aria-hidden="true"
              className="h-9 w-9 animate-spin rounded-full border-2 border-ledger-line-strong border-t-ledger-accent"
            />
            <p role="status" className="mt-4 text-[0.9375rem] text-ledger-muted">
              {t("callback.processing")}
            </p>
          </div>
        ) : error ? (
          <div className="w-full max-w-md text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-ledger-danger-soft text-ledger-danger">
              <AlertCircle className="h-6 w-6" strokeWidth={1.5} aria-hidden="true" />
            </span>
            <h1 className="mt-5 font-display text-[clamp(2rem,3.6vw,2.5rem)] font-normal leading-[1.06] tracking-[-0.02em] text-ledger-ink">
              {t("callback.errorTitle")}
            </h1>
            <p className="mt-2 text-[0.9375rem] leading-[1.6] text-ledger-muted">
              {error}
            </p>
            <Button
              asChild
              variant="accent"
              className="mt-6 h-11 rounded-lg px-5 text-[0.9375rem] font-semibold"
            >
              <Link to="/auth">{t("callback.returnToLogin")}</Link>
            </Button>
          </div>
        ) : (
          <Navigate to="/auth" replace />
        )}
      </main>
    </div>
  );
}
