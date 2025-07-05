#!/bin/bash

# Base URL for the Azure Functions
BASE_URL="https://mister-subsidie-form-api-h8fvgydvheenczea.westeurope-01.azurewebsites.net/api"

# Test 1: De Minimis Form
echo "Testing De Minimis endpoint..."
curl -X POST "$BASE_URL/createDeMinimisSession" \
  -H "Content-Type: application/json" \
  -d '{
    "signer": {
      "email": "test@example.com",
      "name": "Test User"
    },
    "formData": {
      "selectedOption": 1,
      "generalData": {
        "companyName": "Test Company B.V.",
        "kvkNumber": "12345678",
        "street": "Teststraat",
        "houseNumber": "123",
        "city": "Amsterdam",
        "postalCode": "1234AB",
        "signerName": "Test User",
        "date": "05-07-25"
      },
      "addSignatureAnchors": true
    },
    "returnUrl": "https://example.com/signing-complete"
  }' | jq '.'

echo -e "\n\n"

# Test 2: Machtiging Form
echo "Testing Machtiging endpoint..."
curl -X POST "$BASE_URL/createMachtigingSession" \
  -H "Content-Type: application/json" \
  -d '{
    "signer": {
      "email": "representative@example.com",
      "name": "Representative Name"
    },
    "formData": {
      "applicantData": {
        "companyName": "Applicant Company B.V.",
        "email": "applicant@example.com",
        "kvkNumber": "87654321",
        "contactPerson": "John Applicant",
        "contactEmail": "john@applicant.com",
        "position": "Director",
        "phoneNumber": "0612345678",
        "date": "05-07-25"
      },
      "representativeData": {
        "companyName": "Representative Company B.V.",
        "contactPerson": "Jane Representative",
        "email": "jane@representative.com",
        "signDate1": "05-07-25",
        "name": "Jane Representative",
        "position": "Consultant",
        "phoneNumber": "0687654321",
        "signDate2": "05-07-25"
      },
      "addSignatureAnchors": true
    },
    "returnUrl": "https://example.com/signing-complete"
  }' | jq '.'

echo -e "\n\n"

# Test 3: MKB Form
echo "Testing MKB endpoint..."
curl -X POST "$BASE_URL/createMKBSession" \
  -H "Content-Type: application/json" \
  -d '{
    "signer": {
      "email": "director@example.com",
      "name": "Company Director"
    },
    "formData": {
      "companyName": "Test MKB Company B.V.",
      "financialYear": "2024",
      "employees": 45,
      "annualTurnover": 8500000,
      "balanceTotal": 4200000,
      "signerName": "Company Director",
      "signerPosition": "Managing Director",
      "dateAndLocation": "Amsterdam, 05-07-2025",
      "isIndependent": true,
      "hasLargeCompanyOwnership": false,
      "hasPartnerCompanies": false,
      "addSignatureAnchors": true
    },
    "returnUrl": "https://example.com/signing-complete"
  }' | jq '.'