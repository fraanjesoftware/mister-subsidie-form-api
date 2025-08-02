# OneDrive Integration Setup Guide

This guide walks you through setting up the OneDrive integration for automatically uploading signed documents.

## Overview

When a document is completed in SignWell, the webhook will:
1. Download the signed PDF
2. Split it into individual documents
3. Upload all files to OneDrive in an organized folder structure

## Prerequisites

- Azure AD tenant with admin access
- OneDrive for Business or SharePoint site
- Azure AD app registration permissions

## Step 1: Create Azure AD App Registration

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** > **App registrations**
3. Click **New registration**
   - Name: `SLIM Subsidie OneDrive Integration`
   - Supported account types: `Accounts in this organizational directory only`
   - Click **Register**

4. Save the following from the Overview page:
   - **Application (client) ID** → `ONEDRIVE_CLIENT_ID`
   - **Directory (tenant) ID** → `ONEDRIVE_TENANT_ID`

## Step 2: Create Client Secret

1. In your app registration, go to **Certificates & secrets**
2. Click **New client secret**
   - Description: `OneDrive Upload Secret`
   - Expires: Choose appropriate expiry
3. **Copy the secret value immediately** → `ONEDRIVE_CLIENT_SECRET`
   - ⚠️ This value is only shown once!

## Step 3: Configure API Permissions

1. Go to **API permissions**
2. Click **Add a permission**
3. Select **Microsoft Graph**
4. Choose **Application permissions**
5. Add these permissions:
   - `Files.ReadWrite.All` - Read and write files in all site collections
   - `Sites.ReadWrite.All` - (Optional, for SharePoint)
6. Click **Grant admin consent** ✅

## Step 4: Configure Environment Variables

Add to your `.env` file:

```env
# Azure AD App
ONEDRIVE_CLIENT_ID=your-app-client-id
ONEDRIVE_CLIENT_SECRET=your-client-secret
ONEDRIVE_TENANT_ID=your-tenant-id

# Option 1: User's OneDrive
ONEDRIVE_USER_ID=user@yourdomain.com

# Option 2: SharePoint Site (use instead of USER_ID)
# ONEDRIVE_SITE_ID=yourdomain.sharepoint.com,site-guid,web-guid

# Folder settings
ONEDRIVE_ROOT_FOLDER=/SLIM Subsidies 2025
```

### Finding Site ID for SharePoint

To get the Site ID for SharePoint:

1. Visit your SharePoint site
2. Append `/_api/site/id` to the URL
3. You'll get a response like:
   ```xml
   <d:Id>yourdomain.sharepoint.com,12345678-1234-1234-1234-123456789012,87654321-4321-4321-4321-210987654321</d:Id>
   ```
4. Use this entire value as `ONEDRIVE_SITE_ID`

## Step 5: Test the Integration

Run the test script:

```bash
npm run build
node test-onedrive.js
```

Expected output:
```
✅ OneDrive configuration found
   Target: User OneDrive
   Root folder: /SLIM Subsidies 2025

Attempting to upload test documents...

✅ Upload successful!

Uploaded files:
   - Test_Document_Complete.pdf
     Size: 357 bytes
     Web URL: https://yourdomain-my.sharepoint.com/...
```

## Step 6: Deploy and Test Webhook

1. Deploy your updated code
2. Complete a test signing in SignWell
3. Check the webhook logs for OneDrive upload status
4. Verify files appear in OneDrive

## Folder Structure

Documents are organized as:
```
/SLIM Subsidies 2025/
└── Completed Documents/
    └── 2025-01-January/
        └── Test Company B.V. - 12345678/
            ├── SLIM_Aanvraag_Complete_abc12345.pdf
            ├── SLIM_Aanvraag_Pagina_1.pdf
            ├── SLIM_Aanvraag_Pagina_2.pdf
            └── SLIM_Audit_Trail_abc12345.pdf
```

## Troubleshooting

### Authentication Errors
- Verify client ID and secret are correct
- Ensure admin consent is granted
- Check tenant ID matches your Azure AD

### Permission Errors
- Confirm `Files.ReadWrite.All` permission is granted
- For SharePoint: also need `Sites.ReadWrite.All`
- Admin consent must be granted

### Resource Not Found
- Verify user email or site ID is correct
- Ensure OneDrive is enabled for the user
- Check SharePoint site exists and is accessible

### Upload Failures
- Check file size limits (4MB for simple upload)
- Verify folder permissions
- Check OneDrive storage quota

## Security Considerations

1. **Client Secret**: Store securely, rotate regularly
2. **Permissions**: Use minimum required permissions
3. **Access**: Limit to specific sites/users if possible
4. **Monitoring**: Set up alerts for failed uploads

## Support

For issues:
1. Check Azure AD app audit logs
2. Review Function App logs for detailed errors
3. Test with the provided test script
4. Verify all environment variables are set correctly