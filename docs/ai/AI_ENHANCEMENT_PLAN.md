# AI Enhancement Plan: Model Selection & Processing Options

This document outlines the implementation plan for enhancing our receipt processing application with flexible AI model selection, support for vision LLMs, comparison of extraction methods, and advanced processing options.

## Goals

1. ✅ Allow users to select different LLM models (text-based and vision-based) for receipt processing.
2. ✅ Support vision LLMs or AI that can read images to extract data directly.
3. ✅ Utilize vision LLM-extracted data to compare with OCR-processed data and provide suggestions for improved accuracy.
4. ✅ Support comparison of OCR results for additional accuracy enhancements.
5. ✅ Maintain an elegant, uncluttered user experience.
6. ✅ Create a flexible architecture for future AI enhancements.

## Implementation Plan

### Phase 1: Backend - Model Selection Framework ✅

1. ✅ **Update `enhance-receipt-data` Function**
   - ✅ Add a `ModelConfig` interface and an available models registry with support for text and vision capabilities.
   - ✅ Modify the function to accept a model parameter and either text (from OCR) or image inputs based on the model type.
   - ✅ Implement model-specific API call handlers for text-based and vision-based inputs, ensuring standardized output.
   - ✅ Update logging to track model performance across both text and vision processing.

2. ✅ **Update `process-receipt` Function**
   - ✅ Modified to accept parameters: `modelId` for AI Vision processing (deprecated: `primaryMethod` and `compareWithAlternative`).
   - ✅ Now exclusively uses `'ai-vision'` method, passing images directly to `enhance-receipt-data` with the selected vision model.
   - ✅ Legacy comparison functionality has been deprecated as the application now uses AI Vision exclusively.
   - ✅ Simplified processing pipeline focuses on single AI Vision method for optimal performance and consistency.
   - ✅ Update the response format to include the primary extraction, alternative extraction (if applicable), discrepancies, and the model used.

3. ✅ **Environment Configuration**
   - ✅ Add API keys for all supported models, including those with vision capabilities.
   - ✅ Configure rate limiting and fallback options for both text and vision models.

### Phase 2: Frontend - User Interface ✅

1. ✅ **Create Processing Options Component**
   - ✅ Implement a dropdown for "Primary Processing Method" with options: "OCR + AI" and "AI Vision".
   - ✅ Display a model selection dropdown filtered by the chosen method (text models for "OCR + AI", vision models for "AI Vision").
   - ✅ Add a checkbox for "Compare with alternative method" to enable comparison of vision LLM and OCR outputs.
   - ✅ Include descriptions to guide users on method and model choices.

2. ✅ **Update Receipt Service**
   - ✅ Modify API calls to pass `primaryMethod`, `modelId`, and `compareWithAlternative`.
   - ✅ Handle responses containing primary extraction, alternative extraction, and discrepancies.
   - ✅ Enable UI to display discrepancies and allow user corrections.

3. ✅ **Integrate in Receipt Upload Flow**
   - ✅ Incorporate processing options into the upload component.
   - ✅ Preserve user selections in preferences for future use.
   - ✅ Provide visual indicators for processing status and highlight discrepancies for review.

### Phase 3: Monitoring & Optimization (In Progress)

1. **Add Performance Tracking** (Partially Implemented)
   - ✅ Log performance metrics for text and vision models.
   - ⏳ Track user corrections and discrepancy resolutions by method and model.
   - ✅ Measure processing time differences, especially when comparison is enabled.

2. **Implement Smart Defaults** (Future)
   - ⏳ Analyze model performance for different receipt types and image qualities.
   - ⏳ Suggest optimal primary methods and whether comparison is beneficial.
   - ⏳ Auto-enable comparison for cases with low-confidence extractions.

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
  supportsText: boolean;  // Indicates if the model can process text input
  supportsVision: boolean; // Indicates if the model can process image input
}

const AVAILABLE_MODELS = {
  'gemini-1.5-flash': {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    endpoint: 'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent',
    apiKeyEnvVar: 'GEMINI_API_KEY',
    temperature: 0.2,
    maxTokens: 1024,
    supportsText: true,
    supportsVision: true // Supports both text and vision
  },
  'gemini-1.5-pro': {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    endpoint: 'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent',
    apiKeyEnvVar: 'GEMINI_API_KEY',
    temperature: 0.1,
    maxTokens: 2048,
    supportsText: true,
    supportsVision: true // Supports both text and vision
  },
  'gemini-2.0-flash-lite': {
    id: 'gemini-2.0-flash-lite',
    name: 'Gemini 2.0 Flash Lite',
    endpoint: 'https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash-lite:generateContent',
    apiKeyEnvVar: 'GEMINI_API_KEY',
    temperature: 0.3,
    maxTokens: 2048,
    supportsText: true,
    supportsVision: true
  }
};

const DEFAULT_TEXT_MODEL = 'gemini-2.0-flash-lite';
const DEFAULT_VISION_MODEL = 'gemini-2.0-flash-lite';
```

### API Call Structure

```typescript
interface Image {
  data: Buffer; // or appropriate image data type
  mimeType: string;
}

interface ReceiptData {
  merchant: string;
  date: string;
  total: number;
  items: Array<{ name: string; price: number }>;
}

