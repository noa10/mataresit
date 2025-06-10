import { supabase } from '@/integrations/supabase/client';
import { testAllEdgeFunctionsCORS, testGeminiConnection } from '@/lib/edge-function-utils';

export type ServiceStatus = 'operational' | 'degraded' | 'outage' | 'loading';

export interface ServiceCheckResult {
  name: string;
  status: ServiceStatus;
  message: string;
  details?: any;
}

// Check Supabase Database & API
export const checkSupabaseDB = async (): Promise<ServiceCheckResult> => {
  try {
    const { error } = await supabase.from('receipts').select('id', { count: 'exact', head: true });
    if (error) throw error;
    return { name: 'Supabase Database', status: 'operational', message: 'Connection successful.' };
  } catch (e: any) {
    return { name: 'Supabase Database', status: 'outage', message: 'Failed to connect.', details: e.message };
  }
};

// Check Supabase Authentication
export const checkSupabaseAuth = async (): Promise<ServiceCheckResult> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session !== undefined) {
      return { name: 'Supabase Auth', status: 'operational', message: 'Service is responsive.' };
    }
    throw new Error('No session data received from auth service.');
  } catch (e: any) {
    return { name: 'Supabase Auth', status: 'outage', message: 'Failed to get auth status.', details: e.message };
  }
};

// Check Supabase Storage
export const checkSupabaseStorage = async (): Promise<ServiceCheckResult> => {
  try {
    const { error } = await supabase.storage.from('receipt_images').list('', { limit: 1 });
    if (error) throw error;
    return { name: 'Supabase Storage', status: 'operational', message: 'Bucket is accessible.' };
  } catch (e: any) {
    return { name: 'Supabase Storage', status: 'outage', message: 'Failed to access storage.', details: e.message };
  }
};

// Check Edge Functions via CORS
export const checkEdgeFunctions = async (): Promise<ServiceCheckResult> => {
  try {
    const results = await testAllEdgeFunctionsCORS();
    const allPassing = Object.values(results).every(Boolean);
    if (allPassing) {
      return { name: 'Edge Functions', status: 'operational', message: 'All functions are responsive.', details: results };
    }
    const failedFunctions = Object.entries(results).filter(([, passing]) => !passing).map(([name]) => name);
    return { name: 'Edge Functions', status: 'degraded', message: `Functions failing CORS check: ${failedFunctions.join(', ')}`, details: results };
  } catch (e: any) {
    return { name: 'Edge Functions', status: 'outage', message: 'Failed to test edge functions.', details: e.message };
  }
};

// Check Third-Party Services (Gemini)
export const checkThirdPartyServices = async (): Promise<ServiceCheckResult> => {
  try {
    const geminiResult = await testGeminiConnection();
    if (geminiResult.success) {
      return { name: 'Google Gemini API', status: 'operational', message: 'Connection successful.' };
    }
    return { name: 'Google Gemini API', status: 'outage', message: geminiResult.message };
  } catch (e: any) {
    return { name: 'Google Gemini API', status: 'outage', message: 'Failed to connect.', details: e.message };
  }
};

// Combined check for all services
export const checkAllServices = async (): Promise<ServiceCheckResult[]> => {
  const checks = [
    checkSupabaseDB(),
    checkSupabaseAuth(),
    checkSupabaseStorage(),
    checkEdgeFunctions(),
    checkThirdPartyServices()
  ];
  return Promise.all(checks);
};
