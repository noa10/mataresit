#!/bin/bash

# Deploy Enhanced Generate Embeddings Function
# Phase 3: Batch Upload Optimization
# 
# Deploys the enhanced generate-embeddings function with rate limiting integration

set -e

echo "🚀 Deploying Enhanced Generate Embeddings Function with Rate Limiting..."

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI is not installed. Please install it first:"
    echo "npm install -g supabase"
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "supabase/functions/generate-embeddings/index.ts" ]; then
    echo "❌ Please run this script from the project root directory"
    exit 1
fi

# Check for required environment variables
echo "📋 Checking environment variables..."

if [ -z "$GEMINI_API_KEY" ]; then
    echo "⚠️  GEMINI_API_KEY not set. Make sure to set it in your Supabase project settings."
fi

if [ -z "$SUPABASE_URL" ]; then
    echo "⚠️  SUPABASE_URL not set. Make sure to set it in your Supabase project settings."
fi

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "⚠️  SUPABASE_SERVICE_ROLE_KEY not set. Make sure to set it in your Supabase project settings."
fi

# Set default rate limiting configuration
echo "⚙️  Setting default rate limiting configuration..."

# Deploy the function
echo "📦 Deploying generate-embeddings function..."

supabase functions deploy generate-embeddings \
    --project-ref "${SUPABASE_PROJECT_REF:-}" \
    --debug

if [ $? -eq 0 ]; then
    echo "✅ Function deployed successfully!"
else
    echo "❌ Function deployment failed!"
    exit 1
fi

# Set environment variables for rate limiting
echo "🔧 Setting environment variables..."

# Set rate limiting strategy (default: balanced)
supabase secrets set RATE_LIMIT_STRATEGY=balanced --project-ref "${SUPABASE_PROJECT_REF:-}"

# Enable rate limiting by default
supabase secrets set ENABLE_RATE_LIMITING=true --project-ref "${SUPABASE_PROJECT_REF:-}"

echo "📊 Environment variables set:"
echo "  - RATE_LIMIT_STRATEGY: balanced"
echo "  - ENABLE_RATE_LIMITING: true"

# Test the deployment
echo "🧪 Testing the deployed function..."

# Get the function URL
FUNCTION_URL=$(supabase functions list --project-ref "${SUPABASE_PROJECT_REF:-}" | grep generate-embeddings | awk '{print $3}')

if [ -n "$FUNCTION_URL" ]; then
    echo "📡 Function URL: $FUNCTION_URL"
    
    # Test rate limiting status endpoint
    echo "🔍 Testing rate limiting status endpoint..."
    
    curl -s -X GET "$FUNCTION_URL?action=rate_limit_status" \
        -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
        -H "Content-Type: application/json" | jq '.'
    
    if [ $? -eq 0 ]; then
        echo "✅ Rate limiting status endpoint is working!"
    else
        echo "⚠️  Rate limiting status endpoint test failed"
    fi
else
    echo "⚠️  Could not determine function URL for testing"
fi

echo ""
echo "🎉 Enhanced Generate Embeddings Function deployment completed!"
echo ""
echo "📋 Next steps:"
echo "1. Verify the function is working in your Supabase dashboard"
echo "2. Test rate limiting with your application"
echo "3. Monitor API quota usage in the database"
echo "4. Adjust rate limiting strategy as needed"
echo ""
echo "📊 Available rate limiting strategies:"
echo "  - conservative: 1 concurrent, 30 req/min, 50k tokens/min"
echo "  - balanced: 2 concurrent, 60 req/min, 100k tokens/min (default)"
echo "  - aggressive: 4 concurrent, 120 req/min, 200k tokens/min"
echo "  - adaptive: 3 concurrent, 90 req/min, 150k tokens/min (AI-optimized)"
echo ""
echo "🔧 To change strategy, use:"
echo "supabase secrets set RATE_LIMIT_STRATEGY=<strategy> --project-ref \$SUPABASE_PROJECT_REF"
echo ""
echo "📈 Monitor rate limiting in your application logs and database tables:"
echo "  - api_quota_tracking: API usage tracking"
echo "  - batch_upload_sessions: Session-level metrics"
echo "  - batch_upload_files: File-level processing status"
