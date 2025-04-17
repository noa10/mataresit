# Master Implementation Plan for Receipt Processing System

## Executive Summary

This implementation plan addresses data inconsistencies in receipt processing by enhancing the existing infrastructure with normalization rules, validation logic, and optimized AI prompting. The plan integrates preprocessing steps to standardize merchant names, payment methods, dates, and currencies while improving the efficiency of both OCR and AI-vision processing methods. The solution ensures robust error handling, monitoring capabilities, and a phased deployment approach to minimize operational risks.

## 1. Data Analysis & Requirement Definition

### 1.1 Identified Data Inconsistencies
- **Merchant Names**: Variations in case, spacing, and formatting (e.g., "SUPER SEVEN CASH & CARRY SDN BHD" vs. "Super Seven Cash & Carry Sdn Bhd")
- **Date Formats**: Inconsistent formats and potentially invalid future dates
- **Currency Inconsistencies**: Predominantly MYR with occasional USD values
- **Payment Methods**: Variations like "MASTER", "Master Card", "MASTERCARD" require normalization
- **Missing Values**: Null payment methods and tax values

### 1.2 Data Normalization Requirements
- **Merchant Standardization**: Normalize case, remove extra spaces and line breaks
- **Date Validation**: Enforce YYYY-MM-DD format and reject dates >1 year in future
- **Currency Handling**: Convert USD to MYR where appropriate
- **Payment Method Standardization**: Map variations to standardized values
- **Default Values**: Establish rules for handling missing fields

## 2. System Architecture Enhancements

### 2.1 Code Modifications for Preprocessing

#### Merchant Name Normalization
```typescript
function normalizeMerchant(rawName: string): string {
  if (!rawName) return "Unknown";
  
  // Remove line breaks and standardize spacing
  const cleanedName = rawName.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  
  // Apply merchant aliases for known variations
  const merchantAliases: Record<string, string> = {
    "super seven cash & carry sdn bhd": "SUPER SEVEN CASH & CARRY SDN BHD",
    "econsave cash & carry (kbs) sdn bhd": "ECONSAVE CASH & CARRY SDN BHD",
    // Additional aliases derived from receipts_data.json
  };
  
  return merchantAliases[cleanedName.toLowerCase()] || cleanedName.toUpperCase();
}
```

#### Date Validation
```typescript
function validateDate(dateStr: string): string {
  // Enforce YYYY-MM-DD format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    // Attempt to parse and normalize other formats
    const parsedDate = parseNonStandardDate(dateStr);
    if (!parsedDate) {
      logger.log(`Invalid date format: ${dateStr}`, "DATE_VALIDATION");
      return new Date().toISOString().split('T')[0]; // Default to current date
    }
    dateStr = parsedDate;
  }
  
  // Validate against future dates
  const MAX_FUTURE_DAYS = 365;
  const dateObj = new Date(dateStr);
  const now = new Date();
  const maxValidDate = new Date(now.setDate(now.getDate() + MAX_FUTURE_DAYS));
  
  if (dateObj > maxValidDate) {
    logger.log(`Invalid future date: ${dateStr}`, "DATE_VALIDATION");
    return new Date().toISOString().split('T')[0]; // Default to current date
  }
  
  return dateStr;
}
```

#### Currency Handling
```typescript
function handleCurrency(total: number, currency: string): { total: number, currency: string } {
  if (!currency || currency.trim() === "") {
    // Default to MYR for Malaysian merchants
    return { total, currency: "MYR" };
  }
  
  if (currency.toUpperCase() === "USD") {
    // Convert USD to MYR
    const exchangeRate = 4.75; // To be replaced with live rate in production
    return { 
      total: total * exchangeRate, 
      currency: "MYR" 
    };
  }
  
  return { total, currency: currency.toUpperCase() };
}
```

#### Payment Method Normalization
```typescript
function normalizePaymentMethod(method: string | null): string {
  if (!method) return "Unknown";
  
  const lowerMethod = method.toLowerCase().trim();
  
  // Map variations to standardized forms
  if (lowerMethod.includes("master")) return "Mastercard";
  if (lowerMethod.includes("visa")) return "Visa";
  if (lowerMethod.includes("debit") || lowerMethod.includes("atm")) return "Debit Card";
  if (lowerMethod === "cash") return "Cash";
  
  return method; // Return original if no match
}
```

