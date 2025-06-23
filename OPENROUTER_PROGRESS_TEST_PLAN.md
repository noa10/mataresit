# OpenRouter Progress Display Test Plan

## Overview
This test plan verifies that the OpenRouter progress tracking system displays real-time progress logs during receipt processing, providing users with immediate visual feedback.

## Prerequisites
1. **OpenRouter API Key**: Ensure you have a valid OpenRouter API key configured in Settings
2. **OpenRouter Model Selected**: Choose an OpenRouter model (e.g., "Mistral Small 3.2 24B Instruct")
3. **Test Receipt Image**: Have a clear receipt image ready for upload (JPEG/PNG, under 5MB)

## Test Scenarios

### Test 1: Basic OpenRouter Progress Display
**Objective**: Verify that progress logs appear and update in real-time during OpenRouter processing

**Steps**:
1. Navigate to the upload page
2. Select an OpenRouter model from the model dropdown (look for 🌐 icon)
3. Upload a receipt image
4. **Expected Results**:
   - Progress logs should appear immediately after upload
   - Logs should show progression through stages:
     - "Initializing OpenRouter processing" (5%)
     - "Validating API key" (10%)
     - "Preparing image data" (15%)
     - "Connecting to OpenRouter API" (20%)
     - "Sending image to AI model" (25%)
     - "Processing with AI model" (40%)
     - "Receiving AI response" (60%)
     - "Parsing AI response" (70%)
     - "Extracting receipt data" (75%)
     - "Validating extracted fields" (80%)
     - "Formatting receipt information" (85%)
     - "Calculating confidence scores" (90%)
     - "Processing completed successfully" (100%)

### Test 2: Comparison with Edge Function Processing
**Objective**: Ensure OpenRouter processing feels similar to Edge Function processing

**Steps**:
1. Test with Edge Function model (e.g., "Gemini 2.0 Flash Lite")
2. Note the user experience and progress feedback
3. Test with OpenRouter model (e.g., "Mistral Small 3.2 24B Instruct")
4. **Expected Results**:
   - Both should show progress logs
   - Both should provide real-time feedback
   - User experience should feel consistent
   - OpenRouter should show local progress, Edge Function should show database logs

### Test 3: Error Handling
**Objective**: Verify error scenarios display appropriate feedback

**Steps**:
1. **Invalid API Key Test**:
   - Remove or corrupt OpenRouter API key in settings
   - Try to upload with OpenRouter model
   - **Expected**: Error log showing "OpenRouter API key not configured"

2. **Network Error Test**:
   - Disconnect internet during processing
   - **Expected**: Error log showing connection failure

3. **Model Error Test**:
   - Use an invalid model ID
   - **Expected**: Error log showing model configuration error

### Test 4: Upload Retry and Reset
**Objective**: Verify progress state is properly reset

**Steps**:
1. Upload a receipt with OpenRouter model
2. Let it complete or fail
3. Click "Try Again" or upload another receipt
4. **Expected Results**:
   - Progress logs should reset to empty
   - New upload should start fresh progress tracking
   - No leftover logs from previous upload

### Test 5: Console Verification
**Objective**: Verify technical implementation details

**Steps**:
1. Open browser console (F12)
2. Upload receipt with OpenRouter model
3. **Expected Console Logs**:
   - "🔄 Using OpenRouter model - enabling local progress tracking"
   - "OpenRouter Progress: START - Initializing OpenRouter processing"
   - "OpenRouter Progress: AI - Processing with AI model"
   - "OpenRouter Progress: PROCESSING - Extracting receipt data"
   - "OpenRouter Progress: COMPLETE - Processing completed successfully"

## Verification Checklist

### ✅ Visual Progress Display
- [ ] Progress logs appear immediately after upload starts
- [ ] Progress percentages increase logically (5% → 10% → 15% → etc.)
- [ ] Progress messages are descriptive and informative
- [ ] Progress timeline shows realistic timing
- [ ] Completion shows 100% and success message

### ✅ User Experience
- [ ] No empty or missing progress logs during OpenRouter processing
- [ ] Progress feels responsive and real-time
- [ ] User experience matches Edge Function processing quality
- [ ] ARIA live regions announce progress for screen readers
- [ ] Progress logs are scrollable when many entries exist

### ✅ Error Handling
- [ ] Invalid API key shows clear error message
- [ ] Network errors display appropriate feedback
- [ ] Failed processing shows error logs with details
- [ ] Error state allows retry functionality

### ✅ State Management
- [ ] Progress resets properly on retry
- [ ] New uploads start with clean progress state
- [ ] No memory leaks or lingering progress data
- [ ] Multiple uploads in sequence work correctly

### ✅ Technical Implementation
- [ ] Console shows OpenRouter progress events
- [ ] Model detection works correctly (OpenRouter vs Edge Function)
- [ ] Progress callback chain functions properly
- [ ] No JavaScript errors in console

## Success Criteria

The OpenRouter progress display is considered successful if:

1. **Immediate Feedback**: Progress logs appear within 1-2 seconds of upload
2. **Real-time Updates**: Progress updates smoothly throughout processing
3. **Consistent Experience**: OpenRouter processing feels similar to Edge Function processing
4. **Clear Communication**: Users understand what's happening at each stage
5. **Error Transparency**: Failures are clearly communicated with actionable messages
6. **Reliable Reset**: Retry functionality works consistently

## Troubleshooting

### If Progress Logs Don't Appear:
1. Check browser console for JavaScript errors
2. Verify OpenRouter API key is configured
3. Confirm OpenRouter model is selected (look for 🌐 icon)
4. Check network connectivity

### If Progress Seems Stuck:
1. Check console for error messages
2. Verify API key validity
3. Try a different OpenRouter model
4. Check if rate limits are exceeded

### If Errors Occur:
1. Note the exact error message
2. Check console for detailed error logs
3. Verify all prerequisites are met
4. Try with a different receipt image

## Notes
- OpenRouter processing happens client-side, so progress is generated locally
- Edge Function processing uses database logs, so progress comes from server
- Both should provide similar user experience despite different technical approaches
- Progress percentages are estimates based on processing stages, not actual completion
