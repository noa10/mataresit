/// <reference types="https://deno.land/x/deno/cli/types/v1.39.1/index.d.ts" />
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
  private loggingEnabled: boolean = false;

  constructor(receiptId: string, supabaseUrl?: string, supabaseAnonKey?: string) {
    this.receiptId = receiptId;
    
    const url = supabaseUrl || Deno.env.get('SUPABASE_URL') || 'http://localhost:54331';
    const key = supabaseAnonKey || Deno.env.get('SUPABASE_ANON_KEY') || '';
    
    // Create Supabase client
    this.supabase = createClient(url, key);
  }

  /**
   * Initialize the logger by checking if logging is enabled
   */
  async initialize(): Promise<boolean> {
    if (this.initialized) return this.loggingEnabled;
    
    try {
      // Check if the processing_logs table exists and is accessible
      const { error: checkError } = await this.supabase
        .from('processing_logs')
        .select('id', { count: 'exact', head: true });
      
      if (checkError) {
        // If there's an error, disable logging but don't fail
        console.warn('Processing logs disabled due to error:', checkError);
        this.loggingEnabled = false;
      } else {
        this.loggingEnabled = true;
      }
      
      this.initialized = true;
      return this.loggingEnabled;
    } catch (error) {
      console.warn('Error initializing logger, disabling logging:', error);
      this.initialized = true;
      this.loggingEnabled = false;
      return false;
    }
  }

  /**
   * Log a processing step
   */
  async log(message: string, step?: LogStep | string): Promise<boolean> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      // Always log to console regardless of DB logging status
      console.log(`[${step || 'LOG'}] ${message} (Receipt: ${this.receiptId})`);
      
      // Skip DB logging if disabled
      if (!this.loggingEnabled) {
        return true;
      }
      
      try {
        const { error } = await this.supabase
          .from('processing_logs')
          .insert({
            receipt_id: this.receiptId,
            status_message: message,
            step_name: step || null
          });
        
        if (error) {
          // If we get an RLS error, disable logging for future calls
          if (error.code === '42501') {
            console.warn('Row-level security policy violation, disabling DB logging');
            this.loggingEnabled = false;
          } else {
            console.error('Error logging message:', error);
          }
          return true; // Still return true since we logged to console
        }
        
        return true;
      } catch (dbError) {
        console.error('Database error in log method:', dbError);
        this.loggingEnabled = false; // Disable for future calls
        return true; // Still return true since we logged to console
      }
    } catch (error) {
      console.error('Unexpected error in log method:', error);
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
