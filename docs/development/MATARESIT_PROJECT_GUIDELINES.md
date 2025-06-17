# Mataresit Project Guidelines

## Overview

This document provides comprehensive guidelines for developing and maintaining the Mataresit (formerly Paperless Maverick) receipt management application. These guidelines are based on analysis of the existing codebase and established architectural patterns.

## Augment Agent Core Principles

### CORE Development Tools & Practices
- **Use Task Manager** for structured workflow management and approval-based development
- **Use Sequential Thinking** for complex problem analysis and step-by-step reasoning
- **Use Context7** for accessing up-to-date library documentation and best practices
- **Use desktop-commander and vertex-ai-mcp-server** for file operations and terminal tasks
- **Use Supabase MCP tools** for all database operations and queries
- **Use GitHub MCP tools** for version control operations
- **Write modular code** with clear separation of concerns; use 'services' directory for client-API interactions
- **Supabase Project ID**: `mpmkbtsufihzdelrlszs` (production - handle with extreme care)
- **CRITICAL**: Never reset or modify the remote production database

### RESPONSE Quality Standards
- **No Hallucination**: If information is unknown or uncertain, explicitly state "I don't know"
- **Be Specific**: Provide concrete, actionable answers rather than vague responses
- **Explain Mistakes**: When errors occur, analyze the actual code/actions, identify root causes, and provide specific examples
- **Code First**: Always examine existing code before making claims or assumptions about functionality
- **Handle Uncertainty**: Clearly state uncertainties, verify with appropriate tools, and explain the verification process
- **No Assumptions**: Never assume project structure, user preferences, or configurations without verification
- **Analyze Mistakes**: Provide detailed feedback on errors with specific examples and corrections
- **Verify Assumptions**: Stop and verify any assumptions using codebase-retrieval or other tools

### CODEBASE Interaction Protocols
- **Pre-Change Analysis**: Always use codebase-retrieval before making any code changes
- **Understand Context**: Analyze dependencies, imports, and related components before modifications
- **For Each Change**: Retrieve relevant files, check existing patterns, and understand the impact
- **File Edits**: View the entire file structure and identify all affected elements before editing
- **Verify Imports**: Ensure all imports are correct and dependencies exist before submitting changes
- **Check for Existing Functions**: Before creating new functions, search for similar existing implementations
- **No Blind Copy**: Understand and adapt any copied code to fit the project's patterns and requirements

### Systematic Development Workflow
```typescript
// Pattern: Structured development approach
1. **Information Gathering**
   - Use codebase-retrieval to understand current implementation
   - Analyze requirements and identify affected components
   - Check for existing similar functionality

2. **Planning Phase**
   - Create detailed plan with specific file changes
   - Identify dependencies and potential impacts
   - Get user approval before proceeding

3. **Implementation Phase**
   - Make changes systematically, one component at a time
   - Test each change before proceeding to the next
   - Request approval after completing each major component

4. **Verification Phase**
   - Verify all imports and dependencies
   - Test functionality through actual usage
   - Document any changes or new patterns introduced
```

## Technical Stack

### Core Technologies
- **Frontend**: React 18 + TypeScript 5.x + Vite
- **Styling**: Tailwind CSS 3.x + Radix UI components
- **Backend**: Supabase (PostgreSQL 15 + Edge Functions)
- **Authentication**: Supabase Auth with Google OAuth
- **Payments**: Stripe integration
- **AI Processing**: Google Gemini 2.0 Flash Lite (default)
- **State Management**: React Context + useReducer for complex state
- **Routing**: React Router 6
- **Internationalization**: i18next with English/Malay support

## 1. Database Patterns

### Migration Conventions
```sql
-- Follow naming pattern: YYYYMMDDHHMMSS_descriptive_name.sql
-- Example: 20250617030000_add_malaysian_cultural_adaptations.sql

-- Always include rollback comments
-- Emergency rollback script (if needed)
-- Note: Production data must be preserved
```

### RLS (Row Level Security) Policies
- **Always enable RLS** on new tables: `ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;`
- **Standard patterns**:
  - User data: `auth.uid() = user_id`
  - Admin access: `auth.users.raw_user_meta_data->>'role' = 'admin'`
  - Public read: `FOR SELECT USING (true)`

### JSONB Usage Patterns
```typescript
// Consistent JSONB field patterns
interface ReceiptData {
  ai_suggestions: AISuggestions;
  confidence_scores: ConfidenceScore;
  line_items: LineItem[];
  processing_metadata: ProcessingMetadata;
}
```

## 2. State Management

