-- Migration to update existing receipts that used deprecated models
-- This migration updates model_used column to use available models

-- Update receipts that used deprecated Gemini models
UPDATE receipts 
SET model_used = 'gemini-2.0-flash-lite' 
WHERE model_used IN (
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest',
  'gemini-1.5-pro'
);

-- Update receipts that used deprecated OpenRouter models
UPDATE receipts 
SET model_used = 'gemini-2.0-flash-lite' 
WHERE model_used IN (
  'openrouter/google/gemma-3-27b-it:free',
  'openrouter/google/gemma-3n-e4b-it:free',
  'openrouter/mistralai/devstral-small:free',
  'openrouter/nvidia/llama-3.3-nemotron-super-49b-v1:free'
);

-- Update any NULL or empty model_used values to use the default
UPDATE receipts 
SET model_used = 'gemini-2.0-flash-lite' 
WHERE model_used IS NULL OR model_used = '';

-- Add a comment to track this migration
COMMENT ON TABLE receipts IS 'Updated deprecated models to use available models on 2025-02-03';
