
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
