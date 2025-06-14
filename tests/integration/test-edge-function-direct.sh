#!/bin/bash

# Test the edge function directly with a specific receipt
echo "🔍 Testing edge function directly with receipt that has missing line item embeddings..."

RECEIPT_ID="69db6c80-9bbd-4a21-ad1d-5bb30974c645"
SUPABASE_URL="https://mpmkbtsufihzdelrlszs.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wbWtidHN1ZmloemRlbHJsc3pzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMwMTIzODksImV4cCI6MjA1ODU4ODM4OX0.25ZyBSIl0TQxXFZsaT1R55118Tn8b6Ri8N556gOQyPY"

echo "📊 Receipt ID: $RECEIPT_ID"
echo "🧪 Calling edge function..."

curl -X POST "$SUPABASE_URL/functions/v1/generate-embeddings" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -d "{
    \"receiptId\": \"$RECEIPT_ID\",
    \"processLineItems\": true,
    \"forceRegenerate\": false
  }" \
  --verbose

echo ""
echo "✅ Test completed!"
