#!/bin/bash

# SignWell API Test Script
# Make sure Azure Functions are running locally first: npm start

echo "🧪 Testing SignWell API Endpoint with curl..."
echo ""

# API endpoint URL (adjust port if needed)
API_URL="http://localhost:7071/api/createSignWellSigningSession"

# Test request body
REQUEST_BODY='{
  "templateId": "YOUR_TEMPLATE_ID_HERE",
  "name": "Test Agreement Document",
  "subject": "Please sign this test agreement",
  "message": "This is a test document created via the SignWell API integration.",
  "recipients": [
    {
      "name": "John Doe",
      "email": "john.doe@example.com",
      "order": 1
    },
    {
      "name": "Jane Smith",
      "email": "jane.smith@example.com", 
      "order": 2
    }
  ],
  "embeddedSigning": true,
  "redirectUri": "https://example.com/signing-complete",
  "metadata": {
    "applicationId": "test-app-123",
    "documentType": "agreement"
  },
  "testMode": true
}'

echo "📋 Request Body:"
echo "$REQUEST_BODY" | jq .
echo ""
echo "=================================================="
echo ""

# Make the API call
echo "📤 Sending request to: $API_URL"
echo ""

curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d "$REQUEST_BODY" \
  -w "\n\n📊 Response Status: %{http_code}\n" \
  | jq .

echo ""
echo "=================================================="
echo ""
echo "💡 Notes:"
echo "1. Make sure Azure Functions are running (npm start)"
echo "2. Replace YOUR_TEMPLATE_ID_HERE with an actual SignWell template ID"
echo "3. You may need to use Node.js 18 or 20 for Azure Functions v4"
echo "4. Check the SignWell dashboard to see created documents"