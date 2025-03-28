
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

export function StorageStatus() {
  const [status, setStatus] = useState<"loading" | "available" | "unavailable">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const checkStorageAvailability = async () => {
      try {
        // Try to list buckets to check storage availability
        const { data, error } = await supabase.storage.listBuckets();
        
        if (error) {
          console.error("Error checking storage:", error);
          setStatus("unavailable");
          setErrorMessage(error.message);
          return;
        }
        
        // Check if receipt_images bucket exists
        const receiptBucket = data.find(bucket => bucket.name === 'receipt_images');
        
        if (!receiptBucket) {
          setStatus("unavailable");
          setErrorMessage("Receipt images storage bucket not found");
        } else {
          setStatus("available");
        }
      } catch (error: any) {
        console.error("Error checking storage:", error);
        setStatus("unavailable");
        setErrorMessage(error.message);
      }
    };

    checkStorageAvailability();
  }, []);

  if (status === "loading") {
    return (
      <Alert className="bg-secondary/50 border-secondary">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        <AlertTitle>Checking storage...</AlertTitle>
        <AlertDescription>
          Verifying receipt storage availability...
        </AlertDescription>
      </Alert>
    );
  }

  if (status === "available") {
    return (
      <Alert className="bg-green-500/10 border-green-500/50">
        <CheckCircle2 className="h-4 w-4 text-green-500 mr-2" />
        <AlertTitle>Storage Ready</AlertTitle>
        <AlertDescription>
          Receipt storage is properly configured and available.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert className="bg-destructive/10 border-destructive/50">
      <AlertCircle className="h-4 w-4 text-destructive mr-2" />
      <AlertTitle>Storage Issue</AlertTitle>
      <AlertDescription>
        There's an issue with the receipt storage: {errorMessage || "Unknown error"}
      </AlertDescription>
    </Alert>
  );
}
