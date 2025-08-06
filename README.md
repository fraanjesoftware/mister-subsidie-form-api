# Mister Subsidie Form API

A modern Azure Functions-based API for processing Dutch SLIM subsidy applications with electronic signature integration via SignWell and automatic document management through OneDrive.

## 🏗️ Architecture Overview

This project is a serverless application built on Azure Functions that:
- Generates and manages SLIM subsidy application forms (De-minimis, Machtiging, MKB verklaring)
- Integrates with SignWell for electronic document signing
- Automatically uploads completed documents to OneDrive/SharePoint
- Provides webhook endpoints for real-time status updates
- Supports both single and multi-signer workflows

### Tech Stack
- **Runtime**: Node.js 18+ with TypeScript
- **Platform**: Azure Functions v4
- **E-Signature**: SignWell API (formerly DocuSign)
- **Storage**: OneDrive/SharePoint via Microsoft Graph API
- **PDF Processing**: pdf-lib for document manipulation
- **Testing**: Jest with TypeScript support

## 📋 Features

- ✅ Create signing sessions from templates with dynamic field mapping
- ✅ Support for single and dual-signer workflows
- ✅ Automatic PDF splitting and organization
- ✅ Webhook handling for document completion events
- ✅ OneDrive/SharePoint integration with folder organization
- ✅ Comprehensive error handling and logging
- ✅ CORS support for frontend integration
- ✅ Test mode for development

## 🚀 Quick Start

### Prerequisites
- Node.js 18 or higher
- Azure Functions Core Tools v4
- Active SignWell account with API access
- Azure AD app registration (for OneDrive)
- Git

### Local Development Setup

1. **Clone the repository**
```bash
git clone <repository-url>
cd mister-subsidie-form-api
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp .env.example .env
# Edit .env with your credentials
```

4. **Configure local settings for Azure Functions**
```bash
cp local.settings.json.example local.settings.json
# Add your environment variables to local.settings.json
```

5. **Build the TypeScript code**
```bash
npm run build
```

6. **Start the development server**
```bash
npm start
# or for watch mode:
npm run dev
```

The API will be available at `http://localhost:7071`

## 🔧 Configuration

### Environment Variables

Create a `.env` file with the following variables:

```env
# SignWell Configuration
SIGNWELL_API_KEY=your-api-key
SIGNWELL_TEST_MODE=true
SIGNWELL_ENVIRONMENT=test
SIGNWELL_API_APP_ID=your-app-id
SIGNWELL_TEMPLATE_ID=single-signer-template-id
SIGNWELL_TWO_SIGNER_TEMPLATE_ID=two-signer-template-id

# OneDrive/SharePoint Configuration
ONEDRIVE_CLIENT_ID=your-client-id
ONEDRIVE_CLIENT_SECRET=your-client-secret
ONEDRIVE_TENANT_ID=your-tenant-id
ONEDRIVE_USER_ID=user@domain.com  # For OneDrive
# OR
# ONEDRIVE_SITE_ID=site-id  # For SharePoint

# Mister Subsidie Default Fields
MISTER_SUBSIDIE_GEMACHTIGDE=Company Name
MISTER_SUBSIDIE_GEMACHTIGDE_EMAIL=email@company.com
MISTER_SUBSIDIE_GEMACHTIGDE_NAAM=Contact Name
MISTER_SUBSIDIE_GEMACHTIGDE_TELEFOON=Phone Number
MISTER_SUBSIDIE_GEMACHTIGDE_KVK=KVK Number

# Azure Functions
FUNCTIONS_WORKER_RUNTIME=node
AzureWebJobsStorage=your-storage-connection
```

## 📡 API Endpoints

### 1. Create SignWell Template Session
Creates a new signing session from a SignWell template.

**Endpoint:** `POST /api/createSignWellTemplateSession`

**Request:**
```json
{
  "signers": [{
    "email": "john@example.com",
    "name": "John Doe",
    "roleName": "Applicant",
    "tabs": {
      "textTabs": [
        { "tabLabel": "bedrijfsnaam", "value": "Company B.V." },
        { "tabLabel": "kvk", "value": "12345678" }
      ],
      "checkboxTabs": [
        { "tabLabel": "checkbox1", "selected": true }
      ]
    }
  }],
  "returnUrl": "https://your-app.com/signing-complete",
  "sendEmails": true,
  "testMode": true
}
```

**Response:**
```json
{
  "signingUrl": "https://signwell.com/embedded/sign/...",
  "documentId": "doc_abc123",
  "status": "created"
}
```

### 2. SignWell Webhook
Receives webhook events from SignWell for document status updates.

**Endpoint:** `POST /api/webhook`

**Events Handled:**
- `document_signed` - Individual signer completed
- `document_completed` - All signers completed
- `document_sent` - Document sent to recipients
- `recipient_completed` - Recipient finished signing
- `recipient_viewed` - Recipient viewed document

