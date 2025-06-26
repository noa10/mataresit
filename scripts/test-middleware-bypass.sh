#!/bin/bash

# Middleware Bypass Testing Script
# Tests various approaches to bypass Supabase Edge Function JWT middleware

set -e

SUPABASE_URL="https://mpmkbtsufihzdelrlszs.supabase.co"
TEST_API_KEY="mk_test_1234567890abcdef"

echo "🧪 Testing Supabase Edge Function Middleware Bypass"
echo "=================================================="

# Function to test endpoint
test_endpoint() {
    local function_name=$1
    local endpoint=$2
    local description=$3
    
    echo ""
    echo "Testing: $description"
    echo "Function: $function_name"
    echo "Endpoint: $endpoint"
    echo "---"
    
    # Test without API key
    echo "1. Testing without API key:"
    curl -s -w "HTTP Status: %{http_code}\n" \
        -X GET "$SUPABASE_URL/functions/v1/$function_name$endpoint" \
        -H "Content-Type: application/json" \
        | head -5
    
    echo ""
    echo "2. Testing with API key:"
    curl -s -w "HTTP Status: %{http_code}\n" \
        -X GET "$SUPABASE_URL/functions/v1/$function_name$endpoint" \
        -H "X-API-Key: $TEST_API_KEY" \
        -H "Content-Type: application/json" \
        | head -5
    
    echo ""
    echo "3. Testing with Authorization header:"
    curl -s -w "HTTP Status: %{http_code}\n" \
        -X GET "$SUPABASE_URL/functions/v1/$function_name$endpoint" \
        -H "Authorization: Bearer $TEST_API_KEY" \
        -H "Content-Type: application/json" \
        | head -5
    
    echo ""
    echo "=================================================="
}

# Deploy functions first
echo "🚀 Deploying test functions..."
supabase functions deploy test-simple --project-ref mpmkbtsufihzdelrlszs
supabase functions deploy public-api-test --project-ref mpmkbtsufihzdelrlszs
supabase functions deploy bypass-test --project-ref mpmkbtsufihzdelrlszs

echo "⏳ Waiting 30 seconds for deployment propagation..."
sleep 30

# Test different approaches
test_endpoint "test-simple" "" "Simple test function (basic)"
test_endpoint "test-simple" "/api/v1/health" "Simple test function (API health)"
test_endpoint "public-api-test" "" "Public API test function"
test_endpoint "bypass-test" "/api/v1/health" "Bypass test function (health)"

echo ""
echo "🔍 Testing original functions for comparison:"
test_endpoint "external-api" "/api/v1/health" "Original external-api function"
test_endpoint "api-external" "/api/v1/health" "Alternative api-external function"

echo ""
echo "✅ Testing complete!"
echo ""
echo "📋 Analysis:"
echo "- Functions returning 200: Working correctly"
echo "- Functions returning 401 with 'Missing authorization header': Middleware issue"
echo "- Functions returning 401 with custom message: Function code reached (good)"
echo ""
echo "Next steps:"
echo "1. Identify which functions work (return 200 or custom 401)"
echo "2. Use working function pattern for your API"
echo "3. Update test suite to use working endpoint"