### 2.2 AI Prompt Optimization

#### Enhanced Prompt Structure
```typescript
function constructAIPrompt(input: any): string {
  return `
You are an AI assistant specialized in analyzing receipt data.

RECEIPT TEXT:
${input.fullText}

TEXTRACT EXTRACTED DATA:
${JSON.stringify(input.textractData, null, 2)}

Analyze the receipt text and perform the following tasks:
1. Identify the CURRENCY (e.g., RM or MYR = MYR, $ = USD unless prefixed with RM). Default to MYR if ambiguous and merchant suggests Malaysia (e.g., 'SDN BHD').
2. Identify and normalize the PAYMENT METHOD (e.g., 'MASTER', 'MASTER CARD', 'MASTERCARD' → 'Mastercard'; 'Debit Card', 'ATM CARD' → 'Debit Card'; 'CASH' → 'Cash'). Return 'Unknown' if unclear.
3. Predict a CATEGORY based on merchant name: 
   - 'CASH & CARRY', 'HYPERMARKET', 'SUPER SEVEN', 'ECONSAVE' → 'Groceries'
   - 'PETRONAS' → 'Transportation' 
   - 'HARDWARE' → 'Shopping'
   - Default to 'Other' if uncertain
4. Suggest OCR corrections for merchant name, date, and total amount if needed.

EXAMPLE:
RECEIPT TEXT: "SUPER SEVEN CASH & CARRY SDN BHD 2025-03-24 RM 79.15 MASTER"
Expected Output:
{
  "currency": "MYR",
  "payment_method": "Mastercard",
  "predicted_category": "Groceries",
  "merchant": "SUPER SEVEN CASH & CARRY SDN BHD",
  "total": 79.15,
  "date": "2025-03-24"
}

Return findings in the predefined JSON format.
`;
}
```

### 2.3 Database Schema Updates
```sql
-- Add new columns for normalization tracking
ALTER TABLE receipts
ADD COLUMN normalized_merchant TEXT,
ADD COLUMN original_merchant TEXT,
ADD COLUMN currency_converted BOOLEAN DEFAULT FALSE,
ADD COLUMN original_currency TEXT,
ADD COLUMN original_total NUMERIC,
ADD COLUMN processing_version TEXT;

-- Create indexes for improved query performance
CREATE INDEX idx_receipts_normalized_merchant ON receipts(normalized_merchant);
CREATE INDEX idx_receipts_date ON receipts(date);
```

## 3. Implementation Workflow

### 3.1 Core Function Integration

#### Update processReceiptImage Function
```typescript
async function processReceiptImage(
  imageBytes: Uint8Array,
  imageUrl: string,
  receiptId: string,
  primaryMethod: 'ocr-ai' | 'ai-vision' = 'ocr-ai',
  modelId: string = '',
  compareWithAlternative: boolean = false
) {
  const logger = new ProcessingLogger(receiptId);
  await logger.start(primaryMethod, modelId);
  
  try {
    // Extract data using primary method
    const primaryResult = await extractWithMethod(
      primaryMethod,
      imageBytes,
      imageUrl,
      logger
    );
    
    // Apply normalization before AI enhancement
    primaryResult.textractData.merchant = normalizeMerchant(primaryResult.textractData.merchant);
    primaryResult.textractData.date = validateDate(primaryResult.textractData.date);
    primaryResult.textractData.payment_method = normalizePaymentMethod(primaryResult.textractData.payment_method);
    
    const { total, currency } = handleCurrency(
      primaryResult.textractData.total,
      primaryResult.textractData.currency
    );
    primaryResult.textractData.total = total;
    primaryResult.textractData.currency = currency;
    
    // Enhance with AI
    const enhancedResult = await enhanceWithAI(primaryResult, logger);
    
    // Store original values for audit
    enhancedResult.original_merchant = primaryResult.textractData.merchant;
    enhancedResult.original_currency = primaryResult.textractData.currency;
    enhancedResult.original_total = primaryResult.textractData.total;
    
    // Compare with alternative method if requested
    let discrepancies = [];
    if (compareWithAlternative) {
      const alternativeMethod = primaryMethod === 'ocr-ai' ? 'ai-vision' : 'ocr-ai';
      const alternativeResult = await extractWithMethod(
        alternativeMethod,
        imageBytes,
        imageUrl,
        logger
      );
      
      discrepancies = findDiscrepancies(enhancedResult, alternativeResult);
      await logger.log(`Found ${discrepancies.length} discrepancies`, "COMPARISON");
    }
    
    // Save to database
    await saveToDatabase(receiptId, enhancedResult, discrepancies, logger);
    
    await logger.complete();
    return { result: enhancedResult, discrepancies };
  } catch (error) {
    await logger.error(error);
    throw error;
  }
}
```

