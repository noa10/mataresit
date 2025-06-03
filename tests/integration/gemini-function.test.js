// Simple script to test the test-gemini edge function
import fetch from 'node-fetch';

const supabaseUrl = 'https://mpmkbtsufihzdelrlszs.supabase.co';

async function testGeminiFunction() {
  try {
    console.log('Testing Gemini API connection via direct fetch...');
    const timestamp = new Date().getTime();

    const response = await fetch(`${supabaseUrl}/functions/v1/test-gemini?t=${timestamp}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      },
      body: JSON.stringify({}) // Empty JSON body
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', response.headers.raw());

    const responseText = await response.text();
    console.log('Raw response:', responseText);

    try {
      const data = JSON.parse(responseText);
      console.log('Parsed response:', data);
    } catch (e) {
      console.error('Failed to parse JSON:', e);
    }
  } catch (error) {
    console.error('Error testing Gemini function:', error);
  }
}

testGeminiFunction();
