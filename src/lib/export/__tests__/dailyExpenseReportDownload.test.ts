import { describe, it, expect, vi, beforeEach } from 'vitest';
import { downloadDailyExpenseReport, hasReceiptsForDate, formatDateForDownload } from '../dailyExpenseReportDownload';

// Mock the dependencies
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn()
    },
    from: vi.fn()
  }
}));

vi.mock('@/components/ui/use-toast', () => ({
  toast: vi.fn()
}));

// Mock fetch globally
global.fetch = vi.fn();

describe('dailyExpenseReportDownload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('formatDateForDownload', () => {
    it('should format Date object correctly', () => {
      const date = new Date('2024-01-15');
      const result = formatDateForDownload(date);
      expect(result).toBe('January 15, 2024');
    });

    it('should format date string correctly', () => {
      const dateString = '2024-01-15';
      const result = formatDateForDownload(dateString);
      expect(result).toBe('January 15, 2024');
    });

    it('should handle invalid date gracefully', () => {
      const invalidDate = 'invalid-date';
      const result = formatDateForDownload(invalidDate);
      expect(result).toBe('Invalid Date');
    });
  });

  describe('downloadDailyExpenseReport', () => {
    it('should return error when no session is available', async () => {
      const { supabase } = await import('@/integrations/supabase/client');
      (supabase.auth.getSession as any).mockResolvedValue({
        data: { session: null }
      });

      const date = new Date('2024-01-15');
      const result = await downloadDailyExpenseReport(date);

      expect(result.success).toBe(false);
      expect(result.error).toBe('You must be logged in to generate reports');
    });

    it('should handle successful PDF download', async () => {
      const { supabase } = await import('@/integrations/supabase/client');
      (supabase.auth.getSession as any).mockResolvedValue({
        data: { 
          session: { 
            access_token: 'mock-token',
            user: { id: 'user-123' }
          }
        }
      });

      // Mock successful fetch response
      const mockPdfData = new ArrayBuffer(1024);
      (global.fetch as any).mockResolvedValue({
        ok: true,
        headers: {
          get: (header: string) => {
            if (header === 'Content-Type') return 'application/pdf';
            return null;
          }
        },
        arrayBuffer: () => Promise.resolve(mockPdfData)
      });

      // Mock DOM methods
      const mockLink = {
        href: '',
        download: '',
        click: vi.fn()
      };
      const createElement = vi.spyOn(document, 'createElement').mockReturnValue(mockLink as any);
      const appendChild = vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink as any);
      const removeChild = vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink as any);
      
      // Mock URL methods
      const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
      const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

      const date = new Date('2024-01-15');
      const result = await downloadDailyExpenseReport(date, { includeImages: true });

      expect(result.success).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        'https://mpmkbtsufihzdelrlszs.supabase.co/functions/v1/generate-pdf-report',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer mock-token'
          },
          body: JSON.stringify({ date: '2024-01-15', includeImages: true })
        })
      );

      // Verify DOM manipulation
      expect(createElement).toHaveBeenCalledWith('a');
      expect(mockLink.download).toBe('expense-report-2024-01-15-category-mode.pdf');
      expect(mockLink.click).toHaveBeenCalled();
      expect(appendChild).toHaveBeenCalledWith(mockLink);
      expect(removeChild).toHaveBeenCalledWith(mockLink);
      expect(createObjectURL).toHaveBeenCalled();
      expect(revokeObjectURL).toHaveBeenCalled();

      // Cleanup
      createElement.mockRestore();
      appendChild.mockRestore();
      removeChild.mockRestore();
      createObjectURL.mockRestore();
      revokeObjectURL.mockRestore();
    });

    it('should handle fetch errors gracefully', async () => {
      const { supabase } = await import('@/integrations/supabase/client');
      (supabase.auth.getSession as any).mockResolvedValue({
        data: { 
          session: { 
            access_token: 'mock-token',
            user: { id: 'user-123' }
          }
        }
      });

      // Mock failed fetch response
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({ error: 'Server error' })
      });

      const date = new Date('2024-01-15');
      const result = await downloadDailyExpenseReport(date);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Server error');
    });

    it('should handle non-PDF responses', async () => {
      const { supabase } = await import('@/integrations/supabase/client');
      (supabase.auth.getSession as any).mockResolvedValue({
        data: { 
          session: { 
            access_token: 'mock-token',
            user: { id: 'user-123' }
          }
        }
      });

      // Mock response with wrong content type
      (global.fetch as any).mockResolvedValue({
        ok: true,
        headers: {
          get: (header: string) => {
            if (header === 'Content-Type') return 'text/html';
            return null;
          }
        },
        text: () => Promise.resolve('<html>Error page</html>')
      });

      const date = new Date('2024-01-15');
      const result = await downloadDailyExpenseReport(date);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Server did not return a PDF file');
    });
  });

  describe('hasReceiptsForDate', () => {
    it('should return false when no session is available', async () => {
      const { supabase } = await import('@/integrations/supabase/client');
      (supabase.auth.getSession as any).mockResolvedValue({
        data: { session: null }
      });

      const date = new Date('2024-01-15');
      const result = await hasReceiptsForDate(date);

      expect(result).toBe(false);
    });

    it('should return true when receipts exist for date', async () => {
      const { supabase } = await import('@/integrations/supabase/client');
      (supabase.auth.getSession as any).mockResolvedValue({
        data: { 
          session: { 
            user: { id: 'user-123' }
          }
        }
      });

      const mockFrom = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: [{ id: 'receipt-1' }],
          error: null
        })
      };
      (supabase.from as any).mockReturnValue(mockFrom);

      const date = new Date('2024-01-15');
      const result = await hasReceiptsForDate(date);

      expect(result).toBe(true);
      expect(supabase.from).toHaveBeenCalledWith('receipts');
      expect(mockFrom.select).toHaveBeenCalledWith('id');
      expect(mockFrom.eq).toHaveBeenCalledWith('user_id', 'user-123');
      expect(mockFrom.eq).toHaveBeenCalledWith('date', '2024-01-15');
      expect(mockFrom.limit).toHaveBeenCalledWith(1);
    });

    it('should return false when no receipts exist for date', async () => {
      const { supabase } = await import('@/integrations/supabase/client');
      (supabase.auth.getSession as any).mockResolvedValue({
        data: { 
          session: { 
            user: { id: 'user-123' }
          }
        }
      });

      const mockFrom = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: [],
          error: null
        })
      };
      (supabase.from as any).mockReturnValue(mockFrom);

      const date = new Date('2024-01-15');
      const result = await hasReceiptsForDate(date);

      expect(result).toBe(false);
    });

    it('should handle database errors gracefully', async () => {
      const { supabase } = await import('@/integrations/supabase/client');
      (supabase.auth.getSession as any).mockResolvedValue({
        data: { 
          session: { 
            user: { id: 'user-123' }
          }
        }
      });

      const mockFrom = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' }
        })
      };
      (supabase.from as any).mockReturnValue(mockFrom);

      const date = new Date('2024-01-15');
      const result = await hasReceiptsForDate(date);

      expect(result).toBe(false);
    });
  });
});
