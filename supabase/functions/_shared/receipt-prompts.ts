/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />

/**
 * Shared receipt prompt builders and knowledge fragments.
 *
 * This module centralises all AI prompt text used by the receipt-enhancement
 * pipeline.  Prompts are organised by "detail level" because different model
 * providers / price-tiers support different output-schema sizes:
 *
 *   full     – Gemini (primary, generous context window)
 *   standard – OpenRouter (mid-tier free models)
 *   minimal  – Groq (fast, smaller max_tokens)
 */

// ============================================================================
// Types
// ============================================================================

export interface TextInput {
  type: 'text';
  extractedData: any;
  fullText: string;
}

export interface ImageInput {
  type: 'image';
  imageData: {
    data: Uint8Array;
    mimeType: string;
  };
}

export type AIModelInput = TextInput | ImageInput;

export type PromptDetailLevel = 'full' | 'standard' | 'minimal';

// ============================================================================
// Shared knowledge fragments (deduplicated across all prompts)
// ============================================================================

const SHARED_CURRENCY_INSTRUCTION =
  'Identify the CURRENCY used (look for symbols like RM, $, MYR, USD, Ringgit). Default to MYR if ambiguous but likely Malaysian.';

const SHARED_PAYMENT_METHODS_LIST = `   - Credit/Debit Cards: VISA, Mastercard, MASTER CARD, Atm Card, MASTER, DEBIT CARD, DEBITCARD
   - Digital Wallets: GrabPay, Touch 'n Go eWallet, Boost, ShopeePay, BigPay, MAE, FPX
   - Cash: CASH, TUNAI
   - Bank Transfer: Online Banking, Internet Banking, Bank Transfer`;

const SHARED_CATEGORIES =
  '"Groceries", "Dining", "Transportation", "Utilities", "Entertainment", "Travel", "Shopping", "Healthcare", "Education", "Other"';

const SHARED_MALAYSIAN_BUSINESS_RECOGNITION = `Malaysian Business Recognition:
- Grocery chains: 99 Speedmart, KK Super Mart, Tesco, AEON, Mydin, Giant, Village Grocer, Jaya Grocer, Cold Storage
- Food establishments: Mamak, Kopitiam, Restoran, Kedai Kopi, McDonald's, KFC, Pizza Hut, Subway
- Service providers: Astro, Unifi, Celcom, Digi, Maxis, TNB (Tenaga Nasional), Syabas, IWK
- Petrol stations: Petronas, Shell, BHP, Caltex
- Pharmacies: Guardian, Watsons, Caring, Big Pharmacy`;

// ============================================================================
// Text prompt builders
// ============================================================================

export function buildTextPrompt(
  input: TextInput,
  detailLevel: PromptDetailLevel
): string {
  switch (detailLevel) {
    case 'full':
      return buildGeminiTextPrompt(input);
    case 'standard':
      return buildOpenRouterTextPrompt(input);
    case 'minimal':
      return buildGroqTextPrompt(input);
  }
}

