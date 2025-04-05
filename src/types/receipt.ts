export type ReceiptStatus = "unreviewed" | "reviewed" | "synced";

export interface Receipt {
  id: string;
  user_id: string;
  merchant: string;
  date: string;
  total: number;
  currency: string;
  image_url: string;
  status: ReceiptStatus;
  created_at: string;
  updated_at: string;
  tax?: number;
  payment_method?: string;
  fullText?: string;
  confidence_scores?: {
    merchant?: number;
    date?: number;
    total?: number;
    tax?: number;
    line_items?: number;
    payment_method?: number;
  };
}

export interface ReceiptLineItem {
  id: string;
  receipt_id: string;
  description: string;
  amount: number;
  created_at?: string;
  updated_at?: string;
}

export interface LineItem {
  id?: string;
  receipt_id?: string;
  description: string;
  amount: number;
  created_at?: string;
  updated_at?: string;
}

export interface ConfidenceScore {
  id: string;
  receipt_id: string;
  merchant: number;
  date: number;
  total: number;
  tax?: number;
  line_items?: number;
  payment_method?: number;
  created_at: string;
  updated_at: string;
}

export interface ReceiptWithDetails extends Omit<Receipt, 'confidence_scores'> {
  lineItems?: ReceiptLineItem[];
  confidence?: {
    merchant?: number;
    date?: number;
    total?: number;
    tax?: number;
    line_items?: number;
    payment_method?: number;
  };
  fullText?: string;
}

export interface OCRResult {
  merchant: string;
  date: string;
  total: number;
  tax?: number;
  payment_method?: string;
  line_items?: LineItem[];
  confidence: {
    merchant: number;
    date: number;
    total: number;
    tax?: number;
    line_items?: number;
    payment_method?: number;
  };
  fullText?: string;
}

// Interface for processing logs
export interface ProcessingLog {
  id: string;
  receipt_id: string;
  created_at: string;
  status_message: string;
  step_name: string | null;
}
