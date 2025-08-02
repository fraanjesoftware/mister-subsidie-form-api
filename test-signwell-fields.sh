#!/bin/bash

# Test SignWell field mapping with form data

echo "🧪 Testing SignWell field mapping..."
echo ""

# API endpoint URL
API_URL="https://mister-subsidie-form-api-h8fvgydvheenczea.westeurope-01.azurewebsites.net/api/createSignWellSigningSession"

# Test request with tabs data (frontend format)
REQUEST_BODY='{
  "templateId": "da64f360-505b-42b4-9eed-39f179a23a79",
  "signers": [
    {
      "email": "test@mickeyfraanje.com",
      "name": "Test Signer",
      "roleName": "Applicant",
      "tabs": {
        "textTabs": [
          { "tabLabel": "bedrijfsnaam", "value": "Test Company B.V." },
          { "tabLabel": "kvk", "value": "12345678" },
          { "tabLabel": "onderneming-adres", "value": "Teststraat 123" },
          { "tabLabel": "postcode", "value": "1234 AB" },
          { "tabLabel": "plaats", "value": "Amsterdam" },
          { "tabLabel": "naam", "value": "Test Signer" },
          { "tabLabel": "functie", "value": "Director" },
          { "tabLabel": "email", "value": "test@mickeyfraanje.com" },
          { "tabLabel": "fte", "value": "25" },
          { "tabLabel": "datum", "value": "02-08-25" }
        ],
        "radioGroupTabs": [
          {
            "groupName": "de-minimis-radio",
            "radios": [
              { "value": "geen", "selected": true },
              { "value": "wel", "selected": false },
              { "value": "andere", "selected": false }
            ]
          },
          {
            "groupName": "company-type",
            "radios": [
              { "value": "kleine", "selected": true },
              { "value": "middel", "selected": false },
              { "value": "grote", "selected": false }
            ]
          }
        ],
        "listTabs": [
          { "tabLabel": "CompanySize", "value": "Klein (< 50 medewerkers)" }
        ]
      }
    }
  ],
  "returnUrl": "https://app.mistersubsidie.nl/bedankt",
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
  -s | jq .

echo ""
echo "=================================================="
echo ""
echo "📝 Notes:"
echo "1. Text fields are mapped directly to SignWell fields"
echo "2. Radio groups are converted to individual checkboxes"
echo "3. List tabs are mapped as dropdown fields"
echo "4. Document name is generated from 'bedrijfsnaam' field"
echo "5. Response includes signingUrl for frontend redirect"