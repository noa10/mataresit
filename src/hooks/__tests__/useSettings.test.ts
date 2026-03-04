import { describe, expect, it } from "vitest";
import { mergeProcessingSettings, ProcessingSettings } from "@/hooks/useSettings";

describe("mergeProcessingSettings", () => {
  it("preserves latest selectedModel while merging partial userApiKeys updates", () => {
    const latestPersisted: ProcessingSettings = {
      selectedModel: "groq/meta-llama/llama-4-scout-17b-16e-instruct",
      batchModel: "groq/meta-llama/llama-4-scout-17b-16e-instruct",
      batchUpload: {
        maxConcurrent: 2,
        autoStart: false,
        timeoutSeconds: 120,
        maxRetries: 2,
      },
      userApiKeys: {
        openrouter: "or-key",
      },
      skipUploadOptimization: true,
    };

    const merged = mergeProcessingSettings(latestPersisted, {
      userApiKeys: {
        groq: "gsk_test_key",
      },
    });

    expect(merged.selectedModel).toBe("groq/meta-llama/llama-4-scout-17b-16e-instruct");
    expect(merged.userApiKeys.openrouter).toBe("or-key");
    expect(merged.userApiKeys.groq).toBe("gsk_test_key");
  });
});