### useReducer for Complex State
```typescript
// Pattern: Use reducers for multi-step processes
const [state, dispatch] = useReducer(batchUploadReducer, initialBatchState);

// Actions should be descriptive and typed
type BatchUploadAction = 
  | { type: 'START_PROCESSING' }
  | { type: 'UPDATE_UPLOAD_PROGRESS'; payload: { id: string; progress: number } }
  | { type: 'COMPLETE_UPLOAD'; payload: { id: string; receiptId: string } };
```

### React Context to Avoid Prop Drilling
```typescript
// Pattern: Nested context providers in App.tsx
<AuthProvider>
  <LanguageProvider>
    <TeamProvider>
      <StripeProvider>
        <ChatControlsProvider>
          {/* App content */}
        </ChatControlsProvider>
      </StripeProvider>
    </TeamProvider>
  </LanguageProvider>
</AuthProvider>
```

## 3. UI/UX Consistency

### Component Composition
```typescript
// Use compound component patterns
<Card>
  <CardHeader>
    <CardTitle>Receipt Details</CardTitle>
  </CardHeader>
  <CardContent>
    {/* Content */}
  </CardContent>
</Card>
```

### Tailwind CSS Patterns
```typescript
// Consistent utility class patterns
const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
      },
    },
  }
);
```

### Mobile-First Responsive Design
```typescript
// Pattern: Mobile-first breakpoints
className="flex flex-col lg:flex-row gap-4 p-4 lg:p-6"
```

## 4. Authentication & Authorization

### Role-Based Access Control
```typescript
// Pattern: Consistent role checking
export type AppRole = 'admin' | 'user';

interface UserWithRole extends User {
  roles?: AppRole[];
  subscription_tier?: SubscriptionTier;
}

// Usage in components
const { user, isAdmin } = useAuth();
if (!isAdmin) return <Navigate to="/dashboard" />;
```

### Subscription Enforcement
```typescript
// Pattern: Backend validation for all limits
const result = await SubscriptionEnforcementService.canUploadBatch(
  batchSize, 
  averageFileSizeMB
);

if (!result.allowed) {
  toast.error(result.reason);
  return;
}
```

## 5. Error Handling

### Consistent Error Patterns
```typescript
// Pattern: Graceful error handling with user feedback
try {
  const result = await processReceipt(receiptId);
  toast.success('Receipt processed successfully');
} catch (error) {
  console.error('Processing error:', error);
  
  let errorMessage = 'An unexpected error occurred';
  if (error instanceof Error) {
    errorMessage = error.message;
    
    // Check for common error patterns
    if (errorMessage.includes('OPENAI_API_KEY')) {
      errorMessage = 'Missing API key configuration';
    }
  }
  
  toast.error(errorMessage);
}
```

### Toast Notification Standards
```typescript
// Use Sonner for consistent notifications
import { toast } from "sonner";

// Success: Green, brief message
toast.success('Receipt uploaded successfully');

// Error: Red, descriptive message with action if possible
toast.error('Upload failed. Please try again.', {
  action: {
    label: 'Retry',
    onClick: () => retryUpload(),
  },
});

// Info: Blue, for status updates
toast.info('Processing receipt...');
```

## 6. Performance Optimization

### Image Optimization
```typescript
// Pattern: Always optimize images before upload
const optimizedFile = await optimizeImageForUpload(
  file,
  maxWidth: 1500,
  quality: 80
);
```

### Batch Processing Patterns
```typescript
// Pattern: Concurrent processing with limits
const maxConcurrent = 2; // Prevent overwhelming the system
const processingQueue = new Map<string, Promise<boolean>>();

// Process in batches with proper error handling
for (const batch of chunks(files, maxConcurrent)) {
  await Promise.allSettled(
    batch.map(file => processFile(file))
  );
}
```

### Streaming Responses
```typescript
// Pattern: Real-time updates for long-running processes
const subscription = supabase
  .channel(`receipt-${receiptId}`)
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'receipts',
    filter: `id=eq.${receiptId}`,
  }, (payload) => {
    updateReceiptStatus(payload.new);
  })
  .subscribe();
```

## 7. Security Patterns

### Data Validation
```typescript
// Pattern: Use Zod for runtime validation
import { z } from 'zod';

const ReceiptSchema = z.object({
  merchant: z.string().min(1).max(255),
  total: z.number().positive(),
  date: z.string().datetime(),
  category: z.string().optional(),
});

// Validate before processing
const validatedData = ReceiptSchema.parse(rawData);
```

