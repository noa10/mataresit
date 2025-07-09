# Gemini 2.5 Flash Lite Preview Model Fallback Fix

## Problem Summary

The `gemini-2.5-flash-lite-preview-06-17` model was returning a 404 error when users selected it for AI vision processing. The error message indicated:

```
models/gemini-2.5-flash-lite-preview-06-17 is not found for API version v1, or is not supported for generateContent
```

This caused receipt processing to fail completely for users who selected this model.

## Root Cause Analysis

1. **Model Availability**: The `gemini-2.5-flash-lite-preview-06-17` model appears to be temporarily unavailable or deprecated in the Google Gemini API
2. **No Fallback**: The system didn't have a robust fallback mechanism for this specific model failure
3. **User Experience**: Users experienced complete processing failure instead of graceful degradation

## Solution Implemented

### 1. Enhanced Error Handling in `callGeminiAPI`

Added specific 404 error handling for the problematic model with automatic fallback:

```typescript
} else if (response.status === 404 && modelConfig.id === 'gemini-2.5-flash-lite-preview-06-17') {
  // Specific handling for the problematic model
  await logger.log(`🔄 MODEL UNAVAILABLE: ${modelConfig.id} is not available`, "ERROR");
  await logger.log(`💡 AUTOMATIC FALLBACK: Switching to gemini-2.5-flash`, "ERROR");
  
  // Use fallback model
  const fallbackModelConfig = AVAILABLE_MODELS['gemini-2.5-flash'];
  if (fallbackModelConfig) {
    await logger.log(`🚀 FALLBACK ATTEMPT: Retrying with ${fallbackModelConfig.name}`, "AI");
    return await callGeminiAPI(input, fallbackModelConfig, apiKey, logger);
  }
}
```

### 2. Updated Model Configuration

- Marked the problematic model as deprecated in both frontend and backend configurations
- Reduced reliability score from 0.92 to 0.50 to discourage selection
- Updated description to warn users about the deprecation

### 3. Enhanced Fallback Strategy

Updated the fallback processing service to include specific fallback for the problematic model:

```typescript
// Specific fallback for problematic model
'gemini-2.5-flash-lite-preview-06-17': 'gemini-2.5-flash',
```

### 4. Model Tracking Enhancement

Enhanced the system to track which model was actually used vs. requested:

- Modified `callAIModel` to return both result and actual model used
- Updated response to include both `model_used` (actual) and `model_requested` (original)
- Added comprehensive logging for fallback scenarios

## Files Modified

1. **`supabase/functions/enhance-receipt-data/index.ts`**
   - Added 404 error handling with automatic fallback
   - Enhanced model tracking and logging
   - Updated function signatures to return model information

2. **`src/config/modelProviders.ts`**
   - Marked problematic model as deprecated
   - Reduced reliability score
   - Updated description with warning

3. **`src/services/fallbackProcessingService.ts`**
   - Added specific fallback mapping for problematic model

## Testing

### Automated Test Script

Created `test-model-fallback.js` to verify the fallback mechanism works correctly.

### Manual Testing Steps

1. **Test Fallback Mechanism**:
   - Select "Gemini 2.5 Flash Lite Preview" in the UI
   - Upload a receipt image
   - Verify processing completes successfully
   - Check logs to confirm fallback to `gemini-2.5-flash`

2. **Verify Response Format**:
   - Check that response includes both `model_used` and `model_requested`
   - Confirm `model_used` shows the fallback model when fallback occurs

3. **Check User Experience**:
   - Ensure no error messages are shown to users
   - Verify processing appears seamless despite fallback

## Expected Behavior

### Before Fix
- User selects "Gemini 2.5 Flash Lite Preview"
- Processing fails with 404 error
- Receipt processing status shows as failed
- User sees error message

### After Fix
- User selects "Gemini 2.5 Flash Lite Preview"
- System automatically falls back to "Gemini 2.5 Flash"
- Processing completes successfully
- User sees successful processing
- Logs show fallback occurred (for debugging)

## Monitoring and Logging

The enhanced logging provides detailed information about:

1. **Model Selection**: Which model was requested vs. selected
2. **Fallback Triggers**: When and why fallbacks occur
3. **API Responses**: Detailed error information for debugging
4. **Performance**: Timing information for each step

### Key Log Messages to Monitor

- `🔄 MODEL UNAVAILABLE: gemini-2.5-flash-lite-preview-06-17 is not available`
- `💡 AUTOMATIC FALLBACK: Switching to gemini-2.5-flash`
- `🚀 FALLBACK ATTEMPT: Retrying with Gemini 2.5 Flash`

## Future Recommendations

1. **Model Health Monitoring**: Implement periodic checks for model availability
2. **User Notification**: Consider notifying users when their preferred model is unavailable
3. **Model Updates**: Regularly review and update model configurations based on API changes
4. **Fallback Hierarchy**: Implement multi-level fallback chains for better resilience

## Deployment Notes

1. Deploy the updated edge function to Supabase
2. Update frontend configuration
3. Monitor logs for successful fallback operations
4. Consider updating user documentation about model availability

## Rollback Plan

If issues arise, the changes can be rolled back by:
1. Reverting the edge function to previous version
2. Restoring original model configurations
3. The fallback mechanism is additive and shouldn't break existing functionality
