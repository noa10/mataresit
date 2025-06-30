# Personalization System Integration Guide

## Overview

This guide provides developers with comprehensive information on integrating and extending Mataresit's personalization system. The system consists of five main components that work together to provide intelligent, adaptive user experiences.

## Architecture Overview

### Core Components

1. **User Preference Learning System** (`preferenceLearningService.ts`)
2. **Conversation Memory Service** (`conversationMemoryService.ts`)
3. **Personalized Chat Service** (`personalizedChatService.ts`)
4. **Analytics Service** (`analyticsService.ts`)
5. **Personalization Context** (`PersonalizationContext.tsx`)

### Database Schema

```sql
-- User personalization profiles
user_personalization_profiles (
  user_id UUID PRIMARY KEY,
  preferences JSONB,
  behavioral_patterns JSONB,
  profile_completeness TEXT,
  last_updated TIMESTAMP
);

-- User interactions tracking
user_interactions (
  id UUID PRIMARY KEY,
  user_id UUID,
  interaction_type TEXT,
  interaction_context JSONB,
  timestamp TIMESTAMP,
  session_id TEXT
);

-- Conversation memory
conversation_memory (
  id UUID PRIMARY KEY,
  user_id UUID,
  memory_type TEXT,
  memory_key TEXT,
  memory_data JSONB,
  confidence_score NUMERIC,
  conversation_id TEXT,
  created_at TIMESTAMP
);
```

## Integration Steps

### 1. Basic Setup

#### Install Dependencies

The personalization system uses existing Mataresit dependencies:
- React Context for state management
- Supabase for data persistence
- TypeScript for type safety

#### Add PersonalizationProvider

```tsx
// App.tsx
import { PersonalizationProvider } from '@/contexts/PersonalizationContext';

function App() {
  return (
    <AuthProvider>
      <PersonalizationProvider>
        {/* Your app components */}
      </PersonalizationProvider>
    </AuthProvider>
  );
}
```

### 2. Using Personalization in Components

#### Basic Usage

```tsx
import { usePersonalizationContext } from '@/contexts/PersonalizationContext';

function MyComponent() {
  const { 
    profile, 
    trackInteraction, 
    getAdaptiveResponseConfig 
  } = usePersonalizationContext();

  const handleUserAction = async () => {
    // Track user interaction
    await trackInteraction('ui_action', {
      component: 'MyComponent',
      action: 'button_click',
      success: true
    });
  };

  return (
    <div>
      {/* Your component JSX */}
    </div>
  );
}
```

#### Advanced Usage with Adaptive UI

```tsx
import { useAdaptiveComponent } from '@/contexts/PersonalizationContext';

function AdaptiveButton() {
  const { getAdaptiveProps } = useAdaptiveComponent('button', {
    variant: 'default',
    size: 'medium'
  });

  const adaptiveProps = getAdaptiveProps();

  return (
    <Button {...adaptiveProps}>
      Adaptive Button
    </Button>
  );
}
```

### 3. Chat Integration

#### Personalized Response Generation

```tsx
// In your chat component
import { personalizedChatService } from '@/services/personalizedChatService';

const handleSendMessage = async (message: string) => {
  // Generate personalized response
  const response = await personalizedChatService.generatePersonalizedResponse(
    message,
    searchResults,
    conversationId
  );

  // Track the interaction
  await trackChatMessage(message, conversationId);
};
```

#### Memory Integration

```tsx
import { conversationMemoryService } from '@/services/conversationMemoryService';

// Save important conversation context
await conversationMemoryService.saveMemory(
  'user_preference',
  'preferred_response_style',
  { style: 'concise', confidence: 0.8 },
  0.8,
  conversationId
);

// Retrieve conversation memory
const memories = await conversationMemoryService.getMemory(conversationId);
```

### 4. Analytics Integration

#### Track Custom Interactions

```tsx
import { usePersonalizationContext } from '@/contexts/PersonalizationContext';

function ReceiptUpload() {
  const { trackInteraction } = usePersonalizationContext();

  const handleUpload = async (file: File) => {
    const startTime = Date.now();
    
    try {
      // Your upload logic
      await uploadReceipt(file);
      
      // Track successful upload
      await trackInteraction('feature_usage', {
        feature_name: 'receipt_upload',
        duration: Date.now() - startTime,
        success: true,
        file_size: file.size
      });
    } catch (error) {
      // Track failed upload
      await trackInteraction('feature_usage', {
        feature_name: 'receipt_upload',
        duration: Date.now() - startTime,
        success: false,
        error: error.message
      });
    }
  };
}
```

#### Custom Analytics

```tsx
import { analyticsService } from '@/services/analyticsService';

// Get user analytics
const analytics = await analyticsService.getUserAnalytics('month');

// Get feature usage
const featureUsage = await analyticsService.getFeatureUsageAnalytics();

// Get personalized insights
const insights = await analyticsService.getPersonalizedInsights();
```

## Extending the System

### 1. Adding New Interaction Types

```typescript
// types/personalization.ts
export type InteractionType = 
  | 'chat_message'
  | 'search_query'
  | 'ui_action'
  | 'feature_usage'
  | 'feedback'
  | 'custom_interaction'; // Add your new type

// Track custom interaction
await trackInteraction('custom_interaction', {
  custom_field: 'value',
  timestamp: new Date().toISOString()
});
```

### 2. Custom Preference Categories