### Secure API Patterns
```typescript
// Pattern: Always validate user permissions in Edge Functions
const authHeader = req.headers.get('Authorization');
if (!authHeader) {
  return new Response('Unauthorized', { status: 401 });
}

const supabase = supabaseClient(authHeader);
const { data: { user }, error } = await supabase.auth.getUser();
if (error || !user) {
  return new Response('Invalid token', { status: 401 });
}
```

### Environment Variables
```typescript
// Pattern: Secure environment variable handling
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://mpmkbtsufihzdelrlszs.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "fallback_key";

// Never expose sensitive keys in client-side code
// Use Supabase environment variables for Edge Functions
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
```

## 8. Edge Functions Patterns

### Function Structure
```typescript
// Pattern: Consistent Edge Function structure
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { ProcessingLogger } from '../_shared/db-logger.ts';
import { supabaseClient } from '../_shared/supabase-client.ts';

serve(async (req: Request) => {
  const logger = new ProcessingLogger('function-name');

  try {
    // Validate request
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    const supabase = supabaseClient(authHeader);

    // Process request
    const body = await req.json();
    const result = await processRequest(body);

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    logger.error('Function error', { error: error.message });
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
```

### Retry Logic with Exponential Backoff
```typescript
// Pattern: Resilient API calls
async function callWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) throw error;

      const delay = baseDelay * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Max retries exceeded');
}
```

## 9. AI Processing Patterns

### Model Configuration
```typescript
// Pattern: Centralized model configuration
export const AVAILABLE_MODELS = {
  'gemini-2.0-flash-lite': {
    name: 'Gemini 2.0 Flash Lite',
    provider: 'google',
    isVisionCapable: true,
    isDefault: true,
    maxTokens: 8192,
  },
  'gemini-1.5-pro': {
    name: 'Gemini 1.5 Pro',
    provider: 'google',
    isVisionCapable: true,
    isDefault: false,
    maxTokens: 2097152,
  },
} as const;
```

### Fallback Strategies
```typescript
// Pattern: Intelligent fallback processing
const fallbackStrategy = {
  primaryMethod: 'ai-vision',
  primaryModel: 'gemini-2.0-flash-lite',
  fallbackMethod: 'ai-vision',
  fallbackModel: 'gemini-1.5-pro',
  maxAttempts: 3,
};

// Implement graceful degradation
if (primaryProcessingFails) {
  await switchToFallbackMethod();
  toast.info('Switching to backup processing method...');
}
```

## 10. Internationalization (i18n)

### Translation Key Conventions
```typescript
// Pattern: Hierarchical key structure
const translations = {
  common: {
    buttons: {
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
    },
  },
  dashboard: {
    receipts: {
      upload_success: 'Receipt uploaded successfully',
      upload_error: 'Failed to upload receipt',
    },
  },
  admin: {
    users: {
      role_updated: 'User role updated',
    },
  },
};

// Usage with context-aware suffixes
const key = `dashboard.receipts.upload_${isAdmin ? 'admin' : 'user'}`;
```

### Cultural Adaptations
```typescript
// Pattern: Malaysian business context
const malaysianBusinessPatterns = {
  taxTypes: ['GST', 'SST', 'Service Tax'],
  currencies: ['MYR', 'USD', 'SGD'],
  dateFormats: {
    display: 'DD/MM/YYYY',
    api: 'YYYY-MM-DD',
  },
  businessHours: {
    standard: '09:00-18:00',
    retail: '10:00-22:00',
  },
};
```

## 11. Testing Strategy

### Preference for Real Usage Testing
```typescript
// Pattern: Test through actual user workflows
// Preferred: Manual testing of complete user journeys
// 1. Upload receipt → 2. Review data → 3. Save changes → 4. Verify storage

// Avoid: Isolated unit tests for complex integrations
// Instead: Integration testing with real Supabase connections
```

### Component Testing Patterns
```typescript
// Pattern: Test user interactions, not implementation details
import { render, screen, fireEvent } from '@testing-library/react';

test('receipt upload workflow', async () => {
  render(<UploadZone />);

  const fileInput = screen.getByLabelText(/upload receipt/i);
  const file = new File(['receipt'], 'receipt.jpg', { type: 'image/jpeg' });

  fireEvent.change(fileInput, { target: { files: [file] } });

  // Test the complete workflow, not just file selection
  expect(await screen.findByText(/processing/i)).toBeInTheDocument();
});
```

## 12. Deployment Patterns

