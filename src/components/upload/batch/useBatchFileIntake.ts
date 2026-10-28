import { useCallback, useState } from "react";
import imageCompression from "browser-image-compression";
import { optimizeImageForUpload } from "@/utils/imageUtils";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "application/pdf",
]);

interface UseBatchFileIntakeOptions {
  addToBatchQueue: (
    files: FileList | File[],
    categoryId?: string | null
  ) => Promise<unknown>;
  categoryId: string | null;
  remainingSlots: number;
  /** Called alongside the inline error so the queue view can surface it too. */
  onError?: (message: string) => void;
}

function pluralise(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

/**
 * Client-side intake for the batch sheet: validates, optimises, and hands
 * files to the existing batch queue. The modal only reports inline errors;
 * the upload hook remains the final subscription/limit authority.
 */
export function useBatchFileIntake({
  addToBatchQueue,
  categoryId,
  remainingSlots,
  onError,
}: UseBatchFileIntakeOptions) {
  const [isCompressing, setIsCompressing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reportError = useCallback(
    (message: string) => {
      setError(message);
      onError?.(message);
    },
    [onError]
  );

  const clearError = useCallback(() => setError(null), []);

  const handleFiles = useCallback(
    async (input: FileList | File[] | null) => {
      if (!input) return;
      const files = Array.from(input);
      if (files.length === 0) return;

      setError(null);

      if (remainingSlots <= 0) {
        reportError("This batch is full. Post or clear it before adding more receipts.");
        return;
      }

      const accepted: File[] = [];
      const invalid: File[] = [];
      const oversized: File[] = [];

      for (const file of files) {
        if (!ACCEPTED_TYPES.has(file.type)) {
          invalid.push(file);
        } else if (file.size > MAX_FILE_BYTES) {
          oversized.push(file);
        } else {
          accepted.push(file);
        }
      }

      const slots = Number.isFinite(remainingSlots)
        ? Math.max(0, Math.floor(remainingSlots))
        : accepted.length;
      const withinCapacity = accepted.slice(0, slots);
      const messages: string[] = [];

      if (invalid.length > 0) {
        messages.push(
          `${pluralise(invalid.length, "file")} skipped — use JPG, PNG or PDF.`
        );
      }
      if (oversized.length > 0) {
        messages.push(
          `${pluralise(oversized.length, "file")} over the 5 MB limit.`
        );
      }
      if (accepted.length > withinCapacity.length) {
        messages.push(
          `Only ${pluralise(slots, "slot")} left — added the first ${withinCapacity.length}.`
        );
      }

      if (withinCapacity.length === 0) {
        reportError(messages.join(" ") || "No valid receipts selected.");
        return;
      }

      setIsCompressing(true);
      const processed: File[] = [];

      try {
        for (const file of withinCapacity) {
          const isImage = file.type === "image/jpeg" || file.type === "image/png";
          if (!isImage) {
            processed.push(file);
            continue;
          }

          const quality = file.size > 3 * 1024 * 1024 ? 70 : 80;
          let optimised: File | null = null;

          try {
            optimised = await optimizeImageForUpload(file, 1500, quality);
          } catch {
            optimised = null;
          }

          if (!optimised) {
            try {
              const compressed = await imageCompression(file, {
                maxSizeMB: 1,
                maxWidthOrHeight: 1500,
                useWebWorker: true,
              });
              optimised = new File([compressed], file.name, {
                type: file.type,
                lastModified: file.lastModified,
              });
            } catch {
              optimised = file;
            }
          }

          processed.push(optimised || file);
        }

        const added = await addToBatchQueue(processed, categoryId);
        if (Array.isArray(added) && added.length === 0) {
          messages.push("The batch could not be added. Check your plan limit.");
        }
      } catch {
        messages.push("The batch could not be added. Check your plan limit.");
      } finally {
        setIsCompressing(false);
      }

      if (messages.length > 0) reportError(messages.join(" "));
    },
    [addToBatchQueue, categoryId, remainingSlots, reportError]
  );

  return { isCompressing, error, clearError, handleFiles };
}