#### Batch Processing Support
```typescript
async function batchProcessReceiptImages(
  imageBytesArray: Uint8Array[],
  imageUrls: string[],
  receiptIds: string[],
  primaryMethod: 'ocr-ai' | 'ai-vision' = 'ocr-ai',
  modelId: string = '',
  compareWithAlternative: boolean = false
) {
  // Process in batches of 5 to avoid overloading resources
  const batchSize = 5;
  const results = [];
  
  for (let i = 0; i < receiptIds.length; i += batchSize) {
    const batchPromises = [];
    
    for (let j = i; j < Math.min(i + batchSize, receiptIds.length); j++) {
      batchPromises.push(
        processReceiptImage(
          imageBytesArray[j],
          imageUrls[j],
          receiptIds[j],
          primaryMethod,
          modelId,
          compareWithAlternative
        )
      );
    }
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }
  
  return results;
}
```

### 3.2 Enhanced Discrepancy Detection

```typescript
function findDiscrepancies(primaryResult: any, alternativeResult: any): Array<{field: string, primary: any, alternative: any, note?: string}> {
  const discrepancies = [];
  
  // Compare key fields
  const fieldsToCompare = [
    'merchant', 'date', 'total', 'tax', 'currency', 'payment_method'
  ];
  
  for (const field of fieldsToCompare) {
    if (primaryResult[field] !== alternativeResult[field]) {
      // For numeric fields, check if the difference is significant
      if (field === 'total' || field === 'tax') {
        const diff = Math.abs(parseFloat(primaryResult[field]) - parseFloat(alternativeResult[field]));
        const threshold = 0.01; // 1 cent difference threshold
        
        if (diff > threshold) {
          discrepancies.push({
            field,
            primary: primaryResult[field],
            alternative: alternativeResult[field],
            note: `Difference: ${diff.toFixed(2)}`
          });
        }
      } else {
        discrepancies.push({
          field, 
          primary: primaryResult[field], 
          alternative: alternativeResult[field]
        });
      }
    }
  }
  
  // Check for potential duplicates based on merchant + date with similar totals
  if (primaryResult.merchant === alternativeResult.merchant && 
      primaryResult.date === alternativeResult.date) {
    const totalDiff = Math.abs(parseFloat(primaryResult.total) - parseFloat(alternativeResult.total));
    if (totalDiff < 0.1) {
      discrepancies.push({
        field: 'potential_duplicate',
        primary: primaryResult.total,
        alternative: alternativeResult.total,
        note: 'Nearly identical entries detected'
      });
    }
  }
  
  return discrepancies;
}
```

## 4. Testing Strategy

### 4.1 Test Cases from receipts_data.json

```typescript
const testCases = [
  // Merchant name normalization
  {
    field: "merchant",
    input: "SUPER SEVEN CASH BHD & CARRY SDN BHD",
    expected: "SUPER SEVEN CASH & CARRY SDN BHD"
  },
  // Currency conversion
  {
    field: "currency",
    input: { total: 85.05, currency: "USD" },
    expected: { total: 404.49, currency: "MYR" }
  },
  // Date validation
  {
    field: "date",
    input: "2026-12-31", // Far future date
    expected: new Date().toISOString().split('T')[0] // Today's date
  },
  // Payment method normalization
  {
    field: "payment_method",
    input: "MASTER",
    expected: "Mastercard"
  }
];
```

