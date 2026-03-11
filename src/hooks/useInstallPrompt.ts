import { useCallback, useEffect, useState } from "react";

const INSTALL_DISMISSED_STORAGE_KEY = "pwa:install-dismissed";
const INSTALL_COMPLETED_STORAGE_KEY = "pwa:install-completed";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const getWindow = () => (typeof window === "undefined" ? null : window);

const getInitialDismissedState = () => {
  const currentWindow = getWindow();
  if (!currentWindow) return false;

  return currentWindow.localStorage.getItem(INSTALL_DISMISSED_STORAGE_KEY) === "true"
    || currentWindow.localStorage.getItem(INSTALL_COMPLETED_STORAGE_KEY) === "true";
};

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(getInitialDismissedState);

  useEffect(() => {
    const currentWindow = getWindow();
    if (!currentWindow) return undefined;

    const handleBeforeInstallPrompt = (event: Event) => {
      const installEvent = event as BeforeInstallPromptEvent;
      installEvent.preventDefault();
      setDeferredPrompt(installEvent);
    };

    const handleInstalled = () => {
      currentWindow.localStorage.setItem(INSTALL_COMPLETED_STORAGE_KEY, "true");
      setDeferredPrompt(null);
      setDismissed(true);
    };

    currentWindow.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt as EventListener);
    currentWindow.addEventListener("appinstalled", handleInstalled);

    return () => {
      currentWindow.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt as EventListener);
      currentWindow.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const dismissInstallPrompt = useCallback(() => {
    const currentWindow = getWindow();
    currentWindow?.localStorage.setItem(INSTALL_DISMISSED_STORAGE_KEY, "true");
    setDeferredPrompt(null);
    setDismissed(true);
  }, []);

  const promptToInstall = useCallback(async () => {
    const currentWindow = getWindow();
    if (!deferredPrompt || !currentWindow) return false;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      currentWindow.localStorage.setItem(INSTALL_COMPLETED_STORAGE_KEY, "true");
    } else {
      currentWindow.localStorage.setItem(INSTALL_DISMISSED_STORAGE_KEY, "true");
    }

    setDeferredPrompt(null);
    setDismissed(true);
    return outcome === "accepted";
  }, [deferredPrompt]);

  return {
    dismissInstallPrompt,
    isInstallPromptAvailable: Boolean(deferredPrompt) && !dismissed,
    promptToInstall,
  };
}