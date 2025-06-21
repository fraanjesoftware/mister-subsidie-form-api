# Google Drive Setup Instructions

To enable Google Drive uploads, you need to set up authentication with the Google Drive API.

## Step 1: Enable Google Drive API

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Drive API:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Drive API"
   - Click on it and press "Enable"

## Step 2: Create OAuth 2.0 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. If prompted, configure the OAuth consent screen first:
   - Choose "External" user type (or "Internal" for G Suite)
   - Fill in the required fields
   - Add your email to test users
4. For Application type, choose "Desktop app"
5. Name it (e.g., "Subsidie Forms App")
6. Click "Create"

## Step 3: Download Credentials

1. After creating the OAuth client, click the download button (⬇️)
2. Save the file as `credentials.json` in the project root directory
3. Add `credentials.json` and `token.json` to your `.gitignore` file

## Step 4: First-time Authentication

When you run the upload script for the first time:

```bash
node fill-and-upload.js
```

1. It will open your default browser
2. Log in with your Google account
3. Grant the requested permissions
4. The script will save the authentication token locally

## Step 5: Test the Setup

Run the example to test:

```bash
node fill-and-upload.js
```

This will:
- Fill all three forms with example data
- Create a "Subsidie Forms" folder in your Google Drive
- Upload the PDFs to a timestamped subfolder

## Troubleshooting

### "Error: Cannot find module 'credentials.json'"
- Make sure you've downloaded and saved the credentials file in the project root

### "Error during authentication"
- Check that the credentials.json file is valid
- Ensure you have internet connection
- Try deleting token.json and re-authenticating

### "Insufficient Permission" errors
- Make sure the Google Drive API is enabled in your project
- Check that the OAuth scope includes drive.file permission

## Security Notes

- **Never commit** `credentials.json` or `token.json` to version control
- The token expires after some time and will refresh automatically
- Each user needs their own credentials for their Google Drive

## Using in Production

For production use, consider:
- Using a service account instead of OAuth
- Implementing proper error handling and retries
- Setting up a shared Drive folder for team access