### 4.2 Unit Testing Functions

```typescript
async function runUnitTests() {
  console.log("Running unit tests...");
  
  // Test merchant normalization
  const merchantTests = testCases.filter(t => t.field === "merchant");
  for (const test of merchantTests) {
    const result = normalizeMerchant(test.input);
    console.log(`Merchant: ${test.input} -> ${result} | Expected: ${test.expected} | ${result === test.expected ? "PASS" : "FAIL"}`);
  }
  
  // Test currency handling
  const currencyTests = testCases.filter(t => t.field === "currency");
  for (const test of currencyTests) {
    const result = handleCurrency(test.input.total, test.input.currency);
    console.log(`Currency: ${JSON.stringify(test.input)} -> ${JSON.stringify(result)} | Expected: ${JSON.stringify(test.expected)} | ${JSON.stringify(result) === JSON.stringify(test.expected) ? "PASS" : "FAIL"}`);
  }
  
  // Test date validation
  const dateTests = testCases.filter(t => t.field === "date");
  for (const test of dateTests) {
    const result = validateDate(test.input);
    console.log(`Date: ${test.input} -> ${result} | Expected: ${test.expected} | ${result === test.expected ? "PASS" : "FAIL"}`);
  }
  
  // Test payment method normalization
  const paymentTests = testCases.filter(t => t.field === "payment_method");
  for (const test of paymentTests) {
    const result = normalizePaymentMethod(test.input);
    console.log(`Payment: ${test.input} -> ${result} | Expected: ${test.expected} | ${result === test.expected ? "PASS" : "FAIL"}`);
  }
}
```

### 4.3 Integration Testing

```typescript
async function runIntegrationTests() {
  console.log("Running integration tests with receipts_data.json...");
  
  // Load test data
  const receiptsData = JSON.parse(await fs.readFile("receipts_data.json", "utf8"));
  
  // Test full processing pipeline with sample receipts
  const testSample = receiptsData.slice(0, 5);
  
  for (const receipt of testSample) {
    // Convert receipt data to simulated image bytes (mocked for testing)
    const mockImageBytes = new TextEncoder().encode(JSON.stringify(receipt));
    const mockImageUrl = `test:///receipt-${receipt.id}.jpg`;
    
    console.log(`Testing receipt for ${receipt.merchant} dated ${receipt.date}`);
    
    // Process with both methods for comparison
    const resultOcrAi = await processReceiptImage(
      mockImageBytes,
      mockImageUrl,
      receipt.id,
      'ocr-ai',
      'test-model',
      true
    );
    
    console.log(`OCR+AI Result: ${JSON.stringify(resultOcrAi.result)}`);
    console.log(`Discrepancies: ${JSON.stringify(resultOcrAi.discrepancies)}`);
    
    // Validate key fields
    const validationErrors = [];
    if (!resultOcrAi.result.merchant) validationErrors.push("Missing merchant");
    if (!resultOcrAi.result.date) validationErrors.push("Missing date");
    if (isNaN(parseFloat(resultOcrAi.result.total))) validationErrors.push("Invalid total");
    
    console.log(`Validation ${validationErrors.length === 0 ? "PASSED" : "FAILED: " + validationErrors.join(", ")}`);
  }
}
```

## 5. Deployment Strategy

### 5.1 Staging Deployment
1. **Prepare Environment**:
   - Deploy updated functions to staging environment
   - Create test database with modified schema

2. **Historical Data Migration**:
   ```sql
   -- Copy existing data to normalized columns
   UPDATE receipts
   SET normalized_merchant = merchant,
       original_merchant = merchant,
       processing_version = '1.0'
   WHERE normalized_merchant IS NULL;
   ```

3. **Verification Queries**:
   ```sql
   -- Verify normalization success
   SELECT COUNT(*) FROM receipts WHERE normalized_merchant IS NOT NULL;
   
   -- Check currency conversion
   SELECT COUNT(*) FROM receipts WHERE currency_converted = TRUE;
   
   -- Analyze potential duplicates
   SELECT normalized_merchant, date, COUNT(*)
   FROM receipts
   GROUP BY normalized_merchant, date
   HAVING COUNT(*) > 1;
   ```

### 5.2 Production Deployment

1. **Blue/Green Deployment**:
   - Deploy new version alongside current version
   - Route 10% of traffic to new version for 24 hours
   - Monitor error rates and discrepancies

2. **Parallel Processing**:
   ```typescript
   // Set up parallel processing for comparison
   const options = {
     compareWithAlternative: true,
     logLevel: "verbose"
   };
   ```

3. **Rollout Schedule**:
   - Day 1: 10% traffic
   - Day 2: 25% traffic
   - Day 3: 50% traffic
   - Day 4: 100% traffic (complete cutover)

4. **Rollback Plan**:
   - Maintain previous version for quick reversion
   - Establish threshold metrics for automated rollback

## 6. Monitoring & Maintenance

### 6.1 Logging Enhancements

```typescript
class EnhancedProcessingLogger extends ProcessingLogger {
  async logNormalization(field: string, original: any, normalized: any) {
    await this.log(
      `Normalized ${field}: "${original}" → "${normalized}"`,
      "NORMALIZATION"
    );
  }
  
