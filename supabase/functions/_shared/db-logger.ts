import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Interface for log entries
export interface ProcessingLog {
  receipt_id: string;
  status_message: string;
  step_name?: string;
}

export type LogStep = 'START' | 'FETCH' | 'OCR' | 'EXTRACT' | 'GEMINI' | 'SAVE' | 'COMPLETE' | 'ERROR';

/**
 * Logger class for tracking receipt processing steps in the database
 */
export class ProcessingLogger {
  private receiptId: string;
  private supabase: any;
  private initialized: boolean = false;

  constructor(receiptId: string, supabaseUrl: string, supabaseKey: string) {
    this.receiptId = receiptId;
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Initialize the logger by ensuring the table exists
   */
  async initialize(): Promise<boolean> {
    if (this.initialized) return true;
    
    try {
      // Check if the processing_logs table exists
      const { error: checkError } = await this.supabase
        .from('processing_logs')
        .select('id', { count: 'exact', head: true });
      
      // If table doesn't exist, create it
      if (checkError && checkError.code === 'PGRST109') {
        console.log('Creating processing_logs table...');
        
        const createTableSQL = `
          CREATE TABLE IF NOT EXISTS public.processing_logs (
            id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
            receipt_id uuid NOT NULL,
            created_at timestamp with time zone DEFAULT now() NOT NULL,
            status_message text NOT NULL,
            step_name text NULL
          );
          CREATE INDEX IF NOT EXISTS idx_processing_logs_receipt_id 
            ON public.processing_logs USING btree (receipt_id);
        `;
        
        const { error: createError } = await this.supabase.rpc('exec_sql', { sql: createTableSQL });
        
        if (createError) {
          console.error('Error creating table:', createError);
          return false;
        }
      } else if (checkError) {
        console.error('Error checking table:', checkError);
        return false;
      }
      
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('Error initializing logger:', error);
      return false;
    }
  }

  /**
   * Log a processing step
   */
  async log(message: string, step?: LogStep): Promise<void> {
    try {
      if (!this.initialized && !(await this.initialize())) {
        console.warn('Unable to log due to initialization failure');
        return;
      }
      
      const { error } = await this.supabase
        .from('processing_logs')
        .insert({
          receipt_id: this.receiptId,
          status_message: message,
          step_name: step || null
        });
      
      if (error) {
        console.error("Error logging to database:", error);
      }
    } catch (err) {
      console.error("Failed to log message:", err);
    }
  }

  async start(): Promise<void> {
    await this.log("Starting receipt processing", "START");
  }

  async complete(): Promise<void> {
    await this.log("Receipt processing completed", "COMPLETE");
  }

  async error(message: string): Promise<void> {
    await this.log(`Error: ${message}`, "ERROR");
  }
} 