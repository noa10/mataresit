/**
 * Test utility to verify ClientProcessingLogger functionality
 * This can be used to test if the RLS policy fix works
 */

import { supabase } from "@/integrations/supabase/client";

export const testClientLogger = async (receiptId: string): Promise<boolean> => {
  try {
    console.log('🧪 Testing ClientProcessingLogger with receipt ID:', receiptId);
    
    // Test direct insert to processing_logs table
    const testLog = {
      receipt_id: receiptId,
      status_message: 'Test log from client-side logger',
      step_name: 'TEST'
    };

    const { data, error } = await supabase
      .from('processing_logs')
      .insert(testLog)
      .select();

    if (error) {
      console.error('❌ ClientProcessingLogger test failed:', error);
      return false;
    }

    console.log('✅ ClientProcessingLogger test successful:', data);
    return true;
  } catch (error) {
    console.error('❌ ClientProcessingLogger test error:', error);
    return false;
  }
};

export const testClientLoggerWithAuth = async (): Promise<void> => {
  try {
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error('❌ User not authenticated for logger test');
      return;
    }

    console.log('🔐 Testing with authenticated user:', user.id);

    // Get a receipt owned by this user
    const { data: receipts, error: receiptError } = await supabase
      .from('receipts')
      .select('id')
      .eq('user_id', user.id)
      .limit(1);

    if (receiptError || !receipts || receipts.length === 0) {
      console.error('❌ No receipts found for user to test with');
      return;
    }

    const receiptId = receipts[0].id;
    const success = await testClientLogger(receiptId);
    
    if (success) {
      console.log('🎉 ClientProcessingLogger is working correctly!');
    } else {
      console.log('💥 ClientProcessingLogger still has issues');
    }
  } catch (error) {
    console.error('❌ Auth test error:', error);
  }
};
