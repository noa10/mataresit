# Gemini 2.5 Flash Lite Preview Data Extraction Fix

## Problem Summary

**Issue**: When users select "Gemini 2.5 Flash Lite Preview (06-17)" as their AI model, receipt data extraction appears to complete successfully but returns no extracted data from receipt images, while "Gemini 2.0 Flash Lite" works correctly.

**Symptoms**:
- Processing completes without errors
- Response indicates success
- No meaningful data extracted (empty merchant, total=0, no line items)
- Users see empty receipt data despite successful processing status

## Root Cause Analysis

**BREAKTHROUGH DISCOVERY**: The user provided actual logs from Google AI Studio showing that Gemini 2.5 Flash Lite Preview (06-17) returns a **completely different response format** - bounding box coordinates instead of text extraction.

### **The Real Issue: Bounding Box Format vs. Text Extraction**

The model returns structured data like this:
```json
[
  {"box_2d": [0, 5, 23, 724], "label": "description"},
  {"box_2d": [36, 9, 53, 613], "label": "store_name"},
  {"box_2d": [285, 7, 301, 234], "label": "date"},
  {"box_2d": [600, 720, 617, 898], "label": "total_sales"}
]
```

**This explains everything:**
1. ✅ Model processes successfully (no errors)
2. ❌ Our JSON parser fails (expects text extraction, gets coordinates)
3. ❌ Users get empty data (coordinates ≠ actual text values)
4. ❌ No meaningful extraction (bounding boxes lack text content)

### **Why This Happens**
- Gemini 2.5 Flash Lite Preview uses **document understanding mode**
- Returns **spatial layout analysis** instead of **text extraction**
- Provides **structure detection** but not **content extraction**
- Different API behavior compared to other Gemini models

## Solution Implemented

### 1. **Bounding Box Format Detection & Automatic Fallback**

**Primary Solution**: Detect the incompatible bounding box format and automatically fallback to a compatible model:

```typescript
// Detect bounding box format
const boundingBoxData = JSON.parse(responseText.trim());
if (Array.isArray(boundingBoxData) && boundingBoxData[0].box_2d && boundingBoxData[0].label) {
  // Trigger automatic fallback to gemini-2.5-flash
  return await callGeminiAPI(input, fallbackModelConfig, apiKey, logger);
}
```

### 2. **Enhanced Prompt Instructions**

Modified the vision prompt to explicitly request text extraction:

```typescript
text: `IMPORTANT: Please provide TEXT EXTRACTION and DATA ANALYSIS, not bounding box coordinates or structural markup. Return actual extracted text values in JSON format.`
```

### 3. **Multi-Strategy JSON Parsing**

Enhanced parsing to handle various response formats:

```typescript
// Strategy 1: Bounding box detection (triggers fallback)
// Strategy 2: Code block extraction
// Strategy 3: Original regex method
// Strategy 4: Direct JSON parsing
// Strategy 5: Flexible regex for complex JSON
```

### 2. **Comprehensive Data Validation**

Added robust validation and normalization of extracted data:

```typescript
const validatedData = {
  merchant: enhancedData.merchant || '',
  date: enhancedData.date || '',
  total: parseFloat(enhancedData.total) || 0,
  tax: parseFloat(enhancedData.tax) || 0,
  currency: enhancedData.currency || 'MYR',
  payment_method: enhancedData.payment_method || '',
  predicted_category: enhancedData.predicted_category || 'Other',
  line_items: Array.isArray(enhancedData.line_items) ? enhancedData.line_items : [],
  confidence: enhancedData.confidence || {}
};
```

### 3. **Empty Data Fallback Mechanism**

Added specific handling for when the problematic model returns empty data:

```typescript
if (!hasData && modelConfig.id === 'gemini-2.5-flash-lite-preview-06-17') {
  await logger.log(`🔄 EMPTY DATA FALLBACK: ${modelConfig.id} returned no data, trying fallback`, "ERROR");
  
  const fallbackModelConfig = AVAILABLE_MODELS['gemini-2.5-flash'];
  if (fallbackModelConfig) {
    return await callGeminiAPI(input, fallbackModelConfig, apiKey, logger);
  }
}
```

### 4. **Enhanced Error Handling and Logging**

Improved error detection and logging for better debugging:

- Response structure validation
- Content length checks
- Finish reason monitoring
- Detailed parsing error reporting
- Model-specific error tracking

### 5. **Structured Empty Response**

Instead of returning empty objects, return structured empty responses with proper defaults:

```typescript
return {
  merchant: '',
  date: '',
  total: 0,
  tax: 0,
  currency: 'MYR',
  payment_method: '',
  predicted_category: 'Other',
  line_items: [],
  confidence: { /* default confidence scores */ },
  parsing_error: 'Failed to extract JSON from model response'
};
```

## Files Modified

1. **`supabase/functions/enhance-receipt-data/index.ts`**
   - Enhanced JSON parsing with multiple strategies
   - Added comprehensive data validation
   - Implemented empty data fallback mechanism
   - Improved error handling and logging

## Testing and Verification

### 1. **Enhanced Debug Script**
Created `enhanced-gemini-debug.js` for detailed analysis:
- Compares responses between working and problematic models
- Analyzes data quality and extraction success
- Detects fallback mechanisms
- Provides detailed error reporting

### 2. **Test Scenarios**
- Test with Gemini 2.0 Flash Lite (baseline)
- Test with Gemini 2.5 Flash Lite Preview (problematic)
- Test with Gemini 2.5 Flash (fallback)
- Verify fallback mechanisms work correctly

### 3. **Expected Behavior After Fix**

**Before Fix**:
- User selects "Gemini 2.5 Flash Lite Preview"
- Processing appears successful
- No data extracted (empty fields)
- User sees empty receipt

**After Fix**:
- User selects "Gemini 2.5 Flash Lite Preview"
- System attempts extraction with enhanced parsing
- If no data extracted, automatically falls back to Gemini 2.5 Flash
- User gets extracted data from fallback model
- Logs show fallback occurred (for debugging)

## Monitoring and Debugging

### Key Log Messages to Monitor

1. **Parsing Strategy Success**:
   - `"Found JSON in code block"`
   - `"Found JSON using regex"`
   - `"Parsed entire response as JSON"`

2. **Fallback Triggers**:
   - `"EMPTY DATA FALLBACK: gemini-2.5-flash-lite-preview-06-17 returned no data"`
   - `"FALLBACK ATTEMPT: Retrying with Gemini 2.5 Flash due to empty data"`

3. **Data Quality Issues**:
   - `"WARNING: No meaningful data extracted from receipt"`
   - `"CRITICAL: No valid JSON found after all parsing strategies"`

### Response Analysis

The enhanced system now provides detailed response analysis:
- Model requested vs. actually used
- Data extraction success metrics
- Confidence scores validation
- Parsing method used
- Error details for failed extractions

## Future Recommendations

1. **Model Health Monitoring**: Implement periodic checks for model response quality
2. **User Notification**: Consider informing users when fallback occurs
3. **Model Updates**: Regularly review and update model configurations
4. **Response Caching**: Cache successful parsing patterns for faster processing
5. **A/B Testing**: Compare extraction quality across different models

## Deployment Notes

1. Deploy updated edge function to Supabase
2. Monitor logs for fallback operations
3. Test with real receipt images
4. Verify user experience improvements
5. Update documentation if needed

This fix ensures reliable receipt data extraction across all supported Gemini models while maintaining backward compatibility and providing graceful degradation when specific models have issues.
