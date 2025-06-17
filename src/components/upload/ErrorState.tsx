
import React from "react";
import { AlertCircle } from "lucide-react";
import { useReceiptsTranslation } from "@/contexts/LanguageContext";

interface ErrorStateProps {
  error: string | null;
}

export function ErrorState({ error }: ErrorStateProps) {
  const { t } = useReceiptsTranslation();

  if (!error) return null;

  return (
    <div className="mt-4 p-4 bg-destructive/10 border border-destructive rounded-md text-sm w-full">
      <div className="flex items-start gap-3">
        <AlertCircle size={20} className="text-destructive shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-destructive">{t("upload.errors.processingError")}</p>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    </div>
  );
}
