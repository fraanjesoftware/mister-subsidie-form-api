# Google Drive Service Account Setup for Production

This guide explains how to set up a Google Service Account for the Drive integration in production environments like Azure Functions.

## Why Service Accounts?

Service accounts are ideal for production because:
- No user interaction required for authentication
- Works in serverless environments (Azure Functions, AWS Lambda, etc.)
- Can be granted specific permissions without user consent flow
- Credentials can be stored securely as environment variables

## Step 1: Create a Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project or create a new one
3. Navigate to **IAM & Admin** > **Service Accounts**
4. Click **Create Service Account**
5. Fill in the details:
   - Service account name: `mister-subsidie-form-api`
   - Service account ID: (auto-generated)
   - Description: "Service account for Subsidie Forms API"
6. Click **Create and Continue**
7. Skip the optional steps and click **Done**

## Step 2: Create and Download Key

1. Click on the newly created service account
2. Go to the **Keys** tab
3. Click **Add Key** > **Create New Key**
4. Choose **JSON** format
5. Click **Create**
6. The JSON key file will be downloaded - **keep this secure!**

## Step 3: Enable Google Drive API

1. Go to **APIs & Services** > **Library**
2. Search for "Google Drive API"
3. Click on it and press **Enable**

## Step 4: Set Up Google Drive Folder Access

### Option A: Create a Dedicated Folder (Recommended)

1. Create a folder in Google Drive where forms will be uploaded
2. Right-click the folder and select **Share**
3. Add the service account email (found in the service account details)
   - Email format: `service-account-name@project-id.iam.gserviceaccount.com`
4. Give it **Editor** permissions
5. Copy the folder ID from the URL:
   - URL: `https://drive.google.com/drive/folders/FOLDER_ID_HERE`
   - Copy the `FOLDER_ID_HERE` part

### Option B: Use Shared Drive (For Teams)

1. Create or use an existing Shared Drive
2. Add the service account as a member with **Content Manager** role
3. Create a folder in the Shared Drive for form uploads
4. Copy the folder ID

## Step 5: Configure Azure Function App

1. Go to your Azure Function App in the [Azure Portal](https://portal.azure.com)
2. Navigate to **Configuration** > **Application settings**
3. Add the following environment variables:

### GOOGLE_CREDENTIALS
- Name: `GOOGLE_CREDENTIALS`
- Value: The entire contents of your service account JSON file
- Example:
```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "key-id",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "service-account@project.iam.gserviceaccount.com",
  "client_id": "123456789",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/..."
}
```

### GOOGLE_DRIVE_FOLDER_ID
- Name: `GOOGLE_DRIVE_FOLDER_ID`
- Value: The folder ID from Step 4
- Example: `1ABC_defGHI123JKL456mnoPQR789`

4. Click **Save** and restart your Function App

## Step 6: Local Development Setup

For local development, update your `local.settings.json`:

```json
{
  "IsEncrypted": false,
  "Values": {
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "GOOGLE_CREDENTIALS": "{\"type\":\"service_account\",\"project_id\":\"...\"}",
    "GOOGLE_DRIVE_FOLDER_ID": "your-folder-id-here"
  }
}
```

**Important**: Never commit `local.settings.json` with real credentials!

## Step 7: Test the Setup

Deploy your function and test with a POST request:

```bash
curl -X POST https://your-function-app.azurewebsites.net/api/fillForms \
  -H "Content-Type: application/json" \
  -d '{
    "uploadToDrive": true,
    "forms": {
      "deMinimis": {
        "companyName": "Test Company",
        "address": "Test Address 123"
      }
    }
  }'
```

## Security Best Practices

1. **Never commit service account keys** to version control
2. **Use Key Vault** for production:
   - Store the service account JSON in Azure Key Vault
   - Reference it in your Function App configuration
3. **Limit permissions**:
   - Only grant access to specific folders
   - Use least-privilege principle
4. **Rotate keys regularly**:
   - Create new keys periodically
   - Delete old keys after rotation
5. **Monitor usage**:
   - Check Google Cloud Console for API usage
   - Set up alerts for unusual activity

## Troubleshooting

### "Invalid grant" or Authentication Errors
- Verify the service account key is valid
- Check that the JSON is properly formatted in the environment variable
- Ensure the Google Drive API is enabled

### "Insufficient Permission" Errors
- Verify the service account has access to the target folder
- Check that the folder ID is correct
- For Shared Drives, ensure proper membership and permissions

### "Folder not found" Errors
- Double-check the GOOGLE_DRIVE_FOLDER_ID value
- Ensure the service account has access to the folder
- Try accessing the folder directly with the service account

## Using with GitHub Actions

Add the service account credentials as secrets in your repository:

1. Go to **Settings** > **Secrets and variables** > **Actions**
2. Add a new secret named `GOOGLE_CREDENTIALS` with the JSON content
3. Add another secret `GOOGLE_DRIVE_FOLDER_ID` with the folder ID
4. Update your workflow to pass these to Azure during deployment

## Alternative: Workload Identity Federation

For enhanced security, consider using Workload Identity Federation:
- No service account keys to manage
- Direct Azure-to-Google authentication
- Requires additional setup but more secure

See [Google's Workload Identity Federation guide](https://cloud.google.com/iam/docs/workload-identity-federation) for details.