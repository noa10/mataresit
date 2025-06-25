/**
 * OpenRouter API Debugging Script
 * 
 * This script helps debug OpenRouter API issues, particularly the JSON parsing error.
 * Run this in the browser console to diagnose OpenRouter API problems.
 */

console.log('🔍 OpenRouter API Debugging Tools Loaded');

// OpenRouter API debugging utilities
const openRouterDebug = {
  
  // Test OpenRouter API connection
  async testConnection(apiKey, modelId = 'mistralai/mistral-small-3.2-24b-instruct:free') {
    console.log('\n🧪 Testing OpenRouter API Connection...');
    
    if (!apiKey) {
      console.error('❌ No API key provided');
      console.log('💡 Get your API key from: https://openrouter.ai/keys');
      return false;
    }
    
    const testRequest = {
      model: modelId,
      messages: [
        { role: 'user', content: 'Hello, please respond with just "OK"' }
      ],
      max_tokens: 10,
      temperature: 0
    };
    
    try {
      console.log('📤 Sending test request:', {
        model: testRequest.model,
        url: 'https://openrouter.ai/api/v1/chat/completions',
        apiKeyLength: apiKey.length
      });
      
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Mataresit API Test'
        },
        body: JSON.stringify(testRequest)
      });
      
      console.log('📥 Response status:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error Response:', errorText);
        
        // Try to parse error as JSON
        try {
          const errorData = JSON.parse(errorText);
          console.error('📋 Parsed error details:', errorData);
        } catch (e) {
          console.error('⚠️ Error response is not valid JSON');
        }
        
        return false;
      }
      
      const result = await response.json();
      console.log('✅ API Response:', result);
      
      const content = result.choices?.[0]?.message?.content;
      console.log('📝 Model Response Content:', content);
      
      return true;
      
    } catch (error) {
      console.error('❌ Connection test failed:', error);
      return false;
    }
  },
  
  // Test receipt processing with OpenRouter
  async testReceiptProcessing(apiKey, modelId = 'mistralai/mistral-small-3.2-24b-instruct:free') {
    console.log('\n🧪 Testing Receipt Processing...');
    
    const systemPrompt = `You are an AI assistant specialized in analyzing receipt data. Your task is to extract structured information from receipts and return it in a specific JSON format.

IMPORTANT: You must respond with valid JSON only. Do not include any explanatory text before or after the JSON.

The JSON response must include these fields:
- merchant: string (store/restaurant name)
- total_amount: number (total amount paid)
- tax_amount: number (tax amount, 0 if not found)
- date: string (date in YYYY-MM-DD format)
- payment_method: string (cash, card, etc.)
- predicted_category: string (food, shopping, gas, etc.)
- line_items: array of objects with name, quantity, price
- confidence_score: number (0-1, your confidence in the extraction)

Be accurate and conservative with your confidence scores.`;

    const userPrompt = `Please analyze this receipt text and extract the structured data:

RECEIPT TEXT:
STARBUCKS COFFEE
123 MAIN ST
COFFEE SHOP
Date: 2024-01-15
Time: 10:30 AM

1x Grande Latte        $5.25
1x Blueberry Muffin    $3.50
Subtotal:              $8.75
Tax:                   $0.70
Total:                 $9.45

Payment: Credit Card
Thank you for your visit!

Extract the information and return it as JSON with the required fields.`;
    
    const testRequest = {
      model: modelId,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 1000,
      temperature: 0.2
    };
    
    try {
      console.log('📤 Sending receipt processing request...');
      
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Mataresit Receipt Processing Test'
        },
        body: JSON.stringify(testRequest)
      });
      
      console.log('📥 Response status:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error Response:', errorText);
        return false;
      }
      
      const result = await response.json();
      console.log('✅ Full API Response:', result);
      
      const content = result.choices?.[0]?.message?.content;
      console.log('📝 Raw Model Response:', content);
      
      // Test JSON parsing (this is where the error occurs)
      try {
        const parsedData = JSON.parse(content);
        console.log('✅ Successfully parsed JSON:', parsedData);
        return true;
      } catch (parseError) {
        console.error('❌ JSON Parsing Failed:', parseError);
        console.log('🔍 Raw content that failed to parse:', content);
        console.log('💡 This is the source of the "Failed to parse OpenRouter response as JSON" error');
        
        // Try to extract JSON from the response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          console.log('🔧 Attempting to extract JSON from response...');
          try {
            const extractedJson = JSON.parse(jsonMatch[0]);
            console.log('✅ Successfully extracted JSON:', extractedJson);
            console.log('💡 Solution: Update OpenRouter service to extract JSON from response');
          } catch (e) {
            console.error('❌ Even extracted JSON is invalid');
          }
        }
        
        return false;
      }
      
    } catch (error) {
      console.error('❌ Receipt processing test failed:', error);
      return false;
    }
  },
  
  // Check model availability
  async checkModelAvailability(apiKey) {
    console.log('\n🔍 Checking Model Availability...');
    
    try {
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        console.error('❌ Failed to fetch models:', response.status);
        return false;
      }
      
      const data = await response.json();
      const models = data.data || [];
      
      console.log(`📋 Found ${models.length} available models`);
      
      // Check for our target model
      const targetModel = 'mistralai/mistral-small-3.2-24b-instruct:free';
      const foundModel = models.find(m => m.id === targetModel);
      
      if (foundModel) {
        console.log('✅ Target model found:', foundModel);
      } else {
        console.error('❌ Target model not found:', targetModel);
        console.log('📋 Available Mistral models:');
        models.filter(m => m.id.includes('mistral')).forEach(m => {
          console.log(`   - ${m.id}`);
        });
      }
      
      return true;
      
    } catch (error) {
      console.error('❌ Model availability check failed:', error);
      return false;
    }
  },
  
  // Run comprehensive test
  async runFullTest(apiKey) {
    console.log('🚀 Running Comprehensive OpenRouter Test...');
    console.log('='.repeat(50));
    
    if (!apiKey) {
      console.error('❌ No API key provided');
      console.log('💡 Usage: openRouterDebug.runFullTest("your-api-key-here")');
      return;
    }
    
    const results = {
      connection: await this.testConnection(apiKey),
      models: await this.checkModelAvailability(apiKey),
      processing: await this.testReceiptProcessing(apiKey)
    };
    
    console.log('\n📊 Test Results Summary:');
    console.log('='.repeat(30));
    console.log(`Connection Test: ${results.connection ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Model Availability: ${results.models ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Receipt Processing: ${results.processing ? '✅ PASS' : '❌ FAIL'}`);
    
    if (results.connection && results.models && results.processing) {
      console.log('\n🎉 All tests passed! OpenRouter API is working correctly.');
    } else {
      console.log('\n⚠️ Some tests failed. Check the detailed logs above for issues.');
    }
    
    return results;
  }
};

// Export to global scope
window.openRouterDebug = openRouterDebug;

console.log('\n📋 Available commands:');
console.log('   openRouterDebug.testConnection("your-api-key") - Test basic connection');
console.log('   openRouterDebug.testReceiptProcessing("your-api-key") - Test receipt processing');
console.log('   openRouterDebug.checkModelAvailability("your-api-key") - Check available models');
console.log('   openRouterDebug.runFullTest("your-api-key") - Run all tests');
console.log('\n🔑 Get your OpenRouter API key from: https://openrouter.ai/keys');
console.log('💡 Start with: openRouterDebug.runFullTest("your-api-key-here")');
