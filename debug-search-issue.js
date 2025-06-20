/**
 * Debug script to investigate search functionality issues
 * This script will help identify why the AI chat search is returning zero results
 */

import { supabase } from './src/lib/supabase.js';

async function debugSearchIssue() {
  console.log('🔍 Starting search functionality debug...\n');

  try {
    // Step 1: Check authentication
    console.log('1. Checking authentication status...');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('❌ Session error:', sessionError);
      return;
    }
    
    if (!session) {
      console.log('❌ No active session found');
      console.log('💡 Please ensure you are logged in to test search functionality');
      return;
    }
    
    console.log('✅ User authenticated:', session.user.email);
    console.log('   User ID:', session.user.id);
    console.log('');

    // Step 2: Check unified_embeddings table
    console.log('2. Checking unified_embeddings table...');
    const { data: embeddingStats, error: statsError } = await supabase
      .from('unified_embeddings')
      .select('source_type, content_type, user_id')
      .limit(10);

    if (statsError) {
      console.error('❌ Error querying unified_embeddings:', statsError);
      return;
    }

    console.log(`✅ Found ${embeddingStats?.length || 0} embedding records (showing first 10)`);
    if (embeddingStats && embeddingStats.length > 0) {
      console.log('   Sample records:');
      embeddingStats.forEach((record, index) => {
        console.log(`   ${index + 1}. Type: ${record.source_type}/${record.content_type}, User: ${record.user_id}`);
      });
    }
    console.log('');

    // Step 3: Check user-specific embeddings
    console.log('3. Checking user-specific embeddings...');
    const { data: userEmbeddings, error: userEmbeddingsError } = await supabase
      .from('unified_embeddings')
      .select('source_type, content_type, source_id')
      .eq('user_id', session.user.id)
      .limit(5);

    if (userEmbeddingsError) {
      console.error('❌ Error querying user embeddings:', userEmbeddingsError);
      return;
    }

    console.log(`✅ Found ${userEmbeddings?.length || 0} embeddings for current user`);
    if (userEmbeddings && userEmbeddings.length > 0) {
      console.log('   User embeddings:');
      userEmbeddings.forEach((record, index) => {
        console.log(`   ${index + 1}. ${record.source_type}/${record.content_type} - ${record.source_id}`);
      });
    } else {
      console.log('❌ No embeddings found for current user - this is likely the issue!');
    }
    console.log('');

    // Step 4: Check receipts table
    console.log('4. Checking receipts table...');
    const { data: receipts, error: receiptsError } = await supabase
      .from('receipts')
      .select('id, merchant, user_id')
      .eq('user_id', session.user.id)
      .limit(5);

    if (receiptsError) {
      console.error('❌ Error querying receipts:', receiptsError);
      return;
    }

    console.log(`✅ Found ${receipts?.length || 0} receipts for current user`);
    if (receipts && receipts.length > 0) {
      console.log('   Sample receipts:');
      receipts.forEach((receipt, index) => {
        console.log(`   ${index + 1}. ${receipt.merchant} - ${receipt.id}`);
      });
    }
    console.log('');

    // Step 5: Test unified_search function directly
    console.log('5. Testing unified_search function...');
    
    // Create a simple test embedding (all zeros for testing)
    const testEmbedding = new Array(1536).fill(0.1);
    
    const { data: searchResults, error: searchError } = await supabase.rpc('unified_search', {
      query_embedding: testEmbedding,
      source_types: ['receipt'],
      content_types: null,
      similarity_threshold: 0.1,
      match_count: 10,
      user_filter: session.user.id,
      team_filter: null,
      language_filter: null
    });

    if (searchError) {
      console.error('❌ Error calling unified_search:', searchError);
      return;
    }

    console.log(`✅ unified_search returned ${searchResults?.length || 0} results`);
    if (searchResults && searchResults.length > 0) {
      console.log('   Sample results:');
      searchResults.slice(0, 3).forEach((result, index) => {
        console.log(`   ${index + 1}. ${result.source_type}/${result.content_type} - Similarity: ${result.similarity}`);
      });
    }
    console.log('');

    // Step 6: Test without user filter
    console.log('6. Testing unified_search without user filter...');
    const { data: noFilterResults, error: noFilterError } = await supabase.rpc('unified_search', {
      query_embedding: testEmbedding,
      source_types: ['receipt'],
      content_types: null,
      similarity_threshold: 0.1,
      match_count: 10,
      user_filter: null, // No user filter
      team_filter: null,
      language_filter: null
    });

    if (noFilterError) {
      console.error('❌ Error calling unified_search without filter:', noFilterError);
      return;
    }

    console.log(`✅ unified_search without user filter returned ${noFilterResults?.length || 0} results`);
    console.log('');

    // Summary
    console.log('📊 SUMMARY:');
    console.log(`   - User authenticated: ${!!session}`);
    console.log(`   - Total embeddings in table: ${embeddingStats?.length || 0}`);
    console.log(`   - User-specific embeddings: ${userEmbeddings?.length || 0}`);
    console.log(`   - User receipts: ${receipts?.length || 0}`);
    console.log(`   - Search with user filter: ${searchResults?.length || 0} results`);
    console.log(`   - Search without user filter: ${noFilterResults?.length || 0} results`);
    
    if ((userEmbeddings?.length || 0) === 0 && (receipts?.length || 0) > 0) {
      console.log('\n🚨 ISSUE IDENTIFIED: User has receipts but no embeddings!');
      console.log('   This suggests the embeddings migration did not associate embeddings with the correct user_id.');
    }

  } catch (error) {
    console.error('❌ Debug script error:', error);
  }
}

// Run the debug script
debugSearchIssue();
