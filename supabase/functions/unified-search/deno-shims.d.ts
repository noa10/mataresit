// Type declarations to satisfy TypeScript when editing Supabase Edge Functions
// running in the Deno runtime.

// 1. Remote ESM import used in edge functions
//    We declare it as `any` so the IDE / tsc stops complaining about missing
//    type declarations. If you need proper types, install the real package
//    locally and update this file accordingly.
declare module 'https://esm.sh/@google/generative-ai@0.1.3' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export class GoogleGenerativeAI {
    constructor(apiKey: string);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getGenerativeModel(options: any): any;
  }
}

// 2. Global `Deno` object available in edge-function runtime.
//    We only expose the parts used in this codebase.
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};
