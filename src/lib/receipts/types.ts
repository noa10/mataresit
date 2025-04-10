export interface RawReceipt {
  merchant: string;
  date: string;
  total: number;
  currency: string;
  payment_method?: string;
  tax?: number;
  items?: ReceiptItem[];
}

export interface ReceiptItem {
  name: string;
  quantity: number;
  price: number;
  total: number;
}

export interface ProcessedReceipt extends RawReceipt {
  normalized_merchant: string;
  currency_converted: boolean;
  predicted_category: string;
  confidence_score: number;
  processing_date: string;
}

export type PaymentMethod = 
  | 'Mastercard'
  | 'Visa'
  | 'Debit Card'
  | 'Cash'
  | 'Unknown';

export interface ProcessingError {
  code: string;
  message: string;
  field?: string;
  value?: unknown;
}

export interface ProcessingResult {
  receipt: ProcessedReceipt;
  errors: ProcessingError[];
  warnings: ProcessingError[];
  confidence_scores: {
    [field: string]: number;
  };
} 