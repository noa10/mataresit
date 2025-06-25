# Manual Model Selection Testing Guide

## 🎯 Objective
Debug and verify that OpenRouter model selection works correctly, focusing on manual testing since automated scripts have limitations.

## 🚨 Issues Identified

### 1. **Global Scope Issue** ✅ FIXED
- **Problem**: Test script expected `window.modelProviders` and `window.processingOptimizer`
- **Reality**: These are ES6 modules, not global objects
- **Solution**: Use manual testing with debugging utilities

### 2. **UI Dropdown Issue** ✅ IDENTIFIED
- **Problem**: Test script looked for `<select>` elements
- **Reality**: Uses Radix UI `Select` component with different DOM structure
- **Solution**: Use visual inspection and debugging utilities

### 3. **OpenRouter API Issue** 🔍 NEEDS INVESTIGATION
- **Problem**: "Failed to parse OpenRouter response as JSON"
- **Likely Cause**: API returning HTML error pages instead of JSON
- **Solution**: Check API key, endpoint, and response format

## 🛠️ Step-by-Step Manual Testing

### Step 1: Load Debugging Tools
1. **Navigate to upload page** in your browser
2. **Open browser console** (F12 → Console tab)
3. **Copy and paste** the FIXED `test-model-selection-flow.js` script
4. **Run**: `modelSelectionDebug.quickTest()`

### Step 2: Verify Model Registry
```javascript
// Check if OpenRouter models are available
modelSelectionDebug.findModelDropdown()
```

**Expected Results:**
- Should find Radix UI select triggers
- Page should contain "OpenRouter" and "Mistral" text
- Model dropdown should be visible in UI

### Step 3: Check Current Settings
```javascript
// Check what's currently saved
modelSelectionDebug.checkCurrentSettings()
```

**Expected Results:**
- Should show current `selectedModel` from localStorage
- If not set, will show "NOT SET"

### Step 4: Set Test Model
```javascript
// Set the OpenRouter model for testing
modelSelectionDebug.setTestModel()
```

**Expected Results:**
- Should save OpenRouter model to localStorage
- Console should confirm: "Set model to: openrouter/mistralai/mistral-small-3.2-24b-instruct:free"

### Step 5: Refresh and Verify UI
1. **Refresh the page** (F5)
2. **Check the model dropdown** in the UI
3. **Verify** that "Mistral Small 3.2 24B Instruct" is selected

**Expected Results:**
- Dropdown should show the OpenRouter model as selected
- Should see OpenRouter provider badge (🌐)

### Step 6: Monitor Processing Logs
```javascript
// Start monitoring console logs
modelSelectionDebug.startLogMonitoring()
```

### Step 7: Test Receipt Upload
1. **Upload a test receipt image**
2. **Watch the console** for model selection logs
3. **Look for these specific messages:**
   - `🎯 MODEL SELECTION LOG DETECTED:`
   - `Model selection priority check:`
   - `Using AI model: openrouter/mistralai/mistral-small-3.2-24b-instruct:free`

**Expected Results:**
- Logs should show the OpenRouter model ID
- Should NOT show "gemini-2.0-flash-lite"
- Processing should start with correct model

## 🔍 Debugging OpenRouter API Issues

### Check API Configuration
```javascript
modelSelectionDebug.checkOpenRouterConfig()
```

### Common OpenRouter Issues:

#### Issue 1: Missing API Key
**Symptoms**: "API key not found" errors
**Solution**: 
1. Go to Supabase Dashboard → Project Settings → Environment Variables
2. Add `OPENROUTER_API_KEY` with your OpenRouter API key
3. Restart Edge Functions

#### Issue 2: Invalid API Key
**Symptoms**: 401 Unauthorized errors
**Solution**:
1. Verify API key is correct at https://openrouter.ai/keys
2. Check key has sufficient credits
3. Ensure key has access to the specific model

#### Issue 3: JSON Parsing Error
**Symptoms**: "Failed to parse OpenRouter response as JSON"
**Debug Steps**:
1. Check browser Network tab during upload
2. Look for OpenRouter API calls
3. Examine response content (might be HTML error page)
4. Verify endpoint URL: `https://openrouter.ai/api/v1/chat/completions`

#### Issue 4: Model Not Available
**Symptoms**: Model-specific errors
**Solution**:
1. Check if model is available at https://openrouter.ai/models
2. Verify model name format: `mistralai/mistral-small-3.2-24b-instruct:free`
3. Try a different OpenRouter model

## 📊 Success Criteria Checklist

### ✅ Model Selection UI
- [ ] OpenRouter models appear in dropdown
- [ ] Can select "Mistral Small 3.2 24B Instruct"
- [ ] Selection persists after page refresh
- [ ] OpenRouter provider badge shows (🌐)

### ✅ Settings Persistence
- [ ] `localStorage` contains correct `selectedModel`
- [ ] Settings survive page refresh
- [ ] Model selection updates settings immediately

### ✅ Processing Logs
- [ ] Console shows "Model selection priority check"
- [ ] Logs display correct OpenRouter model ID
- [ ] No fallback to "gemini-2.0-flash-lite"
- [ ] Processing starts with selected model

### ✅ API Functionality
- [ ] OpenRouter API calls succeed
- [ ] No JSON parsing errors
- [ ] Receipt processing completes
- [ ] Extracted data is reasonable

## 🚨 Troubleshooting Quick Fixes

### If Model Doesn't Appear in Dropdown:
```javascript
// Force refresh the page and check again
location.reload()
```

### If Settings Don't Persist:
```javascript
// Manually verify localStorage
console.log(localStorage.getItem('receiptProcessingSettings'))
```

### If Processing Uses Wrong Model:
```javascript
// Check the priority logic
console.log('Priority check: settings.selectedModel || processingRecommendation?.recommendedModel || default')
```

### If OpenRouter API Fails:
1. **Check Network tab** for failed requests
2. **Verify API key** in Supabase environment variables
3. **Test with a different OpenRouter model**
4. **Check OpenRouter service status**

## 🎯 Expected Final Result

After successful testing, you should see:

```
🎯 MODEL SELECTION LOG DETECTED:
Model selection priority check: {
  userSelectedModel: "openrouter/mistralai/mistral-small-3.2-24b-instruct:free",
  recommendedModel: "openrouter/mistralai/mistral-small-3.2-24b-instruct:free", 
  finalModelUsed: "openrouter/mistralai/mistral-small-3.2-24b-instruct:free",
  prioritySource: "user_selection"
}

🎯 MODEL SELECTION LOG DETECTED:
Using AI model: openrouter/mistralai/mistral-small-3.2-24b-instruct:free (user selected)
```

## 📞 Next Steps

If all tests pass:
- ✅ Model selection is working correctly
- ✅ Deploy to production with confidence

If tests fail:
- 🔍 Use the debugging utilities to identify specific issues
- 🛠️ Follow the troubleshooting steps above
- 📝 Document any additional issues found