async function callAIModel(input: string | Image, modelConfig: ModelConfig, apiKey: string): Promise<ReceiptData> {
  const prompt = modelConfig.supportsVision && input instanceof Image
    ? "Extract the following information from this receipt image: merchant, date, total, items (name and price). Format as JSON."
    : "Extract the following information from this receipt text: merchant, date, total, items (name and price). Format as JSON.";
  
  if (modelConfig.id.startsWith('gemini')) {
    return callGeminiAPI(modelConfig.supportsVision && input instanceof Image ? { text: prompt, image: input } : prompt, modelConfig, apiKey);
  } else if (modelConfig.id.startsWith('claude')) {
    if (modelConfig.supportsVision && input instanceof Image) throw new Error('Claude does not support vision');
    return callClaudeAPI(prompt, modelConfig, apiKey);
  } else {
    throw new Error(`Unsupported model: ${modelConfig.id}`);
  }
}
```

### Frontend Component

✅ Implemented as `ReceiptProcessingOptions` component with the following features:
- Selection between OCR+AI and AI Vision processing methods
- Model selection based on method capabilities (including Gemini 2.0 Flash Lite)
- Option to compare results from both methods
- Detailed tooltips explaining each option

### Example API Response with Comparison

```json
{
  "primaryExtraction": {
    "merchant": "Walmart",
    "date": "2023-10-01",
    "total": 100.00,
    "items": [
      { "name": "Milk", "price": 3.00 },
      { "name": "Bread", "price": 2.00 }
    ]
  },
  "alternativeExtraction": {
    "merchant": "Wal-Mart",
    "date": "2023-10-01",
    "total": 100.00,
    "items": [
      { "name": "Milk", "price": 3.00 },
      { "name": "Bread", "price": 2.00 }
    ]
  },
  "discrepancies": [
    {
      "field": "merchant",
      "primaryValue": "Walmart",
      "alternativeValue": "Wal-Mart"
    }
  ],
  "modelUsed": "gemini-2.0-flash-lite"
}
```

## User Experience Considerations

1. ✅ **Default Selection**: Using "OCR + AI" with Gemini 2.0 Flash Lite as the new default model for speed and capability.
2. ✅ **Clear Descriptions**: Added tooltips explaining "OCR + AI" vs. "AI Vision" and the benefits of comparison.
3. ✅ **Visual Feedback**: Processing status is displayed with appropriate indicators and progress tracking.
4. ✅ **Performance Expectations**: Users are notified that enabling comparison may increase processing time.
5. ✅ **Preference Saving**: The system remembers user preferences for method, model, and comparison settings.

## Testing Plan

1. **Unit Tests**: Verify model selection, input handling (text vs. image), and discrepancy detection. ⏳
2. **Integration Tests**: Test end-to-end flows for "OCR + AI", "AI Vision", and comparison modes. ⏳
3. **Performance Testing**: Measure processing times with and without comparison enabled. ⏳
4. **User Testing**: Collect feedback on UI clarity, comparison usefulness, and correction workflow. ⏳

## Deployment Strategy

1. ✅ Deploy backend updates with vision model support first.
2. ✅ Roll out UI changes to a beta group for initial feedback.
3. ⏳ Monitor performance, costs, and user interactions.
4. ⏳ Proceed with full deployment after validation and adjustments.

## Future Enhancements

1. **Model Auto-Selection**: Automatically select the best method and model based on receipt type or image quality.
2. **Hybrid Processing**: Combine multiple models (e.g., ensemble methods) for higher accuracy.
3. **Custom Models**: Enable enterprise users to integrate custom fine-tuned models.
4. **Feedback Loop**: Use discrepancy resolutions and user corrections to refine model performance over time.

---

### Explanation of New Features Implementation Status

1. ✅ **Support for Vision LLMs**
   - Added `supportsVision` and `supportsText` flags to `ModelConfig` to distinguish model capabilities.
   - Updated `enhance-receipt-data` and `callAIModel` to handle image inputs for vision LLMs, enabling direct data extraction from receipt images.
   - Implemented "AI Vision" as a primary processing method in the UI, with model filtering based on vision support.

2. ✅ **Comparison with Alternative Processing Methods** (DEPRECATED - AI-only processing)
   - Previously added `compareWithAlternative` option to run both vision LLM and text model extractions when enabled.
   - Implemented comparison logic in `process-receipt` to identify discrepancies and return them in the API response.
   - Enhanced the UI to display discrepancies and allow users to review and correct data, fulfilling the suggestion requirement.
   - NOTE: This feature is deprecated as the application now uses AI Vision exclusively.

3. ✅ **Database Schema Updates**
   - Added new columns to the receipts table:
     - `model_used`: Tracks which AI model was used
     - `primary_method`: Records the AI processing method used (deprecated field)
     - `has_alternative_data`: Indicates if comparison data is available
     - `discrepancies`: Stores identified differences between primary and alternative methods

4. ✅ **Types and Interfaces**
   - Updated `Receipt`, `ReceiptWithDetails`, and `OCRResult` interfaces to include new fields for AI model selection and comparison features.
   - Added proper typing for processing methods, results, and discrepancies.

5. ✅ **Model Registry Update**
   - Added `gemini-2.0-flash-lite` to the list of available models in both frontend (`ReceiptProcessingOptions`) and backend (`enhance-receipt-data`).
   - Updated the default model for both text and vision processing to `gemini-2.0-flash-lite` in the backend and frontend components (`UploadZone`, `ReceiptProcessingOptions`).

These updates have successfully implemented all core features outlined in the original enhancement plan while maintaining an elegant user experience and creating a flexible foundation for future improvements.