/**
 * Test-specific Supabase client configuration
 * Loads environment variables from .env.local for testing
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

// Use local Supabase for testing to avoid affecting production
const SUPABASE_URL = "http://127.0.0.1:54331";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing Supabase configuration. Please check your .env.local file.');
}

// Create and export the Supabase client for testing
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Export configuration for debugging
export const testConfig = {
  SUPABASE_URL,
  SUPABASE_ANON_KEY: SUPABASE_ANON_KEY.substring(0, 20) + '...', // Truncated for security
  PROJECT_ID: process.env.VITE_SUPABASE_PROJECT_ID || 'mpmkbtsufihzdelrlszs'
};

console.log('🔧 Test Supabase client initialized:', {
  url: testConfig.SUPABASE_URL,
  projectId: testConfig.PROJECT_ID
});
