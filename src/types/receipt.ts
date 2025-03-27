
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
  confidence?: number;
  line_items?: ReceiptLineItem[];
}

export interface ReceiptLineItem {
  id: string;
  receipt_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}
