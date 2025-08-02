# SignWell Integration Guide

This guide explains how to use the SignWell API integration for creating document signing sessions.

## Setup

1. **Get your SignWell API Key**
   - Sign up for a SignWell account at https://www.signwell.com
   - Navigate to Settings -> API
   - Copy your API key

2. **Configure Environment Variables**
   Add the following to your `.env` file:
   ```
   SIGNWELL_API_KEY=your-signwell-api-key-here
   SIGNWELL_TEST_MODE=true  # Set to false for production
   SIGNWELL_ENVIRONMENT=test  # Use 'production' for live documents
   ```

## API Endpoint

### Create SignWell Signing Session

**Endpoint:** `POST /api/createSignWellSigningSession`

**Request Body:**
```json
{
  "templateId": "your-template-id",  // Required for now
  "name": "Document Name",
  "subject": "Please sign this document",  // Optional
  "message": "Additional message for signers",  // Optional
  "recipients": [
    {
      "name": "John Doe",
      "email": "john@example.com",
      "order": 1  // Optional, defaults to array index + 1
    },
    {
      "name": "Jane Smith",
      "email": "jane@example.com",
      "order": 2
    }
  ],
  "embeddedSigning": true,  // Defaults to true
  "redirectUri": "https://yourapp.com/signing-complete",  // Optional
  "metadata": {  // Optional custom data
    "applicationId": "12345",
    "userId": "user-123"
  },
  "testMode": true  // Optional, overrides environment setting
}
```

**Response:**
```json
{
  "documentId": "doc_abc123",
  "documentName": "Document Name",
  "status": "sent",
  "signingUrls": [
    {
      "recipientId": "recipient_1",
      "name": "John Doe",
      "email": "john@example.com",
      "signingUrl": "https://www.signwell.com/embedded/sign/...",
      "status": "sent"
    },
    {
      "recipientId": "recipient_2",
      "name": "Jane Smith",
      "email": "jane@example.com",
      "signingUrl": "https://www.signwell.com/embedded/sign/...",
      "status": "sent"
    }
  ],
  "metadata": {
    "applicationId": "12345",
    "userId": "user-123"
  }
}
```

## Frontend Integration

To embed the signing experience in your application:

```html
<div id="signwell-container"></div>

<script src="https://static.signwell.com/assets/embedded.js"></script>
<script>
  // Get the signing URL from the API response
  const signingUrl = response.signingUrls[0].signingUrl;
  
  // Initialize the embedded signing
  const signwell = new SignWellEmbed({
    url: signingUrl,
    container: document.getElementById('signwell-container'),
    dimensions: {
      width: '100%',
      height: '600px'
    }
  });

  // Handle events
  signwell.on('completed', (event) => {
    console.log('Document signed successfully', event);
    // Redirect or update UI
  });

  signwell.on('declined', (event) => {
    console.log('Signing declined', event);
  });

  signwell.on('error', (event) => {
    console.error('Signing error', event);
  });

  signwell.on('closed', (event) => {
    console.log('Signing window closed', event);
  });
</script>
```

## Creating Templates

1. Log in to your SignWell account
2. Navigate to Templates
3. Create a new template with signature fields
4. Copy the template ID for use in API calls

## Test Mode

When `test_mode` is enabled:
- Documents won't count against your plan limits
- Documents will be watermarked as "TEST"
- Rate limits are reduced (20 requests/minute)

## Error Handling

The API returns standard HTTP status codes:
- `200` - Success
- `400` - Bad request (invalid parameters)
- `401` - Unauthorized (invalid API key)
- `429` - Rate limit exceeded
- `500` - Server error

## Differences from DocuSign

1. **Simpler Authentication**: SignWell uses API keys instead of OAuth/JWT
2. **Embedded Signing**: Uses JavaScript SDK instead of iframe URLs
3. **Templates**: Must create templates in SignWell dashboard first
4. **Recipients**: Each recipient needs a unique ID
5. **Test Mode**: Built-in test mode flag instead of separate environments

## Next Steps

1. Create templates in your SignWell dashboard
2. Update frontend to use SignWell embedded signing
3. Implement webhook handling for document completion events
4. Add support for direct document uploads (without templates)