```typescript
// types/personalization.ts
export type PreferenceCategory = 
  | 'communication_style'
  | 'ui_preferences'
  | 'workflow_preferences'
  | 'notification_preferences'
  | 'custom_category'; // Add your category

// Update preferences
await updatePreference('custom_category', 'my_preference', {
  value: 'custom_value',
  confidence: 0.9
});
```

### 3. Custom Memory Types

```typescript
// Save custom memory
await conversationMemoryService.saveMemory(
  'custom_memory_type',
  'unique_key',
  { custom_data: 'value' },
  0.8,
  conversationId
);
```

### 4. Custom Analytics Functions

Create new Supabase functions for custom analytics:

```sql
-- Custom analytics function
CREATE OR REPLACE FUNCTION get_custom_analytics()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  -- Your custom analytics logic
  SELECT json_build_object(
    'custom_metric', COUNT(*)
  )
  INTO result
  FROM user_interactions
  WHERE user_id = auth.uid();

  RETURN result;
END;
$$;
```

## Best Practices

### 1. Performance Optimization

```typescript
// Batch interactions for better performance
const interactions = [
  { type: 'ui_action', context: { action: 'click' } },
  { type: 'ui_action', context: { action: 'scroll' } }
];

// Use batch tracking (if implemented)
await trackInteractionBatch(interactions);
```

### 2. Error Handling

```typescript
try {
  await trackInteraction('feature_usage', context);
} catch (error) {
  // Graceful degradation - don't break user experience
  console.warn('Personalization tracking failed:', error);
  // Continue with normal flow
}
```

### 3. Privacy Considerations

```typescript
// Always check user consent before tracking
if (userConsent.personalization) {
  await trackInteraction('ui_action', context);
}

// Provide data export functionality
const userData = await exportUserPersonalizationData();
```

### 4. Testing

```typescript
// Mock personalization context for testing
const mockPersonalizationContext = {
  profile: mockProfile,
  trackInteraction: jest.fn(),
  getAdaptiveResponseConfig: jest.fn()
};

// Test with mock context
render(
  <PersonalizationContext.Provider value={mockPersonalizationContext}>
    <YourComponent />
  </PersonalizationContext.Provider>
);
```

## API Reference

### PersonalizationContext

```typescript
interface PersonalizationContextType {
  // State
  profile: UserPersonalizationProfile | null;
  loading: boolean;

  // Actions
  trackInteraction: (type: InteractionType, context: any) => Promise<void>;
  trackChatMessage: (message: string, conversationId: string, duration?: number) => Promise<void>;
  trackSearchQuery: (query: string, type: string, resultsCount: number) => Promise<void>;
  trackUIAction: (action: string, component: string, success: boolean) => Promise<void>;
  
  // Preferences
  updatePreference: (category: PreferenceCategory, key: string, value: any) => Promise<void>;
  getPreference: (category: PreferenceCategory, key: string) => any;
  
  // Adaptive features
  getAdaptiveResponseConfig: () => AdaptiveResponseConfig;
  loadProfile: () => Promise<void>;
}
```

### Services

#### PreferenceLearningService

```typescript
class PreferenceLearningService {
  async analyzeInteraction(interaction: UserInteraction): Promise<void>;
  async updateBehavioralPatterns(userId: string, patterns: any): Promise<void>;
  async getPersonalizationProfile(userId: string): Promise<UserPersonalizationProfile>;
}
```

#### ConversationMemoryService

```typescript
class ConversationMemoryService {
  async saveMemory(type: string, key: string, data: any, confidence: number, conversationId: string): Promise<void>;
  async getMemory(conversationId: string): Promise<ConversationMemory[]>;
  async summarizeConversation(conversationId: string): Promise<string>;
}
```

#### PersonalizedChatService

```typescript
class PersonalizedChatService {
  async generatePersonalizedResponse(query: string, searchResults: any, conversationId: string): Promise<string>;
  async getPersonalizationStats(): Promise<PersonalizationStats>;
}
```

## Troubleshooting

### Common Issues

1. **Personalization not working**
   - Check PersonalizationProvider is properly wrapped
   - Verify user is authenticated
   - Ensure sufficient interaction history

2. **Memory not persisting**
   - Check conversation ID consistency
   - Verify database permissions
   - Check for RLS policy issues

3. **Analytics not updating**
   - Verify tracking calls are successful
   - Check database function permissions
   - Ensure proper error handling

### Debug Tools

```typescript
// Enable debug logging
localStorage.setItem('personalization_debug', 'true');

// Check personalization status
console.log('Profile:', profile);
console.log('Preferences:', profile?.preferences);
console.log('Behavioral patterns:', profile?.behavioral_patterns);
```

## Migration Guide

### From Basic to Personalized Components

```typescript
// Before
function BasicButton() {
  return <Button variant="default">Click me</Button>;
}

// After
function PersonalizedButton() {
  const { getAdaptiveProps } = useAdaptiveComponent('button');
  const props = getAdaptiveProps();
  
  return <Button {...props}>Click me</Button>;
}
```

### Adding Personalization to Existing Features

1. Wrap components with PersonalizationProvider
2. Add interaction tracking to user actions
3. Implement adaptive behavior based on preferences
4. Add analytics tracking for insights

## Support

For additional support:
- Check the test pages at `/test/personalization` and `/test/analytics`
- Review the integration test at `/test/integration`
- Consult the user documentation
- Contact the development team for advanced integration needs
