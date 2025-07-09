// Final test script to verify the POWERCAT search fix
// Run this in browser console after the fix is deployed

console.log('🧪 Testing POWERCAT search final fix...');

async function testPowercatFinalFix() {
  try {
    console.log('🔍 Step 1: Testing the search flow...');
    
    // Check if we're on the search page
    const currentUrl = window.location.href;
    console.log('Current URL:', currentUrl);
    
    if (!currentUrl.includes('/search')) {
      console.log('⚠️ Not on search page, navigating...');
      window.location.href = '/search';
      return;
    }

    // Test the search functionality
    console.log('🔍 Step 2: Testing search input...');
    
    // Find the search input
    const searchInput = document.querySelector('input[type="text"]') || 
                       document.querySelector('textarea') ||
                       document.querySelector('[placeholder*="Ask"]');
    
    if (searchInput) {
      console.log('✅ Found search input');
      
      // Clear and set the value
      searchInput.value = 'powercat';
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      
      // Try to find and click the send button
      const sendButton = document.querySelector('button[type="submit"]') ||
                        document.querySelector('button:contains("Send")') ||
                        document.querySelector('[data-testid="send-button"]') ||
                        Array.from(document.querySelectorAll('button')).find(btn => 
                          btn.textContent.includes('Send') || 
                          btn.innerHTML.includes('send') ||
                          btn.innerHTML.includes('arrow')
                        );
      
      if (sendButton) {
        console.log('✅ Found send button, clicking...');
        sendButton.click();
        
        // Wait a moment and check for results
        setTimeout(() => {
          console.log('🔍 Step 3: Checking for search results...');
          
          // Look for error messages
          const errorMessages = document.querySelectorAll('[class*="error"], [data-testid*="error"]');
          const searchFailedMessages = Array.from(document.querySelectorAll('*')).filter(el => 
            el.textContent.includes('Search failed') || 
            el.textContent.includes('undefined') ||
            el.textContent.includes('error')
          );
          
          // Look for success indicators
          const successMessages = Array.from(document.querySelectorAll('*')).filter(el => 
            el.textContent.includes('Search completed') || 
            el.textContent.includes('Found') ||
            el.textContent.includes('results')
          );
          
          // Look for receipt cards or results
          const receiptCards = document.querySelectorAll('[class*="receipt"], [class*="card"], [data-testid*="receipt"]');
          
          console.log('📊 Search Results Analysis:', {
            errorMessages: errorMessages.length,
            searchFailedMessages: searchFailedMessages.length,
            successMessages: successMessages.length,
            receiptCards: receiptCards.length,
            hasSearchFailedText: document.textContent.includes('Search failed'),
            hasUndefinedText: document.textContent.includes('undefined'),
            hasResultsText: document.textContent.includes('Found') && document.textContent.includes('results')
          });
          
          if (searchFailedMessages.length > 0) {
            console.log('❌ STILL FAILING - Found error messages:');
            searchFailedMessages.forEach((msg, index) => {
              console.log(`  ${index + 1}. ${msg.textContent.trim()}`);
            });
          }
          
          if (receiptCards.length > 0) {
            console.log('✅ SUCCESS - Found receipt cards:', receiptCards.length);
          }
          
          if (successMessages.length > 0) {
            console.log('✅ SUCCESS - Found success messages:');
            successMessages.forEach((msg, index) => {
              console.log(`  ${index + 1}. ${msg.textContent.trim()}`);
            });
          }
          
          // Final verdict
          if (receiptCards.length > 0 || (successMessages.length > 0 && searchFailedMessages.length === 0)) {
            console.log('🎉 POWERCAT SEARCH FIX SUCCESSFUL!');
          } else {
            console.log('❌ POWERCAT SEARCH STILL FAILING');
          }
          
        }, 3000); // Wait 3 seconds for search to complete
        
      } else {
        console.log('❌ Could not find send button');
      }
      
    } else {
      console.log('❌ Could not find search input');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Instructions
console.log(`
📋 TESTING INSTRUCTIONS:

1. Make sure you're on the search page (/search)
2. Run this test script
3. It will automatically search for "powercat"
4. Check the console output for results

Expected after fix:
✅ Should see "POWERCAT SEARCH FIX SUCCESSFUL!"
✅ Should see receipt cards displayed
✅ Should NOT see "Search failed" or "undefined" errors

If still failing:
❌ Check browser console for additional errors
❌ Verify the fix was properly deployed
❌ Check network tab for API call responses
`);

// Auto-run the test
testPowercatFinalFix();
