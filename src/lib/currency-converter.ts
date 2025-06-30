/**
 * Currency Conversion and Normalization for Mataresit
 * Handles Malaysian business context with proper currency interpretation
 */

export interface CurrencyAmount {
  amount: number;
  currency: 'MYR' | 'USD' | 'SGD' | 'EUR' | 'GBP';
  originalInput?: string;
}

export interface ConversionResult {
  originalAmount: CurrencyAmount;
  convertedAmount: CurrencyAmount;
  exchangeRate: number;
  conversionApplied: boolean;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}

// Exchange rates (in production, these should come from a live API)
const EXCHANGE_RATES: Record<string, number> = {
  'USD_TO_MYR': 4.75,
  'SGD_TO_MYR': 3.50,
  'EUR_TO_MYR': 5.20,
  'GBP_TO_MYR': 6.00,
  'MYR_TO_USD': 0.21,
  'MYR_TO_SGD': 0.29,
  'MYR_TO_EUR': 0.19,
  'MYR_TO_GBP': 0.17,
};

/**
 * Detect currency from user input with Malaysian business context
 */
export function detectCurrencyFromInput(input: string): {
  currency: 'MYR' | 'USD' | 'SGD' | 'EUR' | 'GBP';
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
} {
  const normalizedInput = input.toLowerCase().trim();

  // High confidence indicators
  if (normalizedInput.includes('rm') || normalizedInput.includes('myr') || normalizedInput.includes('ringgit')) {
    return { currency: 'MYR', confidence: 'high', reasoning: 'Explicit MYR/RM/ringgit mentioned' };
  }

  if (normalizedInput.includes('usd') || normalizedInput.includes('dollar') || normalizedInput.includes('us dollar')) {
    return { currency: 'USD', confidence: 'high', reasoning: 'Explicit USD/dollar mentioned' };
  }

  if (normalizedInput.includes('sgd') || normalizedInput.includes('singapore dollar')) {
    return { currency: 'SGD', confidence: 'high', reasoning: 'Explicit SGD mentioned' };
  }

  if (normalizedInput.includes('eur') || normalizedInput.includes('euro')) {
    return { currency: 'EUR', confidence: 'high', reasoning: 'Explicit EUR/euro mentioned' };
  }

  if (normalizedInput.includes('gbp') || normalizedInput.includes('pound') || normalizedInput.includes('sterling')) {
    return { currency: 'GBP', confidence: 'high', reasoning: 'Explicit GBP/pound mentioned' };
  }

  // Medium confidence - symbol-based detection with Malaysian context
  if (normalizedInput.includes('$')) {
    // In Malaysian context, $ often means local currency unless explicitly stated
    if (normalizedInput.includes('us') || normalizedInput.includes('american') || normalizedInput.includes('dollar')) {
      return { currency: 'USD', confidence: 'medium', reasoning: '$ symbol with USD context indicators' };
    }
    if (normalizedInput.includes('sg') || normalizedInput.includes('singapore')) {
      return { currency: 'SGD', confidence: 'medium', reasoning: '$ symbol with Singapore context' };
    }
    // Default $ to MYR in Malaysian business context
    return { currency: 'MYR', confidence: 'medium', reasoning: '$ symbol defaulted to MYR in Malaysian context' };
  }

  // Low confidence - default to MYR for Malaysian business context
  return { currency: 'MYR', confidence: 'low', reasoning: 'No currency indicators found, defaulted to MYR' };
}

/**
 * Parse amount and currency from user input
 */
export function parseAmountAndCurrency(input: string): CurrencyAmount | null {
  const normalizedInput = input.toLowerCase().trim();
  
  // Extract numeric amount
  const amountMatch = normalizedInput.match(/(\d+(?:\.\d{2})?)/);
  if (!amountMatch) {
    return null;
  }

  const amount = parseFloat(amountMatch[1]);
  const currencyDetection = detectCurrencyFromInput(input);

  return {
    amount,
    currency: currencyDetection.currency,
    originalInput: input
  };
}

