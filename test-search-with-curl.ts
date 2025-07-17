#!/usr/bin/env -S deno run --allow-all

/**
 * Test script to call the unified-search function using curl
 * to see the exact response and debug the temporal search issue
 */

async function testSearchWithCurl() {
  console.log('🔍 Testing Temporal Search with curl');
  console.log('=' .repeat(50));
  
  const testQuery = "show me all receipts from last week";
  
  const curlCommand = `curl -X POST 'https://mpmkbtsufihzdelrlszs.supabase.co/functions/v1/unified-search' \\
    -H 'Content-Type: application/json' \\
    -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wbWtidHN1ZmloemRlbHJsc3pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMwMTIzODksImV4cCI6MjA1ODU4ODM4OX0.25ZyBSIl0TQxXFZsaT1R55118Tn8b6Ri8N556gOQyPY' \\
    -d '{
      "query": "${testQuery}",
      "limit": 50,
      "debug": true
    }'`;
  
  console.log('📝 Executing curl command:');
  console.log(curlCommand);
  console.log('');
  
  try {
    const process = new Deno.Command("curl", {
      args: [
        "-X", "POST",
        "https://mpmkbtsufihzdelrlszs.supabase.co/functions/v1/unified-search",
        "-H", "Content-Type: application/json",
        "-H", "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wbWtidHN1ZmloemRlbHJsc3pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMwMTIzODksImV4cCI6MjA1ODU4ODM4OX0.25ZyBSIl0TQxXFZsaT1R55118Tn8b6Ri8N556gOQyPY",
        "-d", JSON.stringify({
          query: testQuery,
          limit: 50,
          debug: true
        })
      ],
      stdout: "piped",
      stderr: "piped"
    });
    
    const { code, stdout, stderr } = await process.output();
    
    if (code !== 0) {
      console.error('❌ Curl command failed:');
      console.error(new TextDecoder().decode(stderr));
      return;
    }
    
    const response = new TextDecoder().decode(stdout);
    console.log('📊 Raw Response:');
    console.log(response);
    console.log('');
    
    try {
      const result = JSON.parse(response);
      
      console.log('📊 Parsed Results:');
      console.log(`- Total Results: ${result.results?.length || 0}`);
      console.log(`- Search Strategy: ${result.metadata?.searchStrategy || 'unknown'}`);
      console.log(`- Query Type: ${result.metadata?.queryType || 'unknown'}`);
      console.log(`- Temporal Confidence: ${result.metadata?.temporalConfidence || 'unknown'}`);
      
      if (result.metadata?.dateRange) {
        console.log(`- Date Range Used: ${result.metadata.dateRange.start} to ${result.metadata.dateRange.end}`);
        console.log(`- Date Range Preset: ${result.metadata.dateRange.preset}`);
      }
      
      if (result.metadata?.processingTime) {
        console.log(`- Processing Time: ${result.metadata.processingTime}ms`);
      }
      
      console.log('');
      
      if (result.results && result.results.length > 0) {
        console.log('📋 Receipt Details:');
        result.results.forEach((receipt: any, index: number) => {
          console.log(`${index + 1}. ${receipt.merchant} - ${receipt.currency} ${receipt.total} (${receipt.date})`);
        });
        
        // Analyze date distribution
        const dateDistribution: Record<string, number> = {};
        result.results.forEach((receipt: any) => {
          const date = receipt.date;
          dateDistribution[date] = (dateDistribution[date] || 0) + 1;
        });
        
        console.log('');
        console.log('📅 Date Distribution:');
        Object.entries(dateDistribution)
          .sort(([a], [b]) => a.localeCompare(b))
          .forEach(([date, count]) => {
            console.log(`- ${date}: ${count} receipt(s)`);
          });
      } else {
        console.log('❌ No results returned');
      }
      
      // Check for any debug information
      if (result.debug) {
        console.log('');
        console.log('🔧 Debug Information:');
        console.log(JSON.stringify(result.debug, null, 2));
      }
      
      // Check for any errors
      if (result.error) {
        console.log('');
        console.log('❌ Error Information:');
        console.log(JSON.stringify(result.error, null, 2));
      }
      
    } catch (parseError) {
      console.error('❌ Failed to parse JSON response:', parseError);
      console.log('Raw response:', response);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
await testSearchWithCurl();
