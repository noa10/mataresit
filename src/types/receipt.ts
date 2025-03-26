
export interface Receipt {
  id: string;
  user_id: string;
  merchant: string;
  date: string;
  total: number;
  tax?: number;
  currency: string;
  payment_method?: string;
  status: 'unreviewed' | 'reviewed' | 'synced';
  image_url?: string;
  created_at: string;
  updated_at: string;
}

export interface LineItem {
  id: string;
  receipt_id: string;
  description: string;
  amount: number;
  created_at: string;
  updated_at: string;
}

export interface ConfidenceScore {
  id: string;
  receipt_id: string;
  merchant?: number;
  date?: number;
  total?: number;
  tax?: number;
  line_items?: number;
  created_at: string;
  updated_at: string;
}

export interface ReceiptWithDetails extends Receipt {
  lineItems?: LineItem[];
  confidence?: ConfidenceScore;
}

// Types for OCR results from Amazon Textract
export interface OCRResult {
  merchant: {
    value: string;
    confidence: number;
  };
  date: {
    value: string;
    confidence: number;
  };
  total: {
    value: number;
    confidence: number;
  };
  tax: {
    value: number;
    confidence: number;
  };
  lineItems: {
    items: OCRLineItem[];
    confidence: number;
  };
  fullText: string;
}

export interface OCRLineItem {
  description: string;
  amount: number;
}

// Types for Zoho integration
export interface ZohoCredentials {
  user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface ZohoAuthState {
  state: string;
  user_id: string;
  created_at: string;
}

export interface ZohoSyncResponse {
  success: boolean;
  message: string;
  data: {
    expense_id: string;
  };
}
