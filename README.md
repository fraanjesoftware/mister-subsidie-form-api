# Azure Function - Subsidie Forms API

This Azure Function provides an HTTP API endpoint to fill Dutch subsidy forms (De-minimis, Machtiging, and MKB verklaring) and optionally upload them to Google Drive.

## API Endpoint

**POST** `/api/fillForms`

### Request Body

```json
{
  "deMinimis": {
    "selectedOption": 1,
    "generalData": {
      "companyName": "Company B.V.",
      "kvkNumber": "12345678",
      "street": "Main Street",
      "houseNumber": "100",
      "city": "Amsterdam",
      "postalCode": "1000AA",
      "signerName": "John Doe",
      "date": "21-06-25"
    }
  },
  "machtiging": {
    "applicantData": {
      "companyName": "Company B.V.",
      "email": "info@company.nl",
      "kvkNumber": "12345678",
      "contactPerson": "John Doe",
      "contactEmail": "john@company.nl",
      "position": "Director",
      "phoneNumber": "0612345678",
      "date": "21-06-25"
    },
    "representativeData": {
      "companyName": "Advisor B.V.",
      "contactPerson": "Jane Smith",
      "email": "jane@advisor.nl",
      "signDate1": "21-06-25",
      "name": "Jane Smith",
      "position": "Consultant",
      "phoneNumber": "0687654321",
      "signDate2": "21-06-25"
    }
  },
  "mkbVerklaring": {
    "companyName": "Company B.V.",
    "financialYear": "2024",
    "employees": 45,
    "annualTurnover": 8000000,
    "balanceTotal": 6000000,
    "signerName": "John Doe",
    "signerPosition": "Director",
    "dateAndLocation": "21-06-25, Amsterdam",
    "isIndependent": true,
    "hasLargeCompanyOwnership": false,
    "hasPartnerCompanies": false
  },
  "uploadToDrive": true,
  "driveFolderName": "Subsidie Forms"
}
```

### Response

Success (200 or 207):
```json
{
  "success": true,
  "message": "Filled 3 forms successfully",
  "results": {
    "filled": [
      {
        "form": "de-minimis",
        "filename": "filled-de-minimis-1234567890.pdf",
        "status": "success"
      }
    ],
    "errors": [],
    "driveUpload": {
      "folder": {
        "id": "folder-id",
        "name": "Forms_2025-06-21T10-30-00-000Z"
      },
      "files": [
        {
          "name": "filled-de-minimis-1234567890.pdf",
          "viewLink": "https://drive.google.com/...",
          "success": true
        }
      ]
    }
  }
}
```

## Local Development

1. Install Azure Functions Core Tools:
```bash
npm install -g azure-functions-core-tools@4
```

2. Install dependencies:
```bash
npm install
```

3. Configure local settings:
   - Copy `local.settings.json.example` to `local.settings.json`
   - Add your Google credentials (see below)

4. Run locally:
```bash
func start
```

The function will be available at: `http://localhost:7071/api/fillForms`

## Google Drive Setup

### Option 1: Service Account (Recommended for Production)

1. Create a service account in Google Cloud Console
2. Download the JSON key file
3. Set the entire JSON content as `GOOGLE_CREDENTIALS` environment variable

### Option 2: OAuth2 (Development)

1. Set up OAuth2 credentials in Google Cloud Console
2. Store the credentials and tokens in `GOOGLE_CREDENTIALS`

### Environment Variables

- `GOOGLE_CREDENTIALS`: JSON string containing Google credentials
- `GOOGLE_DRIVE_FOLDER_ID`: (Optional) Specific folder ID to upload files to

## Deployment to Azure

1. Create an Azure Function App (Node.js 18+)

2. Deploy using Azure Functions Core Tools:
```bash
func azure functionapp publish <YOUR-FUNCTION-APP-NAME>
```

3. Set environment variables in Azure:
```bash
az functionapp config appsettings set --name <YOUR-FUNCTION-APP-NAME> \
  --resource-group <YOUR-RESOURCE-GROUP> \
  --settings "GOOGLE_CREDENTIALS=<YOUR-CREDENTIALS-JSON>"
```

## Testing

### Using cURL:
```bash
curl -X POST http://localhost:7071/api/fillForms \
  -H "Content-Type: application/json" \
  -d @request-example.json
```

### Using Postman:
- Method: POST
- URL: `http://localhost:7071/api/fillForms`
- Headers: `Content-Type: application/json`
- Body: Raw JSON (see example above)

## Security Considerations

1. **Authentication**: Consider adding authentication using Azure AD or API keys
2. **CORS**: Configure CORS settings in Azure for browser-based access
3. **Rate Limiting**: Implement rate limiting to prevent abuse
4. **Input Validation**: The function validates input, but consider additional validation for production

## Error Handling

The function handles errors gracefully:
- Individual form errors don't stop other forms from being processed
- HTTP 207 (Multi-Status) is returned when some forms succeed and others fail
- Detailed error messages are included in the response

## Performance

- Forms are processed in parallel when possible
- Temporary files are cleaned up after processing
- Google Drive uploads are batched for efficiency