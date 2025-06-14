#!/usr/bin/env node

/**
 * Test script for PDF generation with images
 * This script tests the generate-pdf-report edge function with proper authentication
 */

const SUPABASE_URL = 'https://mpmkbtsufihzdelrlszs.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wbWtidHN1ZmloemRlbHJsc3pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMwMTIzODksImV4cCI6MjA1ODU4ODM4OX0.25ZyBSIl0TQxXFZsaT1R55118Tn8b6Ri8N556gOQyPY';

async function testPDFGeneration() {
  console.log('🧪 Testing PDF Generation with Images...');
  
  try {
    // Test with a date that has receipts
    const testDate = '2025-06-13';
    const testMode = 'payer';
    const includeImages = true;
    
    console.log(`📅 Testing date: ${testDate}`);
    console.log(`📊 Mode: ${testMode}`);
    console.log(`🖼️ Include images: ${includeImages}`);
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-pdf-report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify({
        date: testDate,
        mode: testMode,
        includeImages: includeImages
      })
    });
    
    console.log(`📡 Response status: ${response.status} ${response.statusText}`);
    console.log(`📋 Response headers:`, Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Error response: ${errorText}`);
      return;
    }
    
    const contentType = response.headers.get('Content-Type');
    if (contentType && contentType.includes('application/pdf')) {
      const pdfData = await response.arrayBuffer();
      console.log(`✅ PDF generated successfully!`);
      console.log(`📄 PDF size: ${pdfData.byteLength} bytes`);
      
      // Save the PDF for inspection
      const fs = require('fs');
      fs.writeFileSync('test-output.pdf', Buffer.from(pdfData));
      console.log(`💾 PDF saved as test-output.pdf`);
    } else {
      const responseText = await response.text();
      console.log(`📝 Response content: ${responseText}`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('🔍 Error details:', error);
  }
}

// Run the test
testPDFGeneration();
