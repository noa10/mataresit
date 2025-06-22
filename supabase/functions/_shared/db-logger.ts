import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Interface for log entries - matches database schema
export interface ProcessingLog {
  id: string;
  receipt_id: string;
  created_at: string;
  status_message: string;
  step_name: string | null;
}

export type LogStep = 'START' | 'FETCH' | 'OPTIMIZE' | 'OCR' | 'AI' | 'THUMBNAIL' | 'SAVE' | 'EMBEDDING' | 'COMPLETE' | 'ERROR' | 'WARNING' | 'DEBUG' | 'METHOD';

/**
 * Unified, robust logger class for tracking receipt processing steps in the database.
 * This logger is designed to never crash the parent function and gracefully handles
 * database errors, RLS issues, and network problems.
 */
export class ProcessingLogger {
  private supabase: SupabaseClient;
  private receiptId: string;
  private loggingEnabled = true;
  private initialized = false;

  constructor(receiptId: string) {
    this.receiptId = receiptId;
    // Use service role key for all logging operations to avoid RLS issues
    this.supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
  }

  /**
   * Initialize the logger by checking if logging is enabled and accessible
   */
  private async initialize(): Promise<boolean> {
    if (this.initialized) return this.loggingEnabled;

    try {
      // Check if the processing_logs table exists and is accessible
      const { error: checkError } = await this.supabase
        .from('processing_logs')
        .select('id', { count: 'exact', head: true });

      if (checkError) {
        // If there's an error, disable logging but don't fail
        console.warn('Processing logs disabled due to error:', checkError.message);
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
   * Log a processing step with resilient error handling
   */
  async log(message: string, step?: LogStep | string): Promise<void> {
    const logMessage = `[${step || 'LOG'}] (Receipt: ${this.receiptId}) ${message}`;
    console.log(logMessage);

    if (!this.loggingEnabled) return;

    try {
      // Initialize if not already done
      if (!this.initialized) {
        await this.initialize();
        if (!this.loggingEnabled) return;
      }

      const { error } = await this.supabase
        .from('processing_logs')
        .insert({
          receipt_id: this.receiptId,
          status_message: message,
          step_name: step || null
        });

      if (error) {
        console.warn('DB logging failed (will disable for this instance):', error.message);
        this.loggingEnabled = false; // Disable DB logging for subsequent calls on this instance
      }
    } catch (e) {
      console.error('Critical DB logging error:', e);
      this.loggingEnabled = false;
    }
  }

  /**
   * Convenience methods for common logging scenarios
   */
  async start(): Promise<void> {
    await this.log("Starting receipt processing", "START");
  }

  async complete(): Promise<void> {
    await this.log("Receipt processing completed", "COMPLETE");
  }

  async error(message: string): Promise<void> {
    await this.log(`Error: ${message}`, "ERROR");
  }

  async warning(message: string): Promise<void> {
    await this.log(`Warning: ${message}`, "WARNING");
  }

  async debug(message: string): Promise<void> {
    await this.log(`Debug: ${message}`, "DEBUG");
  }
}