// Debug script to test temporal search functionality
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mpmkbtsufihzdelrlszs.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wbWtidHN1ZmloemRlbHJsc3pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI5NzI4NzQsImV4cCI6MjA1ODU0ODg3NH0.Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8Ej8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function debugTemporalSearch() {
  console.log('🔍 Starting temporal search debug...');
  
  try {
    // Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      console.error('❌ No valid session found. Please sign in first.');
      return;
    }
    
    console.log('✅ Session found, user:', session.user.email);
    
    // Test the temporal search
    const testQuery = 'receipts from June 27';
    console.log(`🔍 Testing query: "${testQuery}"`);
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/unified-search`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: testQuery,
        limit: 10
      })
    });
    
    console.log('📡 Response status:', response.status);
    console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Search failed:', errorText);
      return;
    }
    
    const data = await response.json();
    console.log('📊 Full response:', JSON.stringify(data, null, 2));
    
    // Analyze the results
    console.log('\n📈 Analysis:');
    console.log(`- Results found: ${data.results?.length || 0}`);
    console.log(`- Processing time: ${data.processing_time || 'N/A'}ms`);
    console.log(`- Model used: ${data.model_used || 'N/A'}`);
    console.log(`- Strategy: ${data.strategy || 'N/A'}`);
    console.log(`- Temporal query detected: ${data.temporal_query_detected || false}`);
    
    if (data.results && data.results.length > 0) {
      console.log('\n📋 Results:');
      data.results.forEach((result, index) => {
        console.log(`${index + 1}. ${result.merchant} - ${result.date} - ${result.total}`);
      });
      
      // Check if results are properly filtered for June 27
      const june27Results = data.results.filter(result => {
        const resultDate = new Date(result.date);
        return resultDate.getDate() === 27 && resultDate.getMonth() === 5; // June is month 5 (0-indexed)
      });
      
      console.log(`\n🎯 June 27 results: ${june27Results.length}/${data.results.length}`);
      
      if (june27Results.length !== data.results.length) {
        console.log('⚠️ WARNING: Not all results are from June 27!');
        console.log('Non-June 27 results:');
        data.results.forEach((result, index) => {
          const resultDate = new Date(result.date);
          if (!(resultDate.getDate() === 27 && resultDate.getMonth() === 5)) {
            console.log(`- ${result.merchant} - ${result.date}`);
          }
        });
      } else {
        console.log('✅ All results are correctly filtered for June 27');
      }
    }
    
  } catch (error) {
    console.error('💥 Error during debug:', error);
  }
}

// Run the debug
debugTemporalSearch();
