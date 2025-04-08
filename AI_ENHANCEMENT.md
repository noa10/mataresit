# AI Enhancement Plan: Model Selection & Processing Options

This document outlines the implementation plan for enhancing our receipt processing application with flexible AI model selection and advanced processing options.

## Goals

1. Allow users to select different LLM models for receipt processing
2. Support comparison of OCR results for improved accuracy
3. Maintain an elegant, uncluttered user experience
4. Create a flexible architecture for future AI enhancements

## Implementation Plan

### Phase 1: Backend - Model Selection Framework

1. **Update `enhance-receipt-data` Function**
   - Add model configuration interface and available models registry
   - Modify function to accept model parameter
   - Implement model-specific API call handlers
   - Update logging to track model performance

2. **Update `process-receipt` Function**
   - Modify to accept and pass model selection parameter
   - Add OCR comparison option
   - Update response format to include model used

3. **Environment Configuration**
   - Add necessary API keys for all supported models
   - Configure rate limiting and fallback options

### Phase 2: Frontend - User Interface

1. **Create Model Selection Component**
   - Implement dropdown with available models
   - Include helpful descriptions for each model
   - Show appropriate UI based on selected model

2. **Update Receipt Service**
   - Modify API calls to pass model parameters
   - Add support for OCR comparison option
   - Handle model-specific response formats

3. **Integrate in Receipt Upload Flow**
   - Add options UI to upload component
   - Preserve selections in user preferences
   - Show appropriate processing indicators

### Phase 3: Monitoring & Optimization

1. **Add Performance Tracking**
   - Log model performance metrics
   - Track user corrections by model
   - Measure processing time differences

2. **Implement Smart Defaults**
   - Analyze which models perform best for different receipt types
   - Suggest optimal model based on image quality
   - Auto-select comparison option when needed

## Technical Details

### Model Configuration

```typescript
interface ModelConfig {
  id: string;
  name: string;
  endpoint: string;
  apiKeyEnvVar: string;
  temperature: number;
  maxTokens: number;
}

const AVAILABLE_MODELS = {
  'gemini-1.5-flash': {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    endpoint: 'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent',
    apiKeyEnvVar: 'GEMINI_API_KEY',
    temperature: 0.2,
    maxTokens: 1024
  },
  'gemini-1.5-pro': {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    endpoint: 'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent',
    apiKeyEnvVar: 'GEMINI_API_KEY',
    temperature: 0.1,
    maxTokens: 2048
  },
  'claude-3-5-sonnet': {
    id: 'claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    endpoint: 'https://api.anthropic.com/v1/messages',
    apiKeyEnvVar: 'ANTHROPIC_API_KEY',
    temperature: 0.3,
    maxTokens: 1024
  }
}
```

### API Call Structure

```typescript
async function callAIModel(prompt: string, modelConfig: ModelConfig, apiKey: string) {
  if (modelConfig.id.startsWith('gemini')) {
    return callGeminiAPI(prompt, modelConfig, apiKey);
  } else if (modelConfig.id.startsWith('claude')) {
    return callClaudeAPI(prompt, modelConfig, apiKey);
  } else {
    throw new Error(`Unsupported model: ${modelConfig.id}`);
  }
}
```

### Frontend Component

```tsx
interface ReceiptProcessingOptionsProps {
  onModelChange: (modelId: string) => void;
  defaultModel?: string;
}

export const ReceiptProcessingOptions: React.FC<ReceiptProcessingOptionsProps> = ({
  onModelChange,
  defaultModel = 'gemini-1.5-flash'
}) => {
  const [selectedModel, setSelectedModel] = useState(defaultModel);
  
  // Component implementation...
}
```

## User Experience Considerations

1. **Default Selection**: Use Gemini 1.5 Flash as the default for balance of speed and accuracy
2. **Clear Descriptions**: Provide clear guidance on when to use each model
3. **Visual Feedback**: Show processing status with model-specific indicators
4. **Performance Expectations**: Set appropriate expectations for processing time
5. **Preference Saving**: Remember user's preferred model for future uploads

## Testing Plan

1. **Unit Tests**: Verify model selection logic and API handlers
2. **Integration Tests**: Test end-to-end flow with different models
3. **Performance Testing**: Measure and compare processing times
4. **User Testing**: Gather feedback on UI clarity and usefulness

## Deployment Strategy

1. Deploy backend changes first
2. Roll out UI changes to a subset of users
3. Monitor performance and adjust as needed
4. Full deployment after validation

## Future Enhancements

1. **Model Auto-Selection**: Automatically choose the best model based on receipt type
2. **Hybrid Processing**: Use multiple models and combine results
3. **Custom Models**: Allow enterprise customers to use their own fine-tuned models
4. **Feedback Loop**: Train models on user corrections over time