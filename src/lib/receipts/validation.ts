import { RawReceipt, ProcessedReceipt, ProcessingError, PaymentMethod, ProcessingResult } from './types';
import { getCachedNormalizedMerchant } from './cache';

export function normalizeMerchant(name: string): string {
  return name
    .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
    .replace(/\n/g, ' ')   // Replace newlines with spaces
    .trim()                // Remove leading/trailing whitespace
    .toUpperCase();        // Convert to uppercase
}

export function normalizePaymentMethod(method: string | null | undefined): PaymentMethod {
  if (!method) return 'Unknown';
  
  const methodMap: Record<string, PaymentMethod> = {
    'master': 'Mastercard',
    'mastercard': 'Mastercard',
    'visa': 'Visa',
    'debit card': 'Debit Card',
    'atm card': 'Debit Card',
    'cash': 'Cash'
  };

  const normalizedKey = method.toLowerCase().trim();
  return methodMap[normalizedKey] || 'Unknown';
}

export function validateDate(date: string): ProcessingError | null {
  const parsedDate = new Date(date);
  
  if (isNaN(parsedDate.getTime())) {
    return {
      code: 'INVALID_DATE_FORMAT',
      message: 'Invalid date format',
      field: 'date',
      value: date
    };
  }

  const oneYearFromNow = new Date();
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

  if (parsedDate > oneYearFromNow) {
    return {
      code: 'FUTURE_DATE',
      message: 'Date is more than 1 year in the future',
      field: 'date',
      value: date
    };
  }

  return null;
}

export function normalizeCurrency(currency: string): string {
  return currency.trim().toUpperCase();
}

export function validateTotal(total: number): ProcessingError | null {
  if (typeof total !== 'number' || isNaN(total)) {
    return {
      code: 'INVALID_TOTAL',
      message: 'Total must be a valid number',
      field: 'total',
      value: total
    };
  }

  if (total < 0) {
    return {
      code: 'NEGATIVE_TOTAL',
      message: 'Total cannot be negative',
      field: 'total',
      value: total
    };
  }

  return null;
}

export function processReceipt(rawReceipt: RawReceipt): ProcessingResult {
  const errors: ProcessingError[] = [];
  const warnings: ProcessingError[] = [];
  const confidenceScores: Record<string, number> = {};

  // Validate required fields
  if (!rawReceipt.merchant) {
    errors.push({
      code: 'MISSING_MERCHANT',
      message: 'Merchant name is required',
      field: 'merchant'
    });
  }

  // Validate and normalize date
  const dateError = validateDate(rawReceipt.date);
  if (dateError) {
    errors.push(dateError);
  }

  // Validate total
  const totalError = validateTotal(rawReceipt.total);
  if (totalError) {
    errors.push(totalError);
  }

  // Process the receipt
  const processedReceipt: ProcessedReceipt = {
    ...rawReceipt,
    normalized_merchant: getCachedNormalizedMerchant(rawReceipt.merchant, normalizeMerchant),
    currency_converted: false,
    predicted_category: 'Uncategorized', // This will be enhanced with AI later
    confidence_score: 0,
    processing_date: new Date().toISOString(),
    currency: normalizeCurrency(rawReceipt.currency),
    payment_method: normalizePaymentMethod(rawReceipt.payment_method)
  };

  // Convert USD to MYR if needed
  if (processedReceipt.currency === 'USD') {
    processedReceipt.total *= 4.75; // TODO: Use live exchange rate API
    processedReceipt.currency = 'MYR';
    processedReceipt.currency_converted = true;
  }

  // Set confidence scores
  confidenceScores.merchant = rawReceipt.merchant ? 1.0 : 0;
  confidenceScores.date = dateError ? 0 : 1.0;
  confidenceScores.total = totalError ? 0 : 1.0;
  
  // Calculate overall confidence score
  processedReceipt.confidence_score = Object.values(confidenceScores).reduce((a, b) => a + b, 0) / Object.keys(confidenceScores).length;

  return {
    receipt: processedReceipt,
    errors,
    warnings,
    confidence_scores: confidenceScores
  };
} 