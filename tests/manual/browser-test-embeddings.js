// Test script to run in browser console to debug line item embedding generation
// This script uses the same functions as the admin panel

async function testLineItemEmbeddingGeneration() {
  try {
    console.log('🔍 Testing line item embedding generation...');
    
    // Import the functions we need (these should be available in the browser context)
    const { generateLineItemEmbeddings, checkLineItemEmbeddings } = window;
    
    if (!generateLineItemEmbeddings || !checkLineItemEmbeddings) {
      console.error('❌ Required functions not available. Make sure you are on the admin panel page.');
      return;
    }
    
    // First check current stats
    console.log('📊 Checking current line item embedding stats...');
    const currentStats = await checkLineItemEmbeddings();
    console.log('Current stats:', currentStats);
    
    if (currentStats.withoutEmbeddings === 0) {
      console.log('✅ All line items already have embeddings!');
      return;
    }
    
    console.log(`🚀 Attempting to generate embeddings for ${currentStats.withoutEmbeddings} line items...`);
    
    // Try to generate embeddings for a small batch first
    const result = await generateLineItemEmbeddings(5, false); // Process 5 receipts, don't force regenerate
    console.log('Generation result:', result);
    
    if (result.success) {
      console.log(`✅ Successfully processed ${result.processed} line items`);
      
      // Check stats again
      const newStats = await checkLineItemEmbeddings();
      console.log('Updated stats:', newStats);
      
      const improvement = currentStats.withoutEmbeddings - newStats.withoutEmbeddings;
      console.log(`📈 Improvement: ${improvement} line items now have embeddings`);
    } else {
      console.log('❌ Generation failed');
    }
    
  } catch (error) {
    console.error('❌ Error during test:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
  }
}

// Instructions for running this test
console.log(`
🧪 Line Item Embedding Test Script Loaded!

To run the test, execute:
testLineItemEmbeddingGeneration()

Make sure you are on the admin panel page where the embedding functions are available.
`);

// Make the function available globally
window.testLineItemEmbeddingGeneration = testLineItemEmbeddingGeneration;
