# Model Selection Flow Test Guide

## 🎯 Objective
Verify that the AI model selection issue has been resolved and that user-selected OpenRouter models are properly used instead of defaulting to `gemini-2.0-flash-lite`.

## 🔧 Test Setup

### Prerequisites
1. **Development Environment**: Ensure the app is running locally (`npm run dev`)
2. **Browser Console**: Open browser developer tools (F12)
3. **Test Model**: We'll test with `openrouter/mistralai/mistral-small-3.2-24b-instruct:free`

### Test Files
- `test-model-selection-flow.js` - Automated test script
- This guide - Manual testing instructions

## 🧪 Automated Testing

### Step 1: Run the Test Script
1. Navigate to the upload page in your browser
2. Open browser console (F12 → Console tab)
3. Copy and paste the contents of `test-model-selection-flow.js`
4. Press Enter to run the tests

### Expected Output
```
🧪 Starting Model Selection Flow Test...

📋 Test 1: Model Registry Verification
✅ Target model found: Mistral Small 3.2 24B Instruct
   Provider: openrouter
   Endpoint: https://openrouter.ai/api/v1/chat/completions

💾 Test 2: Settings Persistence
✅ Settings saved successfully: openrouter/mistralai/mistral-small-3.2-24b-instruct:free

🎯 Test 3: Processing Recommendation Generation
✅ Processing recommendation respects user preferences: openrouter/mistralai/mistral-small-3.2-24b-instruct:free

🔄 Test 4: Model Priority Logic
✅ Model priority logic works correctly: openrouter/mistralai/mistral-small-3.2-24b-instruct:free

🖥️ Test 5: UI Model Selection
✅ Target model found in dropdown 1: Mistral Small 3.2 24B Instruct

📊 Test Results Summary:
========================
✅ PASS modelRegistry
✅ PASS settingsPersistence
✅ PASS processingRecommendation
✅ PASS modelPriorityLogic
✅ PASS uiModelSelection

🎯 Overall Result: 5/5 tests passed
🎉 All tests passed! Model selection flow is working correctly.
```

## 🖱️ Manual Testing

### Step 1: Model Selection UI Test
1. **Navigate to Upload Page**: Go to the receipt upload page
2. **Locate Model Selector**: Find the "AI Model" dropdown in the processing options
3. **Select OpenRouter Model**: Choose "Mistral Small 3.2 24B Instruct" from the dropdown
4. **Verify Selection**: Confirm the model is selected and settings are updated

### Step 2: Upload Test with Logging
1. **Prepare Test Image**: Use any receipt image or create a test image
2. **Monitor Console**: Keep browser console open to watch logs
3. **Upload Receipt**: Drag and drop or select the test image
4. **Watch Processing Logs**: Look for model selection confirmation

### Expected Log Messages
```
🎯 MODEL SELECTION STARTED: Receipt {receiptId}
📝 Requested model ID: openrouter/mistralai/mistral-small-3.2-24b-instruct:free
✅ Requested model found: Mistral Small 3.2 24B Instruct
🔧 OpenRouter model name: mistralai/mistral-small-3.2-24b-instruct:free
```

### Step 3: Processing Verification
1. **Check Processing Status**: Verify the receipt processes successfully
2. **Review Model Used**: In the receipt details, confirm the correct model was used
3. **Validate Results**: Ensure the AI extraction worked properly

## 🔍 Troubleshooting

### Common Issues and Solutions

#### Issue 1: Model Not Found in Dropdown
**Symptoms**: OpenRouter models don't appear in the model selection dropdown
**Solution**: 
- Check that `AVAILABLE_MODELS` includes the OpenRouter models
- Verify `getModelsByCapability('vision')` returns OpenRouter models
- Ensure the model has `supportsVision: true`

#### Issue 2: Settings Not Persisting
**Symptoms**: Selected model reverts to default after page refresh
**Solution**:
- Check localStorage for `receiptProcessingSettings`
- Verify `useSettings` hook is properly saving/loading settings
- Ensure `updateSettings` function is called when model changes

#### Issue 3: Processing Still Uses Default Model
**Symptoms**: Logs show `gemini-2.0-flash-lite` instead of selected OpenRouter model
**Solution**:
- Verify processing recommendation generation includes user preferences
- Check model priority logic in UploadZone component
- Ensure Edge Function receives correct `modelId` parameter

#### Issue 4: OpenRouter API Errors
**Symptoms**: Processing fails with OpenRouter-related errors
**Solution**:
- Verify `OPENROUTER_API_KEY` is set in Supabase environment variables
- Check OpenRouter API endpoint configuration
- Ensure model name extraction removes `openrouter/` prefix correctly

## 📊 Test Results Validation

### Success Criteria
- ✅ All 5 automated tests pass
- ✅ Model appears in UI dropdown
- ✅ Settings persist after selection
- ✅ Processing logs show correct model ID
- ✅ Receipt processes successfully with OpenRouter model

### Failure Indicators
- ❌ Tests fail with specific error messages
- ❌ Model not found in dropdown
- ❌ Logs show `gemini-2.0-flash-lite` instead of selected model
- ❌ Processing fails with API errors
- ❌ Settings revert to default after page refresh

## 🎯 Expected Behavior After Fix

### Before Fix (Issue)
```
User selects: openrouter/mistralai/mistral-small-3.2-24b-instruct:free
Logs show: 📝 Requested model ID: gemini-2.0-flash-lite
Result: ❌ Wrong model used
```

### After Fix (Expected)
```
User selects: openrouter/mistralai/mistral-small-3.2-24b-instruct:free
Logs show: 📝 Requested model ID: openrouter/mistralai/mistral-small-3.2-24b-instruct:free
Result: ✅ Correct model used
```

## 🚀 Next Steps

After successful testing:
1. **Production Deployment**: Deploy the fixes to production
2. **User Communication**: Inform users that OpenRouter model selection is now working
3. **Monitoring**: Monitor processing logs to ensure the fix is working in production
4. **Documentation**: Update user documentation about model selection

## 📝 Test Report Template

```
## Model Selection Flow Test Report

**Date**: [Date]
**Tester**: [Name]
**Environment**: [Local/Staging/Production]

### Automated Test Results
- Model Registry: [PASS/FAIL]
- Settings Persistence: [PASS/FAIL]
- Processing Recommendation: [PASS/FAIL]
- Model Priority Logic: [PASS/FAIL]
- UI Model Selection: [PASS/FAIL]

### Manual Test Results
- Model appears in dropdown: [YES/NO]
- Model selection persists: [YES/NO]
- Processing logs show correct model: [YES/NO]
- Receipt processes successfully: [YES/NO]

### Issues Found
[List any issues discovered during testing]

### Conclusion
[Overall assessment of the fix]
```
