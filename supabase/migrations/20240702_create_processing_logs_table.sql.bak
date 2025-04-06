CREATE TABLE IF NOT EXISTS public.processing_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  receipt_id UUID NOT NULL REFERENCES public.receipts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  status_message TEXT NOT NULL,
  step_name TEXT,
  
  -- Enable row level security
  CONSTRAINT fk_receipt FOREIGN KEY (receipt_id) REFERENCES public.receipts(id) ON DELETE CASCADE
);

-- Set up access control
ALTER TABLE public.processing_logs ENABLE ROW LEVEL SECURITY;

-- Create policies
-- Allow users to view logs for their own receipts
CREATE POLICY "Users can view their own receipt logs" 
ON public.processing_logs
FOR SELECT 
USING (
  auth.uid() IN (
    SELECT user_id FROM public.receipts WHERE id = receipt_id
  )
);

-- Allow service roles to insert logs
CREATE POLICY "Service role can insert logs" 
ON public.processing_logs
FOR INSERT 
TO authenticated
WITH CHECK (true);

-- Enable realtime for the logs table
ALTER PUBLICATION supabase_realtime ADD TABLE public.processing_logs; 