/** Full-detail text prompt (Gemini primary). */
function buildGeminiTextPrompt(input: TextInput): string {
  return `You are an AI assistant specialized in analyzing receipt data with expertise in Malaysian business terminology and Malay language.

RECEIPT TEXT:
${input.fullText}

EXTRACTED DATA:
${JSON.stringify(input.extractedData, null, 2)}

Based on the receipt text above, please:
1. ${SHARED_CURRENCY_INSTRUCTION}
2. Identify the PAYMENT METHOD including Malaysian-specific methods:
${SHARED_PAYMENT_METHODS_LIST}
3. Predict a CATEGORY for this expense from the following list: ${SHARED_CATEGORIES}.
4. Recognize Malaysian business terminology:
   - Common Malaysian business names and chains (e.g., 99 Speedmart, KK Super Mart, Tesco, AEON, Mydin, Giant, Village Grocer)
   - Malaysian food establishments (e.g., Mamak, Kopitiam, Restoran, Kedai Kopi)
   - Malaysian service providers (e.g., Astro, Unifi, Celcom, Digi, Maxis, TNB, Syabas)
5. Identify MALAYSIAN TAX information:
   - Look for GST (6% - historical 2015-2018) or SST (Sales & Service Tax - current from 2018)
   - SST Sales Tax: 5-10% on goods (varies by category)
   - SST Service Tax: 6% on services
   - Zero-rated items: Basic food, medical, education
   - Detect if tax is inclusive or exclusive in the total
6. Handle Malay language text and mixed English-Malay content
7. Provide SUGGESTIONS for potential extraction errors - look at fields like merchant name, date format, total amount, etc. that might have been incorrectly extracted.

Return your findings in the following JSON format:
{
  "currency": "The currency code (e.g., MYR, USD)",
  "payment_method": "The payment method used",
  "predicted_category": "One of the categories from the list above",
  "merchant": "The merchant name if you find a better match than extracted data",
  "total": "The total amount if you find a better match than extracted data",
  "malaysian_tax_info": {
    "tax_type": "GST, SST_SALES, SST_SERVICE, EXEMPT, or ZERO_RATED",
    "tax_rate": "Tax rate percentage (e.g., 6.00, 10.00)",
    "tax_amount": "Calculated or detected tax amount",
    "is_tax_inclusive": "true if tax is included in total, false if added separately",
    "business_category": "Detected Malaysian business category"
  },
  "structured_data": {
    "merchant_normalized": "Standardized merchant name for consistent querying",
    "merchant_category": "Business category (grocery, restaurant, gas_station, pharmacy, etc.)",
    "business_type": "Type of business (retail, service, restaurant, healthcare, etc.)",
    "location_city": "City where transaction occurred",
    "location_state": "State/province where transaction occurred",
    "receipt_type": "Type of transaction (purchase, refund, exchange, service)",
    "transaction_time": "Time of day in HH:MM format if available",
    "item_count": "Number of distinct items purchased",
    "discount_amount": "Total discount amount applied",
    "service_charge": "Service charge amount",
    "tip_amount": "Tip/gratuity amount",
    "subtotal": "Subtotal before tax and charges",
    "total_before_tax": "Total amount before tax",
    "cashier_name": "Name of cashier if visible",
    "receipt_number": "Receipt number from merchant system",
    "transaction_id": "Unique transaction identifier",
    "loyalty_program": "Loyalty program used (if any)",
    "loyalty_points": "Loyalty points earned or redeemed",
    "payment_card_last4": "Last 4 digits of payment card if visible",
    "payment_approval_code": "Payment approval/authorization code",
    "is_business_expense": "true/false - whether this appears to be a business expense",
    "expense_type": "Type of expense (meal, travel, office_supplies, fuel, etc.)",
    "vendor_registration_number": "Vendor business registration number if visible",
    "invoice_number": "Invoice number for business receipts",
    "purchase_order_number": "Purchase order number if visible"
  },
  "line_items_analysis": {
    "categories": "Categorize line items by type (food, beverage, service, product, etc.)",
    "patterns": "Identify patterns in purchases (bulk buying, premium items, etc.)",
    "anomalies": "Flag unusual items or pricing"
  },
  "spending_patterns": {
    "transaction_type": "regular, bulk_purchase, special_occasion, business_related",
    "price_tier": "budget, mid_range, premium based on item prices",
    "shopping_behavior": "planned, impulse, necessity based on items"
  },
  "suggestions": {
    "merchant": "A suggested correction for merchant name if extraction made errors",
    "date": "A suggested date correction in YYYY-MM-DD format if needed",
    "total": "A suggested total amount correction if needed",
    "tax": "A suggested tax amount correction if needed"
  },
  "confidence": {
    "currency": "Confidence score 0-100 for currency",
    "payment_method": "Confidence score 0-100 for payment method",
    "predicted_category": "Confidence score 0-100 for category prediction",
    "malaysian_tax_info": "Confidence score 0-100 for tax detection",
    "structured_data": "Confidence score 0-100 for structured data extraction",
    "line_items_analysis": "Confidence score 0-100 for line items analysis",
    "spending_patterns": "Confidence score 0-100 for spending pattern analysis",
    "suggestions": {
      "merchant": "Confidence score 0-100 for merchant suggestion",
      "date": "Confidence score 0-100 for date suggestion",
      "total": "Confidence score 0-100 for total suggestion",
      "tax": "Confidence score 0-100 for tax suggestion"
    }
  }
}`;
}