When a document is completed, the webhook automatically:
1. Downloads the signed PDF
2. Splits it into individual documents
3. Uploads all files to OneDrive with proper naming

### 3. Legacy Endpoints (Deprecated)
- `POST /api/fillForms` - Original form filling endpoint
- `POST /api/createTemplateSigningSession` - DocuSign template session
- `POST /api/docusignWebhook` - DocuSign webhook handler

## 🏗️ Project Structure

```
mister-subsidie-form-api/
├── src/
│   ├── functions/          # Azure Function endpoints
│   │   ├── createSignWellTemplateSession.ts
│   │   ├── signwellWebhook.ts
│   │   └── ...
│   ├── services/           # Business logic
│   │   ├── signwellService.ts
│   │   ├── onedriveService.ts
│   │   └── ...
│   ├── utils/              # Helper functions
│   │   ├── signwellFieldMapper.ts
│   │   └── ...
│   ├── types/              # TypeScript definitions
│   └── constants/          # Configuration constants
├── docs/                   # Documentation
├── scripts/               # Utility scripts
├── dist/                  # Compiled JavaScript
└── test files            # Various test scripts
```

## 🧪 Testing

### Run Tests
```bash
npm test                 # Run all tests
npm run test:watch      # Watch mode
npm run test:coverage   # Coverage report
```

### Test Individual Components
```bash
# Test OneDrive integration
node test-onedrive-simple.js

# Test SignWell fields
./test-signwell-fields.sh

# Test frontend integration
node test-frontend-integration.js
```

## 📦 Deployment

### Deploy to Azure Functions

1. **Login to Azure**
```bash
az login
```

2. **Create necessary resources** (if not exists)
```bash
# Create resource group
az group create --name mister-subsidie-rg --location westeurope

# Create storage account
az storage account create --name mistersubsidiestorage \
  --resource-group mister-subsidie-rg \
  --location westeurope \
  --sku Standard_LRS

# Create function app
az functionapp create --name mister-subsidie-api \
  --resource-group mister-subsidie-rg \
  --storage-account mistersubsidiestorage \
  --runtime node \
  --runtime-version 18 \
  --functions-version 4
```

3. **Configure app settings**
```bash
# Set all environment variables
az functionapp config appsettings set \
  --name mister-subsidie-api \
  --resource-group mister-subsidie-rg \
  --settings @appsettings.json
```

4. **Deploy the code**
```bash
func azure functionapp publish mister-subsidie-api
```

### Configure SignWell Webhook

1. Log into SignWell Dashboard
2. Navigate to Settings > Webhooks
3. Add webhook URL: `https://your-function-app.azurewebsites.net/api/webhook`
4. Select events to subscribe to
5. Copy the webhook secret to `SIGNWELL_API_APP_ID`

## 🔍 Monitoring & Troubleshooting

### View Logs
```bash
# Stream live logs
func azure functionapp logstream mister-subsidie-api

# View in Azure Portal
# Navigate to Function App > Functions > Monitor
```

### Common Issues

**SignWell API Errors**
- Check API key is valid and not expired
- Verify template IDs exist in your account
- Ensure test mode matches your SignWell environment

**OneDrive Upload Failures**
- Verify Azure AD app permissions are granted
- Check client secret hasn't expired
- Ensure user/site exists and is accessible
- Monitor storage quotas

**PDF Processing Issues**
- Check document structure matches expected format
- Verify page counts align with file info
- Review memory limits for large documents

**CORS Errors**
- Add frontend domain to allowed origins
- Check preflight requests are handled
- Verify headers are set correctly

## 🛡️ Security Best Practices

1. **API Keys & Secrets**
   - Store in Azure Key Vault for production
   - Rotate credentials regularly
   - Never commit secrets to git

2. **Access Control**
   - Use function-level authentication
   - Implement rate limiting
   - Validate all inputs

3. **Data Protection**
   - Encrypt sensitive data at rest
   - Use HTTPS for all communications
   - Implement audit logging

## 🤝 Contributing

1. Follow TDD principles - write tests first
2. Apply DRY - extract common logic
3. Use TypeScript strict mode
4. Document new endpoints
5. Update tests for changes

See [CLAUDE.md](CLAUDE.md) for detailed coding guidelines.

## 📚 Additional Documentation

- [OneDrive Setup Guide](docs/ONEDRIVE_SETUP.md)
- [SignWell Integration Guide](docs/signwell-integration.md)
- [Client OneDrive Setup Guide](docs/CLIENT_ONEDRIVE_SETUP_GUIDE.md)

## 📞 Support

For issues or questions:
1. Check existing documentation
2. Review error logs
3. Test with provided scripts
4. Contact development team

## 📄 License

This project is proprietary software. All rights reserved.