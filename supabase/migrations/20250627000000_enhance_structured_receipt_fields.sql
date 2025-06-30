-- Enhanced Structured Receipt Data Fields for Precise Querying
-- This migration adds dedicated indexed columns for structured receipt data
-- to enable precise data-driven queries as outlined in the chatbot enhancement plan

-- Add enhanced structured fields to receipts table
ALTER TABLE public.receipts 
ADD COLUMN IF NOT EXISTS merchant_normalized TEXT,
ADD COLUMN IF NOT EXISTS merchant_category VARCHAR(100),
ADD COLUMN IF NOT EXISTS business_type VARCHAR(100),
ADD COLUMN IF NOT EXISTS location_city VARCHAR(100),
ADD COLUMN IF NOT EXISTS location_state VARCHAR(50),
ADD COLUMN IF NOT EXISTS location_country VARCHAR(50) DEFAULT 'Malaysia',
ADD COLUMN IF NOT EXISTS receipt_type VARCHAR(50), -- 'purchase', 'refund', 'exchange', 'service'
ADD COLUMN IF NOT EXISTS transaction_time TIME,
ADD COLUMN IF NOT EXISTS item_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS service_charge DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS tip_amount DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS subtotal DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS total_before_tax DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS cashier_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS receipt_number VARCHAR(100),
ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS loyalty_program VARCHAR(100),
ADD COLUMN IF NOT EXISTS loyalty_points INTEGER,
ADD COLUMN IF NOT EXISTS payment_card_last4 VARCHAR(4),
ADD COLUMN IF NOT EXISTS payment_approval_code VARCHAR(50),
ADD COLUMN IF NOT EXISTS is_business_expense BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS expense_type VARCHAR(100), -- 'meal', 'travel', 'office_supplies', etc.
ADD COLUMN IF NOT EXISTS vendor_registration_number VARCHAR(100),
ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(100),
ADD COLUMN IF NOT EXISTS purchase_order_number VARCHAR(100);

-- Add enhanced line item analysis fields
ALTER TABLE public.receipts 
ADD COLUMN IF NOT EXISTS line_items_analysis JSONB, -- Structured analysis of line items
ADD COLUMN IF NOT EXISTS spending_patterns JSONB, -- AI-detected spending patterns
ADD COLUMN IF NOT EXISTS anomaly_flags JSONB, -- Unusual transaction indicators
ADD COLUMN IF NOT EXISTS extraction_metadata JSONB; -- LLM extraction metadata

-- Create indexes for efficient querying on structured fields
CREATE INDEX IF NOT EXISTS idx_receipts_merchant_normalized ON public.receipts (merchant_normalized);
CREATE INDEX IF NOT EXISTS idx_receipts_merchant_category ON public.receipts (merchant_category);
CREATE INDEX IF NOT EXISTS idx_receipts_business_type ON public.receipts (business_type);
CREATE INDEX IF NOT EXISTS idx_receipts_location_city ON public.receipts (location_city);
CREATE INDEX IF NOT EXISTS idx_receipts_location_state ON public.receipts (location_state);
CREATE INDEX IF NOT EXISTS idx_receipts_receipt_type ON public.receipts (receipt_type);
CREATE INDEX IF NOT EXISTS idx_receipts_expense_type ON public.receipts (expense_type);
CREATE INDEX IF NOT EXISTS idx_receipts_is_business_expense ON public.receipts (is_business_expense);
CREATE INDEX IF NOT EXISTS idx_receipts_item_count ON public.receipts (item_count);
CREATE INDEX IF NOT EXISTS idx_receipts_subtotal ON public.receipts (subtotal);
CREATE INDEX IF NOT EXISTS idx_receipts_total_before_tax ON public.receipts (total_before_tax);
CREATE INDEX IF NOT EXISTS idx_receipts_discount_amount ON public.receipts (discount_amount);
CREATE INDEX IF NOT EXISTS idx_receipts_service_charge ON public.receipts (service_charge);

-- Create composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_receipts_date_merchant_category ON public.receipts (date, merchant_category);
CREATE INDEX IF NOT EXISTS idx_receipts_user_expense_type ON public.receipts (user_id, expense_type);
CREATE INDEX IF NOT EXISTS idx_receipts_business_expense_date ON public.receipts (is_business_expense, date) WHERE is_business_expense = true;
CREATE INDEX IF NOT EXISTS idx_receipts_location_date ON public.receipts (location_city, location_state, date);
CREATE INDEX IF NOT EXISTS idx_receipts_amount_range ON public.receipts (total, date);

-- Create GIN indexes for JSONB fields to enable efficient JSON queries
CREATE INDEX IF NOT EXISTS idx_receipts_line_items_analysis_gin ON public.receipts USING GIN (line_items_analysis);
CREATE INDEX IF NOT EXISTS idx_receipts_spending_patterns_gin ON public.receipts USING GIN (spending_patterns);
CREATE INDEX IF NOT EXISTS idx_receipts_anomaly_flags_gin ON public.receipts USING GIN (anomaly_flags);
CREATE INDEX IF NOT EXISTS idx_receipts_extraction_metadata_gin ON public.receipts USING GIN (extraction_metadata);

