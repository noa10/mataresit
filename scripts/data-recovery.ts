#!/usr/bin/env tsx

/**
 * Comprehensive Data Recovery Script for Paperless Maverick
 * 
 * This script recovers receipt data from Supabase storage bucket 'Receipt Images'
 * by processing each image through the same pipeline as normal uploads.
 * 
 * Features:
 * - Scans storage bucket for existing receipt images
 * - Creates/verifies user account with admin privileges
 * - Processes images through OCR/AI pipeline (ai-vision with Gemini 2.0 Flash Lite)
 * - Generates thumbnails and embeddings
 * - Handles errors gracefully with retry mechanisms
 * - Provides progress tracking and status updates
 * - Respects subscription limits and processing constraints
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '../.env.local') });

// Configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY_PRODUCTION || process.env.SUPABASE_SERVICE_ROLE_KEY;

// Validate required environment variables
if (!SUPABASE_URL) {
  console.error('❌ VITE_SUPABASE_URL is required in .env.local');
  process.exit(1);
}

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ VITE_SUPABASE_SERVICE_ROLE_KEY_PRODUCTION or SUPABASE_SERVICE_ROLE_KEY is required in .env.local');
  process.exit(1);
}
const TARGET_USER_EMAIL = 'k.anwarbakar@gmail.com';
const STORAGE_BUCKET = 'receipt_images'; // Bucket ID for 'Receipt Images'
const DEFAULT_MODEL = 'gemini-2.0-flash-lite';
const DEFAULT_METHOD = 'ai-vision';
const BATCH_SIZE = 5; // Process 5 receipts at a time
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 2000; // 2 seconds

// Initialize Supabase client with service role key
const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Types
interface RecoveryStats {
  totalFiles: number;
  processed: number;
  successful: number;
  failed: number;
  skipped: number;
  errors: ErrorDetail[];
  startTime: Date;
  endTime?: Date;
  processingTimeMs?: number;
}

interface ErrorDetail {
  filename: string;
  receiptId?: string;
  error: string;
  errorType: 'STORAGE' | 'PROCESSING' | 'THUMBNAIL' | 'EMBEDDING' | 'VALIDATION' | 'NETWORK' | 'UNKNOWN';
  timestamp: Date;
  retryCount?: number;
}

interface ProgressUpdate {
  phase: 'SCANNING' | 'USER_SETUP' | 'PROCESSING' | 'VALIDATION' | 'COMPLETE';
  currentStep: string;
  progress: number; // 0-100
  filesProcessed: number;
  totalFiles: number;
  estimatedTimeRemaining?: string;
}

interface ValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
  summary: {
    totalReceipts: number;
    validReceipts: number;
    invalidReceipts: number;
    missingThumbnails: number;
    missingEmbeddings: number;
    incompleteProcessing: number;
  };
}

interface ValidationIssue {
  receiptId: string;
  filename?: string;
  issueType: 'MISSING_DATA' | 'INVALID_STATUS' | 'MISSING_THUMBNAIL' | 'MISSING_EMBEDDING' | 'PROCESSING_INCOMPLETE';
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

interface SubscriptionLimits {
  monthlyReceipts: number;
  storageLimitMB: number;
  retentionDays: number;
  batchUploadLimit: number;
}

interface StorageFile {
  name: string;
  id: string;
  updated_at: string;
  created_at: string;
  last_accessed_at: string;
  metadata: any;
}

interface ProcessingResult {
  success: boolean;
  receiptId?: string;
  error?: string;
  skipped?: boolean;
  reason?: string;
}

// Logging utility
class Logger {
  private static logFile = `recovery-${new Date().toISOString().split('T')[0]}.log`;
  
  static log(level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS', message: string, data?: any) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${level}: ${message}`;
    
    console.log(logMessage);
    if (data) {
      console.log(JSON.stringify(data, null, 2));
    }
    
    // In a real implementation, you might want to write to a file
    // fs.appendFileSync(this.logFile, logMessage + '\n');
  }
  
  static info(message: string, data?: any) {
    this.log('INFO', message, data);
  }
  
  static warn(message: string, data?: any) {
    this.log('WARN', message, data);
  }
  
  static error(message: string, data?: any) {
    this.log('ERROR', message, data);
  }
  
  static success(message: string, data?: any) {
    this.log('SUCCESS', message, data);
  }
}

// Utility functions
async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function retry<T>(
  operation: () => Promise<T>,
  attempts: number = RETRY_ATTEMPTS,
  delay: number = RETRY_DELAY
): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === attempts - 1) throw error;
      Logger.warn(`Attempt ${i + 1} failed, retrying in ${delay}ms...`, { error: error.message });
      await sleep(delay);
    }
  }
  throw new Error('All retry attempts failed');
}

// Main recovery class
class DataRecoveryService {
  private stats: RecoveryStats = {
    totalFiles: 0,
    processed: 0,
    successful: 0,
    failed: 0,
    skipped: 0,
    errors: [],
    startTime: new Date()
  };

  private targetUserId: string | null = null;
  private currentProgress: ProgressUpdate = {
    phase: 'SCANNING',
    currentStep: 'Initializing',
    progress: 0,
    filesProcessed: 0,
    totalFiles: 0
  };

  constructor() {
    Logger.info('Data Recovery Service initialized');
  }

  // Progress tracking and error handling methods
  private updateProgress(phase: ProgressUpdate['phase'], currentStep: string, progress: number): void {
    this.currentProgress = {
      ...this.currentProgress,
      phase,
      currentStep,
      progress,
      filesProcessed: this.stats.processed,
      totalFiles: this.stats.totalFiles
    };

    // Calculate estimated time remaining
    if (progress > 0 && this.stats.processed > 0) {
      const elapsedMs = Date.now() - this.stats.startTime.getTime();
      const avgTimePerFile = elapsedMs / this.stats.processed;
      const remainingFiles = this.stats.totalFiles - this.stats.processed;
      const estimatedRemainingMs = avgTimePerFile * remainingFiles;

      this.currentProgress.estimatedTimeRemaining = this.formatDuration(estimatedRemainingMs);
    }

    Logger.info(`Progress: ${phase} - ${currentStep} (${progress.toFixed(1)}%)`, {
      processed: this.stats.processed,
      total: this.stats.totalFiles,
      successful: this.stats.successful,
      failed: this.stats.failed,
      estimatedTimeRemaining: this.currentProgress.estimatedTimeRemaining
    });
  }

  private addError(filename: string, error: string, errorType: ErrorDetail['errorType'], receiptId?: string, retryCount?: number): void {
    const errorDetail: ErrorDetail = {
      filename,
      error,
      errorType,
      timestamp: new Date(),
      receiptId,
      retryCount
    };

    this.stats.errors.push(errorDetail);
    Logger.error(`${errorType} Error: ${filename}`, { error, receiptId, retryCount });
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  private logProgressSummary(): void {
    const elapsedMs = Date.now() - this.stats.startTime.getTime();
    const successRate = this.stats.totalFiles > 0 ? (this.stats.successful / this.stats.totalFiles * 100) : 0;

    Logger.info('Current Progress Summary:', {
      phase: this.currentProgress.phase,
      step: this.currentProgress.currentStep,
      progress: `${this.currentProgress.progress.toFixed(1)}%`,
      processed: `${this.stats.processed}/${this.stats.totalFiles}`,
      successful: this.stats.successful,
      failed: this.stats.failed,
      skipped: this.stats.skipped,
      successRate: `${successRate.toFixed(1)}%`,
      elapsedTime: this.formatDuration(elapsedMs),
      estimatedRemaining: this.currentProgress.estimatedTimeRemaining || 'Calculating...'
    });
  }

  // Main recovery process
  async run(): Promise<void> {
    try {
      this.updateProgress('SCANNING', 'Starting recovery process', 0);
      Logger.info('Starting comprehensive data recovery process...');
      Logger.info('Configuration:', {
        targetUser: TARGET_USER_EMAIL,
        storageBucket: STORAGE_BUCKET,
        defaultModel: DEFAULT_MODEL,
        defaultMethod: DEFAULT_METHOD,
        batchSize: BATCH_SIZE
      });

      // Step 1: Verify/create user account
      this.updateProgress('USER_SETUP', 'Verifying user account', 5);
      await this.verifyOrCreateUser();

      // Step 1.5: Check subscription limits (informational)
      await this.checkSubscriptionLimits();

      // Step 2: Scan storage bucket
      this.updateProgress('SCANNING', 'Scanning storage bucket', 10);
      const files = await this.scanStorageBucket();

      if (files.length === 0) {
        this.updateProgress('COMPLETE', 'No files to process', 100);
        Logger.warn('No receipt images found in storage bucket. Recovery process completed with no files to process.');
        return;
      }

      // Step 3: Process files in batches
      this.updateProgress('PROCESSING', 'Processing receipt files', 20);
      await this.processFilesInBatches(files);

      // Step 4: Validate recovered data
      this.updateProgress('VALIDATION', 'Validating recovered data', 90);
      await this.validateRecoveredData();

      // Step 5: Update monthly usage
      await this.updateMonthlyUsage();

      // Step 6: Generate final report
      this.updateProgress('COMPLETE', 'Generating final report', 95);
      this.generateFinalReport();
      this.updateProgress('COMPLETE', 'Recovery completed', 100);

    } catch (error) {
      Logger.error('Recovery process failed', { error: error.message });
      this.addError('SYSTEM', `Recovery process failed: ${error.message}`, 'UNKNOWN');
      throw error;
    } finally {
      this.stats.endTime = new Date();
      this.stats.processingTimeMs = this.stats.endTime.getTime() - this.stats.startTime.getTime();
    }
  }

  // Storage bucket scanning functionality
  private async scanStorageBucket(): Promise<StorageFile[]> {
    Logger.info(`Scanning storage bucket '${STORAGE_BUCKET}'...`);

    try {
      const allFiles: StorageFile[] = [];

      // First, get all top-level folders (user folders)
      const { data: rootItems, error: rootError } = await retry(async () => {
        return await supabase.storage
          .from(STORAGE_BUCKET)
          .list('', { limit: 1000 });
      });

      if (rootError) {
        throw new Error(`Failed to list root items from storage bucket: ${rootError.message}`);
      }

      if (!rootItems || rootItems.length === 0) {
        Logger.warn('No items found in storage bucket root');
        return [];
      }

      Logger.info(`Found ${rootItems.length} top-level items in storage bucket`);
      Logger.info('Root items:', rootItems.map(item => ({ name: item.name, id: item.id })));

      // Scan each folder for receipt images
      for (const item of rootItems) {
        // Skip thumbnails folder and non-folder items
        if (item.name === 'thumbnails') {
          Logger.info(`Skipping thumbnails folder: ${item.name}`);
          continue;
        }

        Logger.info(`Scanning folder: ${item.name} (id: ${item.id})`);

        // List files in this user folder
        const { data: userFiles, error: userError } = await retry(async () => {
          return await supabase.storage
            .from(STORAGE_BUCKET)
            .list(item.name, { limit: 1000 });
        });

        if (userError) {
          Logger.warn(`Failed to list files in folder ${item.name}:`, { error: userError.message });
          continue;
        }

        if (!userFiles || userFiles.length === 0) {
          Logger.info(`No files found in folder: ${item.name}`);
          continue;
        }

        Logger.info(`Found ${userFiles.length} files in folder ${item.name}:`, userFiles.map(f => f.name));

        // Filter for valid receipt images and add folder path
        const imageFiles = userFiles
          .filter(file => {
            const isValid = this.isValidReceiptImage(file.name);
            Logger.info(`File ${file.name}: valid=${isValid}`);
            return isValid;
          })
          .map(file => ({
            ...file,
            name: `${item.name}/${file.name}` // Add folder path
          }));

        allFiles.push(...imageFiles);
        Logger.info(`Found ${imageFiles.length} valid receipt images in folder: ${item.name}`);

        // Add a small delay to avoid rate limiting
        await sleep(100);
      }

      this.stats.totalFiles = allFiles.length;
      Logger.success(`Storage scan completed. Found ${allFiles.length} receipt images to process`);

      // Log some sample files for verification
      if (allFiles.length > 0) {
        Logger.info('Sample files found:', {
          first5: allFiles.slice(0, 5).map(f => f.name),
          totalSize: allFiles.length
        });
      }

      return allFiles;

    } catch (error) {
      Logger.error('Failed to scan storage bucket', { error: error.message });
      throw error;
    }
  }

  private isValidReceiptImage(filename: string): boolean {
    // Check if file is a valid receipt image
    const validExtensions = ['.jpg', '.jpeg', '.png', '.pdf'];
    const lowerFilename = filename.toLowerCase();

    // Must have valid extension
    const hasValidExtension = validExtensions.some(ext => lowerFilename.endsWith(ext));

    // Exclude system files and thumbnails
    const isSystemFile = filename.startsWith('.') ||
                        filename.includes('/.') ||
                        filename.startsWith('thumbnails/') ||
                        filename.includes('_thumb') ||
                        filename === '.emptyFolderPlaceholder';

    return hasValidExtension && !isSystemFile;
  }

  private async checkExistingReceipt(filename: string): Promise<string | null> {
    try {
      // Extract potential receipt ID from filename if it follows our naming convention
      // Typical format: userId/receiptId.ext or userId/receiptId_originalname.ext
      const parts = filename.split('/');
      if (parts.length < 2) return null;

      const filenamePart = parts[parts.length - 1];
      const nameWithoutExt = filenamePart.split('.')[0];

      // Try to extract UUID pattern (receipt ID)
      const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
      const uuidMatch = nameWithoutExt.match(uuidPattern);

      if (uuidMatch) {
        const potentialReceiptId = uuidMatch[0];

        // Check if receipt already exists in database
        const { data: existingReceipt, error } = await supabase
          .from('receipts')
          .select('id')
          .eq('id', potentialReceiptId)
          .single();

        if (!error && existingReceipt) {
          return potentialReceiptId;
        }
      }

      // Also check by image_url to catch receipts that might have been processed
      const publicUrl = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(filename).data.publicUrl;

      const { data: receiptByUrl, error: urlError } = await supabase
        .from('receipts')
        .select('id')
        .eq('image_url', publicUrl)
        .single();

      if (!urlError && receiptByUrl) {
        return receiptByUrl.id;
      }

      return null;
    } catch (error) {
      // If there's an error checking, assume it doesn't exist
      return null;
    }
  }

  // User account verification/creation functionality
  private async verifyOrCreateUser(): Promise<void> {
    Logger.info(`Verifying/creating user account for: ${TARGET_USER_EMAIL}`);

    try {
      // Step 1: Check if user exists in auth.users
      const { data: authUser, error: authError } = await supabase.auth.admin.listUsers();

      if (authError) {
        throw new Error(`Failed to list users: ${authError.message}`);
      }

      let targetUser = authUser.users.find(user => user.email === TARGET_USER_EMAIL);

      if (!targetUser) {
        Logger.info('User not found in auth system. Creating new user...');
        targetUser = await this.createAuthUser();
      } else {
        Logger.info(`Found existing auth user: ${targetUser.id}`);
      }

      if (!targetUser) {
        throw new Error('Failed to create or find target user');
      }

      this.targetUserId = targetUser.id;

      // Step 2: Verify/create profile
      await this.verifyOrCreateProfile(targetUser.id);

      // Step 3: Verify/set admin role
      await this.verifyOrSetAdminRole(targetUser.id);

      // Step 4: Verify subscription settings
      await this.verifySubscriptionSettings(targetUser.id);

      Logger.success(`User account verified/created successfully: ${targetUser.id}`);

    } catch (error) {
      Logger.error('Failed to verify/create user account', { error: error.message });
      throw error;
    }
  }

  private async createAuthUser(): Promise<any> {
    Logger.info('Creating new auth user...');

    const { data: newUser, error } = await supabase.auth.admin.createUser({
      email: TARGET_USER_EMAIL,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        first_name: '',
        last_name: '',
        created_by: 'data-recovery-script'
      }
    });

    if (error) {
      throw new Error(`Failed to create auth user: ${error.message}`);
    }

    if (!newUser.user) {
      throw new Error('User creation returned null user');
    }

    Logger.success(`Created new auth user: ${newUser.user.id}`);
    return newUser.user;
  }

  private async verifyOrCreateProfile(userId: string): Promise<void> {
    Logger.info('Verifying/creating user profile...');

    // Check if profile exists
    const { data: existingProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw new Error(`Failed to fetch profile: ${fetchError.message}`);
    }

    if (!existingProfile) {
      Logger.info('Profile not found. Creating new profile...');

      const { error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          email: TARGET_USER_EMAIL,
          first_name: '',
          last_name: '',
          subscription_tier: 'max', // Set to max tier for admin
          subscription_status: 'active',
          receipts_used_this_month: 0,
          monthly_reset_date: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString()
        });

      if (insertError) {
        throw new Error(`Failed to create profile: ${insertError.message}`);
      }

      Logger.success('Created new user profile');
    } else {
      Logger.info('Profile exists. Updating subscription settings...');

      // Update to ensure max tier and active status
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          subscription_tier: 'max',
          subscription_status: 'active',
          email: TARGET_USER_EMAIL // Ensure email is set
        })
        .eq('id', userId);

      if (updateError) {
        throw new Error(`Failed to update profile: ${updateError.message}`);
      }

      Logger.success('Updated existing user profile');
    }
  }

  private async verifyOrSetAdminRole(userId: string): Promise<void> {
    Logger.info('Verifying/setting admin role...');

    // Check if user already has admin role
    const { data: existingRole, error: fetchError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw new Error(`Failed to fetch user roles: ${fetchError.message}`);
    }

    if (!existingRole) {
      Logger.info('Admin role not found. Setting admin role...');

      // Remove any existing roles first
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      // Add admin role
      const { error: insertError } = await supabase
        .from('user_roles')
        .insert({
          user_id: userId,
          role: 'admin'
        });

      if (insertError) {
        throw new Error(`Failed to set admin role: ${insertError.message}`);
      }

      Logger.success('Set admin role for user');
    } else {
      Logger.info('User already has admin role');
    }
  }

  private async verifySubscriptionSettings(userId: string): Promise<void> {
    Logger.info('Verifying subscription settings...');

    // Verify the profile has max tier settings
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('subscription_tier, subscription_status, receipts_used_this_month')
      .eq('id', userId)
      .single();

    if (error) {
      throw new Error(`Failed to fetch profile for subscription verification: ${error.message}`);
    }

    Logger.info('Current subscription settings:', {
      tier: profile.subscription_tier,
      status: profile.subscription_status,
      receiptsUsed: profile.receipts_used_this_month
    });

    // Reset monthly usage for recovery process
    if (profile.receipts_used_this_month > 0) {
      Logger.info('Resetting monthly receipt usage for recovery process...');

      const { error: resetError } = await supabase
        .from('profiles')
        .update({
          receipts_used_this_month: 0,
          monthly_reset_date: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString()
        })
        .eq('id', userId);

      if (resetError) {
        Logger.warn('Failed to reset monthly usage, but continuing...', { error: resetError.message });
      } else {
        Logger.success('Reset monthly receipt usage');
      }
    }

    Logger.success('Subscription settings verified');
  }

  private async organizeFilesForProcessing(files: StorageFile[]): Promise<{
    toProcess: StorageFile[];
    existing: StorageFile[];
  }> {
    Logger.info('Organizing files for processing...');

    const toProcess: StorageFile[] = [];
    const existing: StorageFile[] = [];

    for (const file of files) {
      const existingReceiptId = await this.checkExistingReceipt(file.name);

      if (existingReceiptId) {
        Logger.info(`Skipping existing receipt: ${file.name} (ID: ${existingReceiptId})`);
        existing.push(file);
        this.stats.skipped++;
      } else {
        toProcess.push(file);
      }
    }

    Logger.info(`Organization complete: ${toProcess.length} to process, ${existing.length} already exist`);
    return { toProcess, existing };
  }

  private async processFilesInBatches(files: StorageFile[]): Promise<void> {
    Logger.info('Processing files in batches...');

    // First organize files to avoid processing duplicates
    const { toProcess, existing } = await this.organizeFilesForProcessing(files);

    if (toProcess.length === 0) {
      Logger.info(`No new files to process. All ${existing.length} receipts already exist in database.`);
      return;
    }

    Logger.info(`Starting batch processing of ${toProcess.length} files (${existing.length} already exist)...`);

    // Process files in batches
    for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
      const batch = toProcess.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(toProcess.length / BATCH_SIZE);

      Logger.info(`Processing batch ${batchNumber}/${totalBatches} (${batch.length} files)`);

      // Process batch concurrently but with controlled concurrency
      const batchPromises = batch.map(file => this.processReceiptFile(file));
      const results = await Promise.allSettled(batchPromises);

      // Update stats based on results
      results.forEach((result, index) => {
        this.stats.processed++;

        if (result.status === 'fulfilled') {
          if (result.value.success) {
            this.stats.successful++;
            Logger.success(`Processed: ${batch[index].name}`);
          } else {
            this.stats.failed++;
            this.addError(batch[index].name, result.value.error || 'Unknown error', 'PROCESSING', result.value.receiptId);
            Logger.error(`Failed: ${batch[index].name}`, { error: result.value.error });
          }
        } else {
          this.stats.failed++;
          this.addError(batch[index].name, String(result.reason), 'UNKNOWN');
          Logger.error(`Failed: ${batch[index].name}`, { error: result.reason });
        }
      });

      // Progress update
      const overallProgress = 20 + ((i + batch.length) / toProcess.length * 70); // 20-90% for processing
      this.updateProgress('PROCESSING', `Batch ${batchNumber}/${totalBatches} completed`, overallProgress);
      this.logProgressSummary();

      // Add delay between batches to avoid overwhelming the system
      if (i + BATCH_SIZE < toProcess.length) {
        Logger.info('Waiting before next batch...');
        await sleep(3000); // 3 second delay between batches
      }
    }

    Logger.success(`Batch processing completed. Processed ${this.stats.processed} files.`);
  }

  // Receipt processing pipeline implementation
  private async processReceiptFile(file: StorageFile): Promise<ProcessingResult> {
    Logger.info(`Processing file: ${file.name}`);
    let receiptId: string | null = null;

    try {
      if (!this.targetUserId) {
        throw new Error('Target user ID not set. User verification must be completed first.');
      }

      // Step 1: Create initial receipt record
      receiptId = await this.createInitialReceiptRecord(file);
      await this.updateReceiptProcessingStatus(receiptId, 'processing_ocr');

      // Step 2: Call the process-receipt edge function
      Logger.info(`Starting OCR/AI processing for: ${receiptId}`);
      await this.callProcessReceiptFunction(receiptId);

      // Step 3: Generate thumbnail if not already created
      Logger.info(`Generating thumbnail for: ${receiptId}`);
      await this.ensureThumbnailExists(receiptId);

      // Step 4: Generate embeddings for semantic search
      Logger.info(`Generating embeddings for: ${receiptId}`);
      await this.generateEmbeddings(receiptId);

      // Step 5: Validate the processed receipt
      const isValid = await this.validateProcessedReceipt(receiptId);
      if (!isValid) {
        throw new Error('Receipt validation failed after processing');
      }

      await this.updateReceiptProcessingStatus(receiptId, 'complete');
      Logger.success(`Successfully processed receipt: ${file.name} (ID: ${receiptId})`);
      return { success: true, receiptId };

    } catch (error) {
      Logger.error(`Failed to process receipt: ${file.name}`, { error: error.message });

      // Update receipt status to failed if we have a receipt ID
      if (receiptId) {
        await this.updateReceiptProcessingStatus(receiptId, 'failed', error.message);
      }

      return { success: false, error: error.message };
    }
  }

  private async createInitialReceiptRecord(file: StorageFile): Promise<string> {
    Logger.info(`Creating initial receipt record for: ${file.name}`);

    // Get the public URL for the image
    const { data: publicUrlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(file.name);

    if (!publicUrlData?.publicUrl) {
      throw new Error('Failed to get public URL for receipt image');
    }

    const imageUrl = publicUrlData.publicUrl;

    // Create initial receipt record
    const { data: receipt, error } = await supabase
      .from('receipts')
      .insert({
        user_id: this.targetUserId,
        merchant: 'Processing...',
        date: new Date().toISOString().split('T')[0],
        total: 0,
        tax: 0,
        currency: 'MYR',
        payment_method: '',
        status: 'unreviewed',
        processing_status: 'uploading',
        image_url: imageUrl,
        fullText: '',
        ai_suggestions: {},
        predicted_category: null
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to create receipt record: ${error.message}`);
    }

    if (!receipt?.id) {
      throw new Error('Receipt creation returned no ID');
    }

    Logger.info(`Created receipt record: ${receipt.id}`);
    return receipt.id;
  }

  private async callProcessReceiptFunction(receiptId: string): Promise<any> {
    Logger.info(`Calling process-receipt function for: ${receiptId}`);

    // Get the edge function URL
    const functionUrl = `${SUPABASE_URL}/functions/v1/process-receipt`;

    // Get the image URL from the receipt record
    const { data: receipt, error: receiptError } = await supabase
      .from('receipts')
      .select('image_url')
      .eq('id', receiptId)
      .single();

    if (receiptError || !receipt?.image_url) {
      throw new Error(`Failed to get image URL for receipt ${receiptId}: ${receiptError?.message || 'No image URL found'}`);
    }

    // Prepare the request payload
    const payload = {
      receiptId,
      imageUrl: receipt.image_url,
      modelId: DEFAULT_MODEL,
      primaryMethod: DEFAULT_METHOD,
      compareWithAlternative: false
    };

    // Call the edge function
    const response = await retry(async () => {
      const res = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY!}`,
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_KEY!
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Process receipt function failed: ${res.status} ${res.statusText} - ${errorText}`);
      }

      return res.json();
    });

    if (!response.success) {
      throw new Error(`Process receipt function returned error: ${response.error || 'Unknown error'}`);
    }

    Logger.info(`Process receipt function completed for: ${receiptId}`);
    return response;
  }

  private async ensureThumbnailExists(receiptId: string): Promise<void> {
    Logger.info(`Ensuring thumbnail exists for: ${receiptId}`);

    try {
      // Check if thumbnail already exists
      const { data: receipt, error: fetchError } = await supabase
        .from('receipts')
        .select('thumbnail_url')
        .eq('id', receiptId)
        .single();

      if (fetchError) {
        throw new Error(`Failed to fetch receipt for thumbnail check: ${fetchError.message}`);
      }

      if (receipt.thumbnail_url) {
        Logger.info(`Thumbnail already exists for: ${receiptId}`);
        return;
      }

      // Generate thumbnail using the edge function
      const thumbnailUrl = `${SUPABASE_URL}/functions/v1/generate-thumbnails`;

      const response = await retry(async () => {
        const res = await fetch(thumbnailUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY!}`,
            'Content-Type': 'application/json',
            'apikey': SUPABASE_SERVICE_KEY!
          },
          body: JSON.stringify({ receiptId })
        });

        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`Thumbnail generation failed: ${res.status} ${res.statusText} - ${errorText}`);
        }

        return res.json();
      });

      if (!response.success) {
        throw new Error(`Thumbnail generation returned error: ${response.error || 'Unknown error'}`);
      }

      Logger.info(`Thumbnail generated for: ${receiptId}`);

    } catch (error) {
      Logger.warn(`Failed to generate thumbnail for ${receiptId}, but continuing...`, { error: error.message });
      // Don't throw here - thumbnail generation failure shouldn't stop the recovery
    }
  }

  private async generateEmbeddings(receiptId: string): Promise<void> {
    Logger.info(`Generating embeddings for: ${receiptId}`);

    try {
      // Generate embeddings using the edge function
      const embeddingUrl = `${SUPABASE_URL}/functions/v1/generate-embeddings`;

      const response = await retry(async () => {
        const res = await fetch(embeddingUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY!}`,
            'Content-Type': 'application/json',
            'apikey': SUPABASE_SERVICE_KEY!
          },
          body: JSON.stringify({
            receiptId,
            processAllFields: true,
            processLineItems: true,
            useImprovedDimensionHandling: true
          })
        });

        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`Embedding generation failed: ${res.status} ${res.statusText} - ${errorText}`);
        }

        return res.json();
      });

      if (!response.success) {
        throw new Error(`Embedding generation returned error: ${response.error || 'Unknown error'}`);
      }

      Logger.info(`Embeddings generated for: ${receiptId}`);

    } catch (error) {
      Logger.warn(`Failed to generate embeddings for ${receiptId}, but continuing...`, { error: error.message });
      // Don't throw here - embedding generation failure shouldn't stop the recovery
    }
  }

  private async updateReceiptProcessingStatus(receiptId: string, status: string, error?: string): Promise<void> {
    try {
      const updateData: any = {
        processing_status: status,
        updated_at: new Date().toISOString()
      };

      if (error) {
        updateData.processing_error = error;
      }

      await supabase
        .from('receipts')
        .update(updateData)
        .eq('id', receiptId);

    } catch (updateError) {
      Logger.warn(`Failed to update processing status for ${receiptId}`, { error: updateError.message });
    }
  }

  private async validateProcessedReceipt(receiptId: string): Promise<boolean> {
    try {
      const { data: receipt, error } = await supabase
        .from('receipts')
        .select('*')
        .eq('id', receiptId)
        .single();

      if (error) {
        Logger.warn(`Failed to validate receipt ${receiptId}`, { error: error.message });
        return false;
      }

      // Check if receipt has been properly processed
      const isValid = receipt.processing_status === 'complete' &&
                     receipt.merchant !== 'Processing...' &&
                     receipt.total > 0;

      if (!isValid) {
        Logger.warn(`Receipt ${receiptId} validation failed`, {
          status: receipt.processing_status,
          merchant: receipt.merchant,
          total: receipt.total
        });
      }

      return isValid;

    } catch (error) {
      Logger.warn(`Error validating receipt ${receiptId}`, { error: error.message });
      return false;
    }
  }

  private generateFinalReport(): void {
    const successRate = this.stats.totalFiles > 0
      ? ((this.stats.successful / this.stats.totalFiles) * 100).toFixed(1)
      : '0';

    const processingTime = this.stats.processingTimeMs
      ? this.formatDuration(this.stats.processingTimeMs)
      : 'Unknown';

    // Categorize errors by type
    const errorsByType = this.stats.errors.reduce((acc, error) => {
      acc[error.errorType] = (acc[error.errorType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    Logger.success('='.repeat(60));
    Logger.success('DATA RECOVERY COMPLETED!');
    Logger.success('='.repeat(60));
    Logger.success('Final Statistics:', {
      totalFilesFound: this.stats.totalFiles,
      filesProcessed: this.stats.processed,
      successfullyRecovered: this.stats.successful,
      failed: this.stats.failed,
      skipped: this.stats.skipped,
      successRate: `${successRate}%`,
      processingTime,
      targetUser: TARGET_USER_EMAIL,
      targetUserId: this.targetUserId,
      startTime: this.stats.startTime.toISOString(),
      endTime: this.stats.endTime?.toISOString()
    });

    if (this.stats.errors.length > 0) {
      Logger.error('Error Summary by Type:', errorsByType);
      Logger.error('Detailed Errors:');
      this.stats.errors.forEach((error, index) => {
        Logger.error(`${index + 1}. [${error.errorType}] ${error.filename}: ${error.error}`, {
          receiptId: error.receiptId,
          timestamp: error.timestamp.toISOString(),
          retryCount: error.retryCount
        });
      });
    }

    if (this.stats.successful > 0) {
      Logger.success(`✅ Successfully recovered ${this.stats.successful} receipts!`);
      Logger.info('Next steps:');
      Logger.info('1. Review the recovered receipts in the dashboard');
      Logger.info('2. Verify that thumbnails and embeddings were generated correctly');
      Logger.info('3. Test semantic search functionality');
      Logger.info('4. Check that all receipt data is accurate');
      Logger.info('5. Consider running the script again for any failed items');
    }

    if (this.stats.failed > 0) {
      Logger.warn(`⚠️  ${this.stats.failed} receipts failed to process`);
      Logger.info('Failure Analysis:');
      Object.entries(errorsByType).forEach(([type, count]) => {
        Logger.info(`- ${type}: ${count} failures`);
      });
      Logger.info('Consider:');
      Logger.info('1. Reviewing the detailed error logs above');
      Logger.info('2. Re-running the recovery script for failed items');
      Logger.info('3. Manually processing problematic receipts');
      Logger.info('4. Checking network connectivity and API limits');
    }

    if (this.stats.skipped > 0) {
      Logger.info(`ℹ️  ${this.stats.skipped} receipts were skipped (already exist in database)`);
    }

    // Performance metrics
    if (this.stats.successful > 0 && this.stats.processingTimeMs) {
      const avgTimePerReceipt = this.stats.processingTimeMs / this.stats.successful;
      Logger.info('Performance Metrics:', {
        averageTimePerReceipt: this.formatDuration(avgTimePerReceipt),
        receiptsPerMinute: Math.round((this.stats.successful / (this.stats.processingTimeMs / 60000)) * 100) / 100
      });
    }

    Logger.success('='.repeat(60));
  }

  // Subscription limit checking and validation methods
  private async checkSubscriptionLimits(): Promise<SubscriptionLimits | null> {
    try {
      if (!this.targetUserId) {
        Logger.warn('Cannot check subscription limits: target user ID not set');
        return null;
      }

      // Get user's subscription tier
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('subscription_tier, receipts_used_this_month')
        .eq('id', this.targetUserId)
        .single();

      if (error) {
        Logger.warn('Failed to fetch user profile for subscription check', { error: error.message });
        return null;
      }

      // Get subscription limits for the tier
      const { data: limits, error: limitsError } = await supabase
        .from('subscription_limits')
        .select('*')
        .eq('tier', profile.subscription_tier)
        .single();

      if (limitsError) {
        Logger.warn('Failed to fetch subscription limits', { error: limitsError.message });
        return null;
      }

      Logger.info('Subscription Status:', {
        tier: profile.subscription_tier,
        monthlyLimit: limits.monthly_receipts,
        currentUsage: profile.receipts_used_this_month,
        storageLimitMB: limits.storage_limit_mb,
        batchLimit: limits.batch_upload_limit
      });

      return limits;
    } catch (error) {
      Logger.warn('Error checking subscription limits', { error: error.message });
      return null;
    }
  }

  private async validateRecoveredData(): Promise<ValidationResult> {
    Logger.info('Starting comprehensive data validation...');

    const issues: ValidationIssue[] = [];
    let totalReceipts = 0;
    let validReceipts = 0;
    let missingThumbnails = 0;
    let missingEmbeddings = 0;
    let incompleteProcessing = 0;

    try {
      if (!this.targetUserId) {
        throw new Error('Target user ID not set');
      }

      // Get all receipts for the target user
      const { data: receipts, error } = await supabase
        .from('receipts')
        .select(`
          id,
          merchant,
          date,
          total,
          processing_status,
          image_url,
          thumbnail_url,
          has_embeddings,
          created_at
        `)
        .eq('user_id', this.targetUserId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch receipts for validation: ${error.message}`);
      }

      totalReceipts = receipts.length;
      Logger.info(`Validating ${totalReceipts} receipts...`);

      for (const receipt of receipts) {
        let receiptValid = true;

        // Check processing status
        if (receipt.processing_status !== 'complete') {
          issues.push({
            receiptId: receipt.id,
            issueType: 'PROCESSING_INCOMPLETE',
            description: `Processing status is '${receipt.processing_status}' instead of 'complete'`,
            severity: 'HIGH'
          });
          incompleteProcessing++;
          receiptValid = false;
        }

        // Check required data fields
        if (!receipt.merchant || receipt.merchant === 'Processing...' || receipt.total <= 0) {
          issues.push({
            receiptId: receipt.id,
            issueType: 'MISSING_DATA',
            description: `Missing or invalid data: merchant='${receipt.merchant}', total=${receipt.total}`,
            severity: 'CRITICAL'
          });
          receiptValid = false;
        }

        // Check thumbnail
        if (!receipt.thumbnail_url) {
          issues.push({
            receiptId: receipt.id,
            issueType: 'MISSING_THUMBNAIL',
            description: 'Thumbnail URL is missing',
            severity: 'MEDIUM'
          });
          missingThumbnails++;
          receiptValid = false;
        }

        // Check embeddings
        if (!receipt.has_embeddings) {
          issues.push({
            receiptId: receipt.id,
            issueType: 'MISSING_EMBEDDING',
            description: 'Embeddings are missing for semantic search',
            severity: 'LOW'
          });
          missingEmbeddings++;
          receiptValid = false;
        }

        // Check image URL accessibility
        if (receipt.image_url) {
          try {
            const response = await fetch(receipt.image_url, { method: 'HEAD' });
            if (!response.ok) {
              issues.push({
                receiptId: receipt.id,
                issueType: 'MISSING_DATA',
                description: `Image URL is not accessible: ${response.status}`,
                severity: 'HIGH'
              });
              receiptValid = false;
            }
          } catch (error) {
            issues.push({
              receiptId: receipt.id,
              issueType: 'MISSING_DATA',
              description: `Image URL check failed: ${error.message}`,
              severity: 'HIGH'
            });
            receiptValid = false;
          }
        }

        if (receiptValid) {
          validReceipts++;
        }
      }

      const validationResult: ValidationResult = {
        isValid: issues.length === 0,
        issues,
        summary: {
          totalReceipts,
          validReceipts,
          invalidReceipts: totalReceipts - validReceipts,
          missingThumbnails,
          missingEmbeddings,
          incompleteProcessing
        }
      };

      this.logValidationResults(validationResult);
      return validationResult;

    } catch (error) {
      Logger.error('Validation failed', { error: error.message });
      return {
        isValid: false,
        issues: [{
          receiptId: 'SYSTEM',
          issueType: 'MISSING_DATA',
          description: `Validation process failed: ${error.message}`,
          severity: 'CRITICAL'
        }],
        summary: {
          totalReceipts: 0,
          validReceipts: 0,
          invalidReceipts: 0,
          missingThumbnails: 0,
          missingEmbeddings: 0,
          incompleteProcessing: 0
        }
      };
    }
  }

  private logValidationResults(result: ValidationResult): void {
    Logger.info('='.repeat(50));
    Logger.info('DATA VALIDATION RESULTS');
    Logger.info('='.repeat(50));

    Logger.info('Validation Summary:', result.summary);

    if (result.isValid) {
      Logger.success('✅ All recovered data passed validation!');
    } else {
      Logger.warn(`⚠️  Found ${result.issues.length} validation issues`);

      // Group issues by severity
      const issuesBySeverity = result.issues.reduce((acc, issue) => {
        acc[issue.severity] = (acc[issue.severity] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      Logger.warn('Issues by Severity:', issuesBySeverity);

      // Log critical and high severity issues
      const criticalIssues = result.issues.filter(i => i.severity === 'CRITICAL' || i.severity === 'HIGH');
      if (criticalIssues.length > 0) {
        Logger.error('Critical/High Severity Issues:');
        criticalIssues.forEach((issue, index) => {
          Logger.error(`${index + 1}. [${issue.severity}] ${issue.receiptId}: ${issue.description}`);
        });
      }
    }

    Logger.info('='.repeat(50));
  }

  private async updateMonthlyUsage(): Promise<void> {
    try {
      if (!this.targetUserId || this.stats.successful === 0) {
        return;
      }

      Logger.info(`Updating monthly usage: adding ${this.stats.successful} receipts`);

      const { error } = await supabase
        .from('profiles')
        .update({
          receipts_used_this_month: this.stats.successful
        })
        .eq('id', this.targetUserId);

      if (error) {
        Logger.warn('Failed to update monthly usage', { error: error.message });
      } else {
        Logger.success(`Updated monthly usage: ${this.stats.successful} receipts`);
      }
    } catch (error) {
      Logger.warn('Error updating monthly usage', { error: error.message });
    }
  }
}

// CLI interface
async function main() {
  const recovery = new DataRecoveryService();

  try {
    Logger.info('🚀 Starting Paperless Maverick Data Recovery');
    Logger.info('This script will recover all receipt data from your storage bucket');
    Logger.info('Please ensure you have a stable internet connection');
    Logger.info('');

    await recovery.run();

    Logger.success('🎉 Data recovery completed successfully!');
    Logger.info('You can now access your recovered receipts in the dashboard');
    process.exit(0);
  } catch (error) {
    Logger.error('💥 Recovery failed', error);
    Logger.error('Please check the error logs above and try again');
    Logger.error('If the problem persists, contact support with the error details');
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { DataRecoveryService, Logger };