/** Standard-detail text prompt (OpenRouter fallback). */
function buildOpenRouterTextPrompt(input: TextInput): string {
  return `You are an AI assistant specialized in analyzing receipt data.

RECEIPT TEXT:
${input.fullText}

EXTRACTED DATA:
${JSON.stringify(input.extractedData, null, 2)}

Based on the receipt text above, please:
1. ${SHARED_CURRENCY_INSTRUCTION}
2. Identify the PAYMENT METHOD including Malaysian-specific methods:
${SHARED_PAYMENT_METHODS_LIST}
3. Predict a CATEGORY for this expense from the following list: ${SHARED_CATEGORIES}.
4. Recognize Malaysian business terminology and handle Malay language text.
5. Provide SUGGESTIONS for potential extraction errors.

Return your findings in JSON format:
{
  "currency": "The currency code (e.g., MYR, USD)",
  "payment_method": "The payment method used",
  "predicted_category": "One of the categories from the list above",
  "merchant": "The merchant name if you find a better match than extracted data",
  "total": "The total amount if you find a better match than extracted data",
  "suggestions": {
    "merchant": "A suggested correction for merchant name if extraction made errors",
    "date": "A suggested date correction in YYYY-MM-DD format if needed",
    "total": "A suggested total amount correction if needed",
    "tax": "A suggested tax amount correction if needed"
  },
  "confidence": {
    "currency": "Confidence score 0-100 for currency",
    "payment_method": "Confidence score 0-100 for payment method",
    "predicted_category": "Confidence score 0-100 for category prediction"
  }
}`;
}

/** Minimal-detail text prompt (Groq fast path). */
function buildGroqTextPrompt(input: TextInput): string {
  return `You are an AI assistant specialized in analyzing receipt data.

RECEIPT TEXT:
${input.fullText}

EXTRACTED DATA:
${JSON.stringify(input.extractedData, null, 2)}

Based on the receipt text above, please:
1. ${SHARED_CURRENCY_INSTRUCTION}
2. Identify the PAYMENT METHOD including Malaysian-specific methods.
3. Predict a CATEGORY for this expense from the following list: ${SHARED_CATEGORIES}.
4. Recognize Malaysian business terminology and handle Malay language text.
5. Provide SUGGESTIONS for potential extraction errors.

Return your findings in JSON format:
{
  "merchant": "Store name or business name",
  "date": "Date in YYYY-MM-DD format",
  "total": total amount as number,
  "tax": tax amount as number,
  "currency": "Currency code (e.g., MYR, USD)",
  "payment_method": "Payment method used",
  "predicted_category": "Category from the list above",
  "line_items": [{"description": "Item description", "amount": price}],
  "confidence": {"merchant": 0-100, "date": 0-100, "total": 0-100, "tax": 0-100, "currency": 0-100, "payment_method": 0-100, "predicted_category": 0-100, "line_items": 0-100}
}`;
}

// ============================================================================
// Vision prompt builders
// ============================================================================

export function buildVisionPrompt(detailLevel: PromptDetailLevel): string {
  switch (detailLevel) {
    case 'full':
      return buildGeminiVisionPrompt();
    case 'standard':
      return buildOpenRouterVisionPrompt();
    case 'minimal':
      return buildGroqVisionPrompt();
  }
}

