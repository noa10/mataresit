import { describe, expect, it } from "vitest";
import { buildProcessingRequestHeaders } from "@/services/receiptService";

describe("buildProcessingRequestHeaders", () => {
  it("includes x-groq-api-key when a Groq key is provided", () => {
    const headers = buildProcessingRequestHeaders({
      supabaseKey: "session-token",
      supabaseAnonKey: "anon-token",
      groqApiKey: "gsk_test_123",
    });

    expect(headers["Authorization"]).toBe("Bearer session-token");
    expect(headers["apikey"]).toBe("anon-token");
    expect(headers["x-groq-api-key"]).toBe("gsk_test_123");
  });

  it("omits x-groq-api-key when Groq key is missing", () => {
    const headers = buildProcessingRequestHeaders({
      supabaseKey: "",
      supabaseAnonKey: "anon-token",
      groqApiKey: null,
    });

    expect(headers["Authorization"]).toBe("Bearer anon-token");
    expect(headers["x-groq-api-key"]).toBeUndefined();
  });
});
