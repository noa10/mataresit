export type ReceiptStatus = "unreviewed" | "reviewed";

// New processing status type for real-time updates
export type ProcessingStatus =
  | 'uploading'
  | 'uploaded'
  | 'processing'
  | 'failed'
  | 'complete'
  | null;

// Interface for managing the state during file upload and processing
export interface ReceiptUpload {
  id: string; // Unique ID for tracking the upload instance
  file: File; // The actual file object
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error';
  uploadProgress: number; // Percentage 0-100
  processingStage?: 'queueing' | 'ai_processing' | 'categorization' | string;
  categoryId?: string | null; // Optional category assignment
  retryCount?: number; // Number of retry attempts
  processingStartedAt?: Date; // When processing started
  error?: {
    code: 'FILE_TYPE' | 'SIZE_LIMIT' | 'UPLOAD_FAILED' | 'PROCESSING_FAILED' | string;
    message: string;
  } | null;
}

export interface ReceiptItem {
  id: string;
  receipt_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface Receipt {
  id: string;
  date: string;
  merchant: string;
  total: number;
  payment_method: string;
  image_url?: string;
  thumbnail_url?: string | null;
  status: ReceiptStatus;
  created_at: string;
  updated_at: string;
  tax?: number;
  currency: string;
  fullText?: string;
  ai_suggestions?: AISuggestions;
  predicted_category?: string;
  // Custom category support
  custom_category_id?: string | null;
  // Team collaboration support
  team_id?: string | null;
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
  // New fields for AI model selection
  model_used?: string; // The AI model used for processing
}

export interface ReceiptLineItem {
  id: string;
  receipt_id: string;
  description: string;
  amount: number;
  created_at?: string;
  updated_at?: string;
  geometry?: LineItemGeometry;
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

// ReceiptWithDetails now inherits confidence_scores from Receipt
// Define geometry types for bounding boxes
export interface BoundingBox {
  Left: number;
  Top: number;
  Width: number;
  Height: number;
}

export interface Polygon {
  points: Array<{ X: number; Y: number }>;
}

export interface GeometryData {
  boundingBox?: BoundingBox;
  polygon?: Polygon;
}

export interface FieldGeometry {
  merchant?: GeometryData;
  date?: GeometryData;
  total?: GeometryData;
  tax?: GeometryData;
  payment_method?: GeometryData;
  [key: string]: GeometryData | undefined;
}

export interface LineItemGeometry {
  item?: GeometryData;
  price?: GeometryData;
  combined?: BoundingBox;
}

export interface DocumentStructure {
  blocks: Array<any>;
  page_dimensions: {
    width: number;
    height: number;
  };
}

export interface ReceiptWithDetails extends Receipt {
  lineItems?: ReceiptLineItem[];
  fullText?: string;
  ai_suggestions?: AISuggestions;
  predicted_category?: string;
  processing_status?: ProcessingStatus;
  processing_error?: string | null;
  processing_time?: number;
  model_used?: string;
  // Custom category details
  custom_category?: CustomCategory | null;
  // New fields for bounding box visualization
  field_geometry?: FieldGeometry;
  document_structure?: DocumentStructure;
}

// AI processing result interface for receipt data extraction
export interface AIResult {
  merchant: string;
  date: string | null; // Allow null for invalid dates
  total: number;
  tax?: number;
  payment_method?: string;
  line_items?: LineItem[];
  confidence_scores?: {
    merchant?: number;
    date?: number;
    total?: number;
    tax?: number;
    line_items?: number;
    payment_method?: number;
  };
  fullText?: string;
  currency?: string;
  ai_suggestions?: AISuggestions;
  predicted_category?: string;
  modelUsed?: string;
  processing_time?: number;
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

// Interface for custom categories
export interface CustomCategory {
  id: string;
  user_id: string;
  name: string;
  color: string;
  icon: string;
  created_at: string;
  updated_at: string;
  receipt_count?: number; // Optional, included when fetching with counts
  team_id?: string | null; // Team ID for team-shared categories, null for personal
  is_team_category?: boolean; // Whether this is a team category
}

// Interface for category creation/update
export interface CreateCategoryRequest {
  name: string;
  color?: string;
  icon?: string;
}

export interface UpdateCategoryRequest {
  name?: string;
  color?: string;
  icon?: string;
}

// Interface for bulk category assignment
export interface BulkCategoryAssignmentRequest {
  receipt_ids: string[];
  category_id?: string | null; // null to remove category
}

// Interface for category deletion with reassignment
export interface DeleteCategoryRequest {
  category_id: string;
  reassign_to_category_id?: string | null;
}