/** Full-detail vision prompt (Gemini primary). */
function buildGeminiVisionPrompt(): string {
  return `You are an AI assistant specialized in analyzing receipt images with expertise in Malaysian business terminology and Malay language.

IMPORTANT: Please provide TEXT EXTRACTION and DATA ANALYSIS, not bounding box coordinates or structural markup. Return actual extracted text values in JSON format.

Please examine this receipt image and extract the following information:
1. MERCHANT name (store or business name) - recognize Malaysian business chains and local establishments
2. DATE of purchase (in YYYY-MM-DD format) - handle DD/MM/YYYY format common in Malaysia
3. TOTAL amount
4. TAX amount (if present) - recognize GST/SST terminology
5. LINE ITEMS (product/service name and price for each item) - handle mixed English-Malay product names
6. CURRENCY used (look for symbols like RM, $, MYR, USD, Ringgit). Default to MYR if ambiguous.
7. PAYMENT METHOD including Malaysian-specific methods:
${SHARED_PAYMENT_METHODS_LIST}
8. Predict a CATEGORY for this expense from: ${SHARED_CATEGORIES}.
9. Identify MALAYSIAN TAX information:
   - Look for GST (6% - historical 2015-2018) or SST (Sales & Service Tax - current from 2018)
   - SST Sales Tax: 5-10% on goods (varies by category)
   - SST Service Tax: 6% on services
   - Zero-rated items: Basic food, medical, education
   - Detect if tax is inclusive or exclusive in the total

${SHARED_MALAYSIAN_BUSINESS_RECOGNITION}

Return your findings in the following JSON format:
{
  "merchant": "The merchant name",
  "date": "The date in YYYY-MM-DD format",
  "total": "The total amount as a number",
  "tax": "The tax amount as a number",
  "currency": "The currency code (e.g., MYR, USD)",
  "payment_method": "The payment method used",
  "predicted_category": "One of the categories from the list above",
  "malaysian_tax_info": {
    "tax_type": "GST, SST_SALES, SST_SERVICE, EXEMPT, or ZERO_RATED",
    "tax_rate": "Tax rate percentage (e.g., 6.00, 10.00)",
    "tax_amount": "Calculated or detected tax amount",
    "is_tax_inclusive": "true if tax is included in total, false if added separately",
    "business_category": "Detected Malaysian business category"
  },
  "line_items": [
    { "description": "Item 1 description", "amount": "Item 1 price as a number" },
    { "description": "Item 2 description", "amount": "Item 2 price as a number" }
  ],
  "structured_data": {
    "merchant_normalized": "Standardized merchant name",
    "merchant_category": "Business category (grocery, restaurant, gas_station, etc.)",
    "business_type": "Type of business (retail, service, restaurant, etc.)",
    "location_city": "City where transaction occurred",
    "location_state": "State/province where transaction occurred",
    "receipt_type": "purchase, refund, exchange, or service",
    "transaction_time": "Time in HH:MM format if visible",
    "item_count": "Number of distinct items purchased",
    "discount_amount": "Total discount amount",
    "service_charge": "Service charge amount",
    "tip_amount": "Tip/gratuity amount",
    "subtotal": "Subtotal before tax",
    "total_before_tax": "Total before tax",
    "cashier_name": "Cashier name if visible",
    "receipt_number": "Receipt number",
    "transaction_id": "Transaction ID",
    "loyalty_program": "Loyalty program used",
    "loyalty_points": "Points earned/redeemed",
    "payment_card_last4": "Last 4 digits of card",
    "payment_approval_code": "Approval code",
    "is_business_expense": "true/false for business expense",
    "expense_type": "meal, travel, office_supplies, etc.",
    "vendor_registration_number": "Business registration number",
    "invoice_number": "Invoice number",
    "purchase_order_number": "PO number"
  },
  "line_items_analysis": {
    "categories": "Categorize items by type",
    "patterns": "Shopping patterns identified",
    "anomalies": "Unusual items or pricing"
  },
  "spending_patterns": {
    "transaction_type": "regular, bulk_purchase, special_occasion, business_related",
    "price_tier": "budget, mid_range, premium",
    "shopping_behavior": "planned, impulse, necessity"
  },
  "confidence": {
    "merchant": "Confidence score 0-100",
    "date": "Confidence score 0-100",
    "total": "Confidence score 0-100",
    "tax": "Confidence score 0-100",
    "currency": "Confidence score 0-100",
    "payment_method": "Confidence score 0-100",
    "predicted_category": "Confidence score 0-100",
    "malaysian_tax_info": "Confidence score 0-100 for tax detection",
    "structured_data": "Confidence score 0-100 for structured data",
    "line_items_analysis": "Confidence score 0-100 for line items analysis",
    "spending_patterns": "Confidence score 0-100 for spending patterns",
    "line_items": "Confidence score 0-100"
  }
}

CRITICAL INSTRUCTION: Return ONLY the JSON object above with actual extracted text values. Do NOT return bounding box coordinates, structural markup, or any other format. Extract and return the actual text content from the receipt image.`;
}

