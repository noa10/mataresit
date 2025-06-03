/**
 * Currency utilities for handling currency codes and formatting
 */

// Mapping of common local currency symbols/codes to ISO 4217 codes
export const CURRENCY_CODE_MAPPING: Record<string, string> = {
  // Malaysian Ringgit
  'RM': 'MYR',
  'rm': 'MYR',
  'MYR': 'MYR',
  'myr': 'MYR',
  
  // US Dollar
  '$': 'USD',
  'USD': 'USD',
  'usd': 'USD',
  
  // Singapore Dollar
  'S$': 'SGD',
  'SGD': 'SGD',
  'sgd': 'SGD',
  
  // Euro
  '€': 'EUR',
  'EUR': 'EUR',
  'eur': 'EUR',
  
  // British Pound
  '£': 'GBP',
  'GBP': 'GBP',
  'gbp': 'GBP',
  
  // Japanese Yen
  '¥': 'JPY', // Note: ¥ symbol is used for both JPY and CNY, defaulting to JPY
  'JPY': 'JPY',
  'jpy': 'JPY',

  // Chinese Yuan
  'CNY': 'CNY',
  'cny': 'CNY',
  'RMB': 'CNY',
  'rmb': 'CNY',
  '元': 'CNY', // Chinese yuan symbol
  
  // Thai Baht
  '฿': 'THB',
  'THB': 'THB',
  'thb': 'THB',
  
  // Indonesian Rupiah
  'Rp': 'IDR',
  'IDR': 'IDR',
  'idr': 'IDR',
  
  // Philippine Peso
  '₱': 'PHP',
  'PHP': 'PHP',
  'php': 'PHP',
  
  // Vietnamese Dong
  '₫': 'VND',
  'VND': 'VND',
  'vnd': 'VND',
};

// List of valid ISO 4217 currency codes that are commonly supported
export const SUPPORTED_CURRENCY_CODES = [
  'MYR', 'USD', 'SGD', 'EUR', 'GBP', 'JPY', 'CNY', 'THB', 'IDR', 'PHP', 'VND',
  'AUD', 'CAD', 'CHF', 'HKD', 'KRW', 'TWD', 'INR', 'BRL', 'MXN', 'ZAR'
];

/**
 * Normalizes a currency code to a valid ISO 4217 code
 * @param currencyInput - The input currency code or symbol
 * @param defaultCurrency - Default currency to use if normalization fails
 * @returns Normalized ISO 4217 currency code
 */
export function normalizeCurrencyCode(
  currencyInput: string | null | undefined, 
  defaultCurrency: string = 'MYR'
): string {
  if (!currencyInput) {
    return defaultCurrency;
  }

  const trimmed = currencyInput.trim();
  
  // Check if it's already in our mapping
  const mapped = CURRENCY_CODE_MAPPING[trimmed];
  if (mapped) {
    return mapped;
  }

  // Check if it's already a valid 3-letter ISO code
  const upperCased = trimmed.toUpperCase();
  if (/^[A-Z]{3}$/.test(upperCased) && SUPPORTED_CURRENCY_CODES.includes(upperCased)) {
    return upperCased;
  }

  // If we can't normalize it, return the default
  console.warn(`Unable to normalize currency code: "${currencyInput}", using default: ${defaultCurrency}`);
  return defaultCurrency;
}

/**
 * Validates if a currency code is a valid ISO 4217 code
 * @param currencyCode - The currency code to validate
 * @returns True if valid, false otherwise
 */
export function isValidCurrencyCode(currencyCode: string): boolean {
  if (!currencyCode || typeof currencyCode !== 'string') {
    return false;
  }
  
  const normalized = currencyCode.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) && SUPPORTED_CURRENCY_CODES.includes(normalized);
}

/**
 * Safely formats currency with proper error handling
 * @param amount - The amount to format
 * @param currencyCode - The currency code to use
 * @param locale - The locale for formatting (default: 'en-US')
 * @param fallbackCurrency - Fallback currency if the provided one fails
 * @returns Formatted currency string
 */
export function formatCurrencySafe(
  amount: number | null | undefined,
  currencyCode: string | null | undefined,
  locale: string = 'en-US',
  fallbackCurrency: string = 'MYR'
): string {
  const safeAmount = amount || 0;
  const normalizedCurrency = normalizeCurrencyCode(currencyCode, fallbackCurrency);
  
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: normalizedCurrency,
    }).format(safeAmount);
  } catch (error) {
    console.error(`Error formatting currency with code "${normalizedCurrency}":`, error);
    
    // Try with fallback currency
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: fallbackCurrency,
      }).format(safeAmount);
    } catch (fallbackError) {
      console.error(`Error formatting currency with fallback "${fallbackCurrency}":`, fallbackError);
      
      // Last resort: return a simple formatted number with currency symbol
      return `${fallbackCurrency} ${safeAmount.toFixed(2)}`;
    }
  }
}

/**
 * Gets the currency symbol for a given currency code
 * @param currencyCode - The ISO 4217 currency code
 * @param locale - The locale for symbol formatting
 * @returns Currency symbol or the currency code if symbol cannot be determined
 */
export function getCurrencySymbol(currencyCode: string, locale: string = 'en-US'): string {
  const normalizedCode = normalizeCurrencyCode(currencyCode);
  
  try {
    const formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: normalizedCode,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
    
    // Format 0 to get just the symbol
    const formatted = formatter.format(0);
    // Extract symbol by removing the number
    return formatted.replace(/[\d\s,]/g, '').trim();
  } catch (error) {
    console.error(`Error getting symbol for currency "${normalizedCode}":`, error);
    return normalizedCode;
  }
}

/**
 * Converts currency amounts (basic conversion, should be replaced with live rates in production)
 * @param amount - Amount to convert
 * @param fromCurrency - Source currency code
 * @param toCurrency - Target currency code
 * @returns Converted amount and currency info
 */
export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string = 'MYR'
): { amount: number; currency: string; converted: boolean; rate?: number } {
  const normalizedFrom = normalizeCurrencyCode(fromCurrency);
  const normalizedTo = normalizeCurrencyCode(toCurrency);
  
  if (normalizedFrom === normalizedTo) {
    return { amount, currency: normalizedTo, converted: false };
  }
  
  // Basic conversion rates (should be replaced with live API in production)
  const CONVERSION_RATES: Record<string, Record<string, number>> = {
    'USD': { 'MYR': 4.75 },
    'SGD': { 'MYR': 3.50 },
    'EUR': { 'MYR': 5.20 },
    'GBP': { 'MYR': 6.00 },
  };
  
  const rate = CONVERSION_RATES[normalizedFrom]?.[normalizedTo];
  if (rate) {
    return {
      amount: amount * rate,
      currency: normalizedTo,
      converted: true,
      rate
    };
  }
  
  // If no conversion rate available, return original
  console.warn(`No conversion rate available from ${normalizedFrom} to ${normalizedTo}`);
  return { amount, currency: normalizedFrom, converted: false };
}
