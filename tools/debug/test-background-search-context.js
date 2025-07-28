// Test script to verify the background search context is working correctly
// Run this in browser console after the fix is deployed

console.log('🧪 Testing Background Search Context...');

async function testBackgroundSearchContext() {
  try {
    console.log('🔍 Step 1: Checking if we can access the background search context...');
    
    // Check if React DevTools is available
    if (typeof window.__REACT_DEVTOOLS_GLOBAL_HOOK__ !== 'undefined') {
      console.log('✅ React DevTools detected');
    }
    
    // Look for the search input and conversation ID
    const searchInput = document.querySelector('input[type="text"]') || 
                       document.querySelector('textarea') ||
                       document.querySelector('[placeholder*="Ask"]');
    
    if (!searchInput) {
      console.log('❌ Could not find search input');
      return;
    }
    
    // Check URL for conversation ID
    const urlParams = new URLSearchParams(window.location.search);
    const conversationId = urlParams.get('c');
    
    console.log('🔍 Step 2: Checking conversation state...', {
      hasSearchInput: !!searchInput,
      conversationId: conversationId,
      currentUrl: window.location.href
    });
    
    // Test the search flow
    console.log('🔍 Step 3: Testing search flow...');
    
    // Set the search query
    searchInput.value = 'powercat';
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    
    // Find and click the send button
    const sendButton = document.querySelector('button[type="submit"]') ||
                      document.querySelector('button:contains("Send")') ||
                      document.querySelector('[data-testid="send-button"]') ||
                      Array.from(document.querySelectorAll('button')).find(btn => 
                        btn.textContent.includes('Send') || 
                        btn.innerHTML.includes('send') ||
                        btn.innerHTML.includes('arrow')
                      );
    
    if (!sendButton) {
      console.log('❌ Could not find send button');
      return;
    }
    
    console.log('✅ Found send button, clicking...');
    sendButton.click();
    
    // Monitor the console for background search logs
    console.log('🔍 Step 4: Monitoring for background search logs...');
    console.log('Look for these log messages in the console:');
    console.log('  - "🔍 DEBUG: BackgroundSearchContext.startBackgroundSearch called"');
    console.log('  - "🔍 DEBUG: unifiedSearch returned"');
    console.log('  - "🔍 DEBUG: Search successful, caching results"');
    console.log('  - "🔍 DEBUG: Dispatching COMPLETE_SEARCH action"');
    console.log('  - "✅ Background search completed for conversation"');
    
    // Wait and check for results
    setTimeout(() => {
      console.log('🔍 Step 5: Checking for search completion...');
      
      // Look for success indicators
      const hasErrorMessages = document.textContent.includes('Search failed') || 
                              document.textContent.includes('undefined') ||
                              document.textContent.includes('error while searching');
      
      const hasSuccessMessages = document.textContent.includes('Found') && 
                                document.textContent.includes('results');
      
      const receiptCards = document.querySelectorAll('[class*="receipt"], [class*="card"], [data-testid*="receipt"]');
      
      console.log('📊 Background Search Test Results:', {
        hasErrorMessages,
        hasSuccessMessages,
        receiptCardsFound: receiptCards.length,
        conversationId: conversationId
      });
      
      if (hasErrorMessages) {
        console.log('❌ BACKGROUND SEARCH STILL FAILING');
        console.log('Check the browser console for these specific errors:');
        console.log('  - "Search results are undefined/null after background search"');
        console.log('  - "Background search failed: Error: Search results are undefined"');
      } else if (receiptCards.length > 0 || hasSuccessMessages) {
        console.log('✅ BACKGROUND SEARCH WORKING!');
      } else {
        console.log('⚠️ INCONCLUSIVE - No clear success or failure indicators');
      }
      
    }, 5000); // Wait 5 seconds for search to complete
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Instructions
console.log(`
📋 BACKGROUND SEARCH CONTEXT TEST:

This test will:
1. Check if the search input is available
2. Enter "powercat" as the search query
3. Click the send button
4. Monitor console logs for background search activity
5. Check for success/failure indicators

Expected after fix:
✅ Should see background search logs in console
✅ Should NOT see "Search results are undefined" errors
✅ Should see receipt cards or success messages

If still failing:
❌ The fix hasn't been deployed yet
❌ There's an issue with the background search context
❌ Check for network errors or API failures
`);

// Auto-run the test
testBackgroundSearchContext();