/** Standard-detail vision prompt (OpenRouter fallback). */
function buildOpenRouterVisionPrompt(): string {
  return `You are an AI assistant specialized in analyzing receipt images with expertise in Malaysian business terminology and Malay language.

Please examine this receipt image and extract the following information:
1. MERCHANT name (store or business name) - recognize Malaysian business chains and local establishments
2. DATE of purchase (in YYYY-MM-DD format) - handle DD/MM/YYYY format common in Malaysia
3. TOTAL amount
4. TAX amount (if present) - recognize GST/SST terminology
5. LINE ITEMS (product/service name and price for each item) - handle mixed English-Malay product names
6. CURRENCY used (look for symbols like RM, $, MYR, USD, Ringgit). Default to MYR if ambiguous.
7. PAYMENT METHOD including Malaysian-specific methods:
${SHARED_PAYMENT_METHODS_LIST}
8. Predict a CATEGORY for this expense from: ${SHARED_CATEGORIES}.

${SHARED_MALAYSIAN_BUSINESS_RECOGNITION}

Return your findings in JSON format:
{
  "merchant": "The merchant name",
  "date": "The date in YYYY-MM-DD format",
  "total": "The total amount as a number",
  "tax": "The tax amount as a number",
  "currency": "The currency code (e.g., MYR, USD)",
  "payment_method": "The payment method used",
  "predicted_category": "One of the categories from the list above",
  "line_items": [
    { "description": "Item 1 description", "amount": "Item 1 price as a number" }
  ],
  "confidence": {
    "merchant": "Confidence score 0-100",
    "date": "Confidence score 0-100",
    "total": "Confidence score 0-100",
    "tax": "Confidence score 0-100",
    "currency": "Confidence score 0-100",
    "payment_method": "Confidence score 0-100",
    "predicted_category": "Confidence score 0-100",
    "line_items": "Confidence score 0-100"
  }
}`;
}

/** Minimal-detail vision prompt (Groq fast path). */
function buildGroqVisionPrompt(): string {
  return `You are an AI assistant specialized in analyzing receipt data from images.

Analyze this receipt image and extract:
1. MERCHANT - Store or business name
2. DATE - Date in YYYY-MM-DD format
3. TOTAL - Total amount as a number
4. TAX - Tax amount as a number
5. CURRENCY - Currency code (e.g., MYR, USD)
6. PAYMENT_METHOD - Payment method used
7. PREDICTED_CATEGORY - One of: ${SHARED_CATEGORIES}
8. LINE_ITEMS - Array of items with description and amount
9. CONFIDENCE - Object with confidence scores (0-100)

Return your findings in JSON format:
{
  "merchant": "Store name",
  "date": "YYYY-MM-DD",
  "total": 0.00,
  "tax": 0.00,
  "currency": "MYR",
  "payment_method": "Cash",
  "predicted_category": "Dining",
  "line_items": [{"description": "Item", "amount": 0.00}],
  "confidence": {"merchant": 90, "date": 90, "total": 85, "tax": 70, "currency": 95, "payment_method": 80, "predicted_category": 85, "line_items": 75}
}`;
}
