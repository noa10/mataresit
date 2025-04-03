
-- Add fullText column to receipts table to store the raw OCR output
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS fullText TEXT;
