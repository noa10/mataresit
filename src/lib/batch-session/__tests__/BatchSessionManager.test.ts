/**
 * BatchSessionManager Tests
 * Phase 3: Batch Upload Optimization
 */

import { BatchSessionManager } from '../BatchSessionManager';
import { BatchSessionConfig, CreateBatchSessionRequest, BatchFileUpdate } from '../types';

// Mock Supabase
jest.mock('../../supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({
            data: {
              id: 'test-session-id',
              user_id: 'test-user-id',
              team_id: 'test-team-id',
              session_name: 'Test Session',
              total_files: 3,
              files_completed: 0,
              files_failed: 0,
              files_pending: 3,
              max_concurrent: 2,
              rate_limit_config: {},
              processing_strategy: 'balanced',
              status: 'pending',
              started_at: null,
              completed_at: null,
              estimated_completion_at: null,
              total_processing_time_ms: 0,
              total_api_calls: 0,
              total_tokens_used: 0,
              rate_limit_hits: 0,
              avg_file_processing_time_ms: null,
              error_message: null,
              last_error_at: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            },
            error: null
          }))
        }))
      })),
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({
            data: {
              id: 'test-session-id',
              user_id: 'test-user-id',
              team_id: 'test-team-id',
              session_name: 'Test Session',
              total_files: 3,
              files_completed: 1,
              files_failed: 0,
              files_pending: 2,
              max_concurrent: 2,
              rate_limit_config: {},
              processing_strategy: 'balanced',
              status: 'processing',
              started_at: new Date().toISOString(),
              completed_at: null,
              estimated_completion_at: null,
              total_processing_time_ms: 30000,
              total_api_calls: 5,
              total_tokens_used: 1500,
              rate_limit_hits: 0,
              avg_file_processing_time_ms: 30000,
              error_message: null,
              last_error_at: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            },
            error: null
          })),
          order: jest.fn(() => Promise.resolve({
            data: [
              {
                id: 'file-1',
                batch_session_id: 'test-session-id',
                receipt_id: 'receipt-1',
                original_filename: 'receipt1.jpg',
                file_size_bytes: 1024000,
                file_type: 'image/jpeg',
                upload_order: 1,
                status: 'completed',
                processing_started_at: new Date().toISOString(),
                processing_completed_at: new Date().toISOString(),
                processing_duration_ms: 25000,
                api_calls_made: 2,
                tokens_used: 500,
                rate_limited: false,
                retry_count: 0,
                error_type: null,
                error_message: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }
            ],
            error: null
          }))
        }))
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ error: null }))
      }))
    }))
  }
}));