-- Add comments to document the purpose of new fields
COMMENT ON COLUMN public.receipts.merchant_normalized IS 'Standardized merchant name for consistent querying';
COMMENT ON COLUMN public.receipts.merchant_category IS 'Business category (grocery, restaurant, gas_station, etc.)';
COMMENT ON COLUMN public.receipts.business_type IS 'Type of business (retail, service, restaurant, etc.)';
COMMENT ON COLUMN public.receipts.location_city IS 'City where transaction occurred';
COMMENT ON COLUMN public.receipts.location_state IS 'State/province where transaction occurred';
COMMENT ON COLUMN public.receipts.receipt_type IS 'Type of transaction (purchase, refund, exchange, service)';
COMMENT ON COLUMN public.receipts.transaction_time IS 'Time of day when transaction occurred';
COMMENT ON COLUMN public.receipts.item_count IS 'Number of distinct items purchased';
COMMENT ON COLUMN public.receipts.discount_amount IS 'Total discount amount applied';
COMMENT ON COLUMN public.receipts.service_charge IS 'Service charge amount';
COMMENT ON COLUMN public.receipts.tip_amount IS 'Tip/gratuity amount';
COMMENT ON COLUMN public.receipts.subtotal IS 'Subtotal before tax and charges';
COMMENT ON COLUMN public.receipts.total_before_tax IS 'Total amount before tax';
COMMENT ON COLUMN public.receipts.cashier_name IS 'Name of cashier who processed transaction';
COMMENT ON COLUMN public.receipts.receipt_number IS 'Receipt number from merchant system';
COMMENT ON COLUMN public.receipts.transaction_id IS 'Unique transaction identifier';
COMMENT ON COLUMN public.receipts.loyalty_program IS 'Loyalty program used (if any)';
COMMENT ON COLUMN public.receipts.loyalty_points IS 'Loyalty points earned or redeemed';
COMMENT ON COLUMN public.receipts.payment_card_last4 IS 'Last 4 digits of payment card';
COMMENT ON COLUMN public.receipts.payment_approval_code IS 'Payment approval/authorization code';
COMMENT ON COLUMN public.receipts.is_business_expense IS 'Whether this is a business expense';
COMMENT ON COLUMN public.receipts.expense_type IS 'Type of expense for categorization';
COMMENT ON COLUMN public.receipts.vendor_registration_number IS 'Vendor business registration number';
COMMENT ON COLUMN public.receipts.invoice_number IS 'Invoice number (for business receipts)';
COMMENT ON COLUMN public.receipts.purchase_order_number IS 'Purchase order number (for business receipts)';
COMMENT ON COLUMN public.receipts.line_items_analysis IS 'Structured analysis of line items with categories and patterns';
COMMENT ON COLUMN public.receipts.spending_patterns IS 'AI-detected spending patterns and insights';
COMMENT ON COLUMN public.receipts.anomaly_flags IS 'Flags for unusual transactions or potential issues';
COMMENT ON COLUMN public.receipts.extraction_metadata IS 'Metadata about LLM extraction process and confidence scores';

-- Create a view for enhanced receipt queries
CREATE OR REPLACE VIEW public.receipts_enhanced AS
SELECT 
  r.*,
  -- Calculate derived fields
  CASE 
    WHEN r.total > 0 AND r.tax > 0 THEN (r.tax / r.total * 100)
    ELSE 0 
  END as tax_percentage,
  
  CASE 
    WHEN r.discount_amount > 0 AND r.subtotal > 0 THEN (r.discount_amount / r.subtotal * 100)
    ELSE 0 
  END as discount_percentage,
  
  -- Extract hour from transaction time for time-based analysis
  EXTRACT(HOUR FROM r.transaction_time) as transaction_hour,
  
  -- Calculate average item price
  CASE 
    WHEN r.item_count > 0 AND r.subtotal > 0 THEN (r.subtotal / r.item_count)
    ELSE 0 
  END as average_item_price,
  
  -- Business expense indicator with enhanced logic
  CASE 
    WHEN r.is_business_expense = true OR r.expense_type IN ('business_meal', 'office_supplies', 'travel_business') THEN true
    ELSE false 
  END as is_likely_business_expense

FROM public.receipts r;

-- Add RLS policy for the enhanced view
CREATE POLICY "Users can view their own enhanced receipts"
ON public.receipts_enhanced
FOR SELECT
TO public
USING (auth.uid() = user_id);

-- Grant access to the enhanced view
GRANT SELECT ON public.receipts_enhanced TO authenticated;
GRANT SELECT ON public.receipts_enhanced TO anon;