/**
 * Convert currency amount to target currency
 */
export function convertCurrency(
  fromAmount: CurrencyAmount,
  targetCurrency: 'MYR' | 'USD' | 'SGD' | 'EUR' | 'GBP',
  forceConversion: boolean = false
): ConversionResult {
  // No conversion needed if same currency
  if (fromAmount.currency === targetCurrency && !forceConversion) {
    return {
      originalAmount: fromAmount,
      convertedAmount: fromAmount,
      exchangeRate: 1.0,
      conversionApplied: false,
      confidence: 'high',
      reasoning: 'No conversion needed - same currency'
    };
  }

  const rateKey = `${fromAmount.currency}_TO_${targetCurrency}`;
  const exchangeRate = EXCHANGE_RATES[rateKey];

  if (!exchangeRate) {
    // Fallback: convert through MYR if direct rate not available
    if (fromAmount.currency !== 'MYR' && targetCurrency !== 'MYR') {
      const toMyrRate = EXCHANGE_RATES[`${fromAmount.currency}_TO_MYR`];
      const fromMyrRate = EXCHANGE_RATES[`MYR_TO_${targetCurrency}`];
      
      if (toMyrRate && fromMyrRate) {
        const finalRate = toMyrRate * fromMyrRate;
        return {
          originalAmount: fromAmount,
          convertedAmount: {
            amount: fromAmount.amount * finalRate,
            currency: targetCurrency
          },
          exchangeRate: finalRate,
          conversionApplied: true,
          confidence: 'medium',
          reasoning: `Converted via MYR: ${fromAmount.currency} → MYR → ${targetCurrency}`
        };
      }
    }

    return {
      originalAmount: fromAmount,
      convertedAmount: fromAmount,
      exchangeRate: 1.0,
      conversionApplied: false,
      confidence: 'low',
      reasoning: `No exchange rate available for ${fromAmount.currency} to ${targetCurrency}`
    };
  }

  return {
    originalAmount: fromAmount,
    convertedAmount: {
      amount: fromAmount.amount * exchangeRate,
      currency: targetCurrency
    },
    exchangeRate,
    conversionApplied: true,
    confidence: 'high',
    reasoning: `Direct conversion: ${fromAmount.currency} to ${targetCurrency} at rate ${exchangeRate}`
  };
}

/**
 * Normalize monetary query for database filtering
 * Converts to MYR for consistent database operations
 */
export function normalizeMonetaryQuery(
  input: string,
  amount: number,
  detectedCurrency: 'MYR' | 'USD' | 'SGD' | 'EUR' | 'GBP'
): {
  normalizedAmount: number;
  targetCurrency: 'MYR';
  conversionInfo: ConversionResult;
} {
  const originalAmount: CurrencyAmount = {
    amount,
    currency: detectedCurrency,
    originalInput: input
  };

  const conversionResult = convertCurrency(originalAmount, 'MYR');

  return {
    normalizedAmount: conversionResult.convertedAmount.amount,
    targetCurrency: 'MYR',
    conversionInfo: conversionResult
  };
}

/**
 * Format currency amount for display
 */
export function formatCurrencyAmount(amount: CurrencyAmount): string {
  const { amount: value, currency } = amount;
  
  switch (currency) {
    case 'MYR':
      return `RM${value.toFixed(2)}`;
    case 'USD':
      return `$${value.toFixed(2)} USD`;
    case 'SGD':
      return `$${value.toFixed(2)} SGD`;
    case 'EUR':
      return `€${value.toFixed(2)}`;
    case 'GBP':
      return `£${value.toFixed(2)}`;
    default:
      return `${value.toFixed(2)} ${currency}`;
  }
}

/**
 * Get current exchange rates (placeholder for live API integration)
 */
export async function updateExchangeRates(): Promise<void> {
  // TODO: Integrate with live exchange rate API
  // For now, using static rates
  console.log('Using static exchange rates. TODO: Integrate live API');
}