### Systematic Phase-by-Phase Implementation
```typescript
// Pattern: Explicit approval workflow
interface DeploymentPhase {
  name: string;
  description: string;
  prerequisites: string[];
  tasks: DeploymentTask[];
  rollbackPlan: string;
}

// Example implementation phases
const phases: DeploymentPhase[] = [
  {
    name: 'Database Schema Updates',
    description: 'Apply new migrations and RLS policies',
    prerequisites: ['Backup created', 'Staging tested'],
    tasks: [
      { name: 'Apply migrations', command: 'supabase db push' },
      { name: 'Verify RLS policies', command: 'npm run test:rls' },
    ],
    rollbackPlan: 'Revert migrations using emergency rollback script',
  },
  // ... more phases
];
```

### Git Commit Workflow
```bash
# Pattern: Conventional commit format with systematic analysis
git add .
git commit -m "feat(receipts): add batch upload with subscription limits

- Implement tiered batch limits (Free: 5, Pro: 50, Max: 100)
- Add concurrent upload processing with 2-file limit
- Integrate subscription enforcement service
- Add progress tracking with real-time updates

Closes #123"

# Require explicit approval before pushing
git push origin feature/batch-upload
```

## 13. Package Management

### Always Use Package Managers
```bash
# ✅ Correct: Use package managers for dependency management
npm install @supabase/supabase-js
yarn add react-query
pnpm add @radix-ui/react-dialog

# ❌ Incorrect: Never manually edit package.json
# Manual edits can cause version conflicts and dependency issues
```

### Dependency Patterns
```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.7.1",
    "react": "^18.2.0",
    "react-query": "^4.29.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "typescript": "^5.0.0",
    "vite": "^4.3.0"
  }
}
```

## 14. Code Organization

### Directory Structure
```
src/
├── components/           # Reusable UI components
│   ├── ui/              # Base UI components (Radix + Tailwind)
│   └── features/        # Feature-specific components
├── contexts/            # React Context providers
├── hooks/               # Custom React hooks
├── lib/                 # Utility functions and configurations
├── pages/               # Route components
├── services/            # API and business logic
├── types/               # TypeScript type definitions
└── utils/               # Pure utility functions

supabase/
├── functions/           # Edge Functions
│   ├── _shared/        # Shared utilities for Edge Functions
│   └── [function-name]/ # Individual function directories
└── migrations/          # Database migrations
```

### Import Conventions
```typescript
// Pattern: Consistent import ordering
import React from 'react';                    // External libraries
import { useAuth } from '@/contexts/AuthContext'; // Internal contexts/hooks
import { Button } from '@/components/ui/button';   // UI components
import { receiptService } from '@/services/receiptService'; // Services
import type { Receipt } from '@/types/receipt';    // Types (with 'type' keyword)
```

## 15. Key Architectural Decisions

### Single Supabase Client Instance
```typescript
// ✅ Correct: Use single client instance across app
import { supabase } from "@/integrations/supabase/client";

// ❌ Incorrect: Creating multiple client instances
// This breaks authentication state management
```

### Subscription Limits Enforcement
```typescript
// Pattern: Always check limits on both frontend and backend
// Frontend: Immediate user feedback
const canUpload = await SubscriptionEnforcementService.canUploadBatch(files.length);
if (!canUpload.allowed) {
  toast.error(canUpload.reason);
  return;
}

// Backend: Secure enforcement in Edge Functions
const { data: limits } = await supabase.rpc('can_perform_action', {
  _action: 'upload_batch',
  _payload: { batch_size: files.length }
});
```

### Production Data Protection
```typescript
// ⚠️ CRITICAL: Never modify production database (mpmkbtsufihzdelrlszs)
// All development must use local Supabase instance
// Production data must be preserved at all costs

// ✅ Correct: Local development
const SUPABASE_URL = "http://127.0.0.1:54321";

// ❌ Forbidden: Direct production access during development
// const SUPABASE_URL = "https://mpmkbtsufihzdelrlszs.supabase.co";
```

---

## Summary

These guidelines ensure:
- **Augment Agent Excellence**: Structured workflows, quality responses, and systematic codebase interaction
- **Consistency**: Standardized patterns across the codebase
- **Security**: Proper authentication, authorization, and data validation
- **Performance**: Optimized image processing, batch operations, and real-time updates
- **Maintainability**: Clear code organization and systematic deployment processes
- **User Experience**: Responsive design, proper error handling, and cultural adaptations
- **Production Safety**: Protection of live data and systematic change management
- **Quality Assurance**: No hallucination, specific responses, and thorough verification

Follow these patterns to maintain code quality, ensure accurate AI assistance, and enable smooth development workflows in the Mataresit application.