  async logPerformance(stage: string, startTime: number) {
    const duration = Date.now() - startTime;
    await this.log(
      `${stage} completed in ${duration}ms`,
      "PERFORMANCE"
    );
  }
  
  async logConfidenceScores(scores: Record<string, number>) {
    await this.log(
      `Confidence scores: ${JSON.stringify(scores)}`,
      "CONFIDENCE"
    );
    
    // Save to confidence_scores table
    await supabase.from('confidence_scores').insert({
      receipt_id: this.receiptId,
      timestamp: new Date().toISOString(),
      scores
    });
  }
}
```

### 6.2 Analytics Views

```sql
-- Create view for merchant spending patterns
CREATE VIEW merchant_spending_analysis AS
SELECT 
  normalized_merchant,
  COUNT(*) AS receipt_count,
  SUM(total) AS total_spent,
  AVG(total) AS average_transaction,
  MIN(date) AS first_transaction,
  MAX(date) AS last_transaction
FROM receipts
GROUP BY normalized_merchant
ORDER BY total_spent DESC;

-- Create view for monthly expenses by category
CREATE VIEW monthly_expenses AS
SELECT 
  DATE_TRUNC('month', date::date) AS month,
  predicted_category,
  COUNT(*) AS transaction_count,
  SUM(total) AS total_spent
FROM receipts
GROUP BY month, predicted_category
ORDER BY month DESC, total_spent DESC;
```

### 6.3 Maintenance Schedule

1. **Weekly Tasks**:
   - Review error logs and fix recurring issues
   - Update merchant aliases based on new patterns
   - Refresh currency exchange rates

2. **Monthly Tasks**:
   - Analyze confidence scores to identify model improvement areas
   - Review discrepancies between OCR-AI and AI-vision methods
   - Update category prediction rules based on merchant trends

3. **Quarterly Tasks**:
   - Performance optimization based on monitoring data
   - Schema updates for new features
   - AI prompt refinement based on error patterns

## 7. Future Enhancements

1. **AI Model Improvements**:
   - Train custom vision models on Malaysian receipt formats
   - Implement receipt-specific OCR optimizations
   - Create specialized merchant recognition models

2. **Advanced Analytics**:
   - Implement spending trend analysis
   - Develop anomaly detection for unusual transactions
   - Enable budget tracking and forecasting

3. **User Experience**:
   - Add confidence indicators for processed fields
   - Implement one-click correction for misidentified fields
   - Develop receipt categorization suggestions

This implementation plan provides a comprehensive approach to improving the receipt processing system while leveraging the existing infrastructure. By focusing on data normalization, AI prompt optimization, and robust error handling, the solution ensures accurate and consistent receipt data processing.
