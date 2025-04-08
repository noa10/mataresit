export type ReceiptStatus = "unreviewed" | "reviewed" | "synced";

// New processing status type for real-time updates
export type ProcessingStatus = 
  | 'uploading' 
  | 'uploaded' 
  | 'processing_ocr' 
  | 'processing_ai' 
  | 'failed_ocr' 
  | 'failed_ai' 
  | 'complete' 
  | null;

// Interface for managing the state during file upload and processing
export interface ReceiptUpload {
  id: string; // Unique ID for tracking the upload instance
  file: File; // The actual file object
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error';
  uploadProgress: number; // Percentage 0-100
  processingStage?: 'queueing' | 'ocr' | 'ai_enhancement' | 'categorization' | string;
  error?: {
    code: 'FILE_TYPE' | 'SIZE_LIMIT' | 'UPLOAD_FAILED' | 'PROCESSING_FAILED' | string;
    message: string;
  } | null;
}

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
  ai_suggestions?: AISuggestions;
  predicted_category?: string;
  // New fields for real-time status updates
  processing_status?: ProcessingStatus;
  processing_error?: string | null;
  confidence_scores?: {
    merchant?: number;
    date?: number;
    total?: number;
    tax?: number;
    line_items?: number;
    payment_method?: number;
  };
  processing_time?: number; // Time taken for backend processing (e.g., in seconds)
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
  ai_suggestions?: AISuggestions;
  predicted_category?: string;
  // Ensure these fields are also in ReceiptWithDetails
  processing_status?: ProcessingStatus;
  processing_error?: string | null;
  processing_time?: number; // Added
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

// Interface for AI suggestions
export interface AISuggestions {
  merchant?: string;
  date?: string;
  total?: number;
  tax?: number;
  [key: string]: any;
}

// Interface for corrections (feedback loop)
export interface Correction {
  id: number;
  receipt_id: string;
  field_name: string;
  original_value: string | null;
  ai_suggestion: string | null;
  corrected_value: string;
  created_at: string;
}
