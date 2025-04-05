/// <reference types="https://deno.land/x/deno/cli/types/v1.39.1/index.d.ts" />
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'; // Keep existing for now
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
  private supabase: ReturnType<typeof createClient>;
  private receiptId: string;
  private initialized: boolean = false;

  constructor(receiptId: string, supabaseUrl?: string, supabaseAnonKey?: string) {
    this.receiptId = receiptId;
    
    const url = supabaseUrl || Deno.env.get('SUPABASE_URL') || 'http://localhost:54321';
    const key = supabaseAnonKey || Deno.env.get('SUPABASE_ANON_KEY') || '';
    
    // Create Supabase client
    this.supabase = createClient(url, key);
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
  async log(message: string, step?: LogStep | string): Promise<boolean> {
    try {
      if (!this.initialized && !(await this.initialize())) {
        console.warn('Unable to log due to initialization failure');
        return false;
      }
      
      const { error } = await this.supabase
        .from('processing_logs')
        .insert({
          receipt_id: this.receiptId,
          status_message: message,
          step_name: step || null
        });
      
      if (error) {
        console.error('Error logging message:', error);
        return false;
      }
      
      console.log(`[${step || 'LOG'}] ${message} (Receipt: ${this.receiptId})`);
      return true;
    } catch (error) {
      console.error('Error in log method:', error);
      return false;
    }
  }

  /**
   * Start logging for a new receipt process
   */
  async start(): Promise<boolean> {
    return await this.log("Starting receipt processing", "START");
  }

  /**
   * Mark processing as complete
   */
  async complete(): Promise<boolean> {
    return await this.log("Receipt processing completed", "COMPLETE");
  }

  /**
   * Log an error
   */
  async error(message: string): Promise<boolean> {
    return await this.log(`Error: ${message}`, "ERROR");
  }
} 