describe('BatchSessionManager', () => {
  let sessionManager: BatchSessionManager;
  let config: BatchSessionConfig;

  beforeEach(() => {
    config = {
      defaultMaxConcurrent: 2,
      defaultProcessingStrategy: 'balanced',
      maxRetryAttempts: 3,
      progressUpdateInterval: 5000,
      sessionTimeoutMs: 3600000,
      enableRealTimeUpdates: true,
      enableMetricsCollection: true
    };
    sessionManager = BatchSessionManager.getInstance(config);
  });

  describe('createSession', () => {
    it('should create a new batch session', async () => {
      const mockFiles = [
        new File(['content1'], 'receipt1.jpg', { type: 'image/jpeg' }),
        new File(['content2'], 'receipt2.jpg', { type: 'image/jpeg' }),
        new File(['content3'], 'receipt3.pdf', { type: 'application/pdf' })
      ];

      const request: CreateBatchSessionRequest = {
        sessionName: 'Test Session',
        files: mockFiles,
        processingStrategy: 'balanced',
        maxConcurrent: 2
      };

      const session = await sessionManager.createSession(request);

      expect(session).toBeTruthy();
      expect(session?.sessionName).toBe('Test Session');
      expect(session?.totalFiles).toBe(3);
      expect(session?.processingStrategy).toBe('balanced');
      expect(session?.status).toBe('pending');
    });

    it('should handle session creation errors gracefully', async () => {
      // Mock error response
      const mockSupabase = require('../../supabase').supabase;
      mockSupabase.from.mockReturnValueOnce({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({
              data: null,
              error: new Error('Database error')
            }))
          }))
        }))
      });

      const mockFiles = [new File(['content'], 'test.jpg', { type: 'image/jpeg' })];
      const request: CreateBatchSessionRequest = {
        files: mockFiles,
        processingStrategy: 'balanced'
      };

      const session = await sessionManager.createSession(request);
      expect(session).toBeNull();
    });
  });

  describe('getSession', () => {
    it('should retrieve a batch session by ID', async () => {
      const session = await sessionManager.getSession('test-session-id');

      expect(session).toBeTruthy();
      expect(session?.id).toBe('test-session-id');
      expect(session?.status).toBe('processing');
      expect(session?.filesCompleted).toBe(1);
    });
  });

  describe('getSessionFiles', () => {
    it('should retrieve files for a session', async () => {
      const files = await sessionManager.getSessionFiles('test-session-id');

      expect(files).toHaveLength(1);
      expect(files[0].id).toBe('file-1');
      expect(files[0].status).toBe('completed');
      expect(files[0].originalFilename).toBe('receipt1.jpg');
    });
  });

  describe('startSession', () => {
    it('should start a batch session', async () => {
      const success = await sessionManager.startSession('test-session-id');
      expect(success).toBe(true);
    });
  });

  describe('pauseSession', () => {
    it('should pause a batch session', async () => {
      const success = await sessionManager.pauseSession('test-session-id');
      expect(success).toBe(true);
    });
  });

  describe('resumeSession', () => {
    it('should resume a paused batch session', async () => {
      const success = await sessionManager.resumeSession('test-session-id');
      expect(success).toBe(true);
    });
  });

  describe('cancelSession', () => {
    it('should cancel a batch session', async () => {
      const success = await sessionManager.cancelSession('test-session-id');
      expect(success).toBe(true);
    });
  });

  describe('updateFileStatus', () => {
    it('should update file status', async () => {
      const update: BatchFileUpdate = {
        fileId: 'file-1',
        status: 'completed',
        receiptId: 'receipt-1',
        processingDurationMs: 25000,
        apiCallsMade: 2,
        tokensUsed: 500
      };

      const success = await sessionManager.updateFileStatus(update);
      expect(success).toBe(true);
    });

    it('should handle file status update errors', async () => {
      const mockSupabase = require('../../supabase').supabase;
      mockSupabase.from.mockReturnValueOnce({
        update: jest.fn(() => ({
          eq: jest.fn(() => Promise.resolve({ error: new Error('Update failed') }))
        }))
      });

      const update: BatchFileUpdate = {
        fileId: 'file-1',
        status: 'failed',
        errorMessage: 'Processing failed'
      };

      const success = await sessionManager.updateFileStatus(update);
      expect(success).toBe(false);
    });
  });

  describe('getSessionProgress', () => {
    it('should calculate session progress correctly', async () => {
      const progress = await sessionManager.getSessionProgress('test-session-id');

      expect(progress).toBeTruthy();
      expect(progress?.sessionId).toBe('test-session-id');
      expect(progress?.totalFiles).toBe(3);
      expect(progress?.filesCompleted).toBe(1);
      expect(progress?.filesPending).toBe(2);
      expect(progress?.progressPercentage).toBeCloseTo(33.33, 1);
    });
  });

  describe('getSessionMetrics', () => {
    it('should calculate session metrics correctly', async () => {
      const metrics = await sessionManager.getSessionMetrics('test-session-id');

      expect(metrics).toBeTruthy();
      expect(metrics?.sessionId).toBe('test-session-id');
      expect(metrics?.successRate).toBeCloseTo(0.33, 2); // 1 out of 3 files completed
      expect(metrics?.totalProcessingTime).toBe(30000);
      expect(metrics?.averageFileTime).toBe(30000);
    });
  });

  describe('event system', () => {
    it('should emit events for session operations', async () => {
      const events: any[] = [];
      sessionManager.addEventListener((event) => events.push(event));

      const mockFiles = [new File(['content'], 'test.jpg', { type: 'image/jpeg' })];
      const request: CreateBatchSessionRequest = {
        files: mockFiles,
        processingStrategy: 'balanced'
      };

      await sessionManager.createSession(request);
      await sessionManager.startSession('test-session-id');

      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('session_created');
      expect(events[1].type).toBe('session_started');
    });

    it('should remove event listeners correctly', () => {
      const listener = jest.fn();
      sessionManager.addEventListener(listener);
      sessionManager.removeEventListener(listener);

      // Trigger an event
      sessionManager.startSession('test-session-id');

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('progress monitoring', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should start progress monitoring when session starts', async () => {
      const events: any[] = [];
      sessionManager.addEventListener((event) => {
        if (event.type === 'progress_updated') {
          events.push(event);
        }
      });

      await sessionManager.startSession('test-session-id');

      // Fast-forward time to trigger progress update
      jest.advanceTimersByTime(6000); // 6 seconds

      expect(events.length).toBeGreaterThan(0);
      expect(events[0].type).toBe('progress_updated');
    });

    it('should stop progress monitoring when session is paused', async () => {
      await sessionManager.startSession('test-session-id');
      await sessionManager.pauseSession('test-session-id');

      const events: any[] = [];
      sessionManager.addEventListener((event) => {
        if (event.type === 'progress_updated') {
          events.push(event);
        }
      });

      // Fast-forward time
      jest.advanceTimersByTime(10000);

      expect(events).toHaveLength(0);
    });
  });
});

// Mock File constructor for Node.js environment
global.File = class File {
  name: string;
  size: number;
  type: string;
  
  constructor(content: string[], filename: string, options: { type: string }) {
    this.name = filename;
    this.size = content.join('').length;
    this.type = options.type;
  }
} as any;
