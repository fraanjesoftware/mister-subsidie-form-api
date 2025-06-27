const fs = require('fs').promises;
const path = require('path');
const { google } = require('googleapis');

class GoogleDriveService {
  constructor() {
    this.SCOPES = ['https://www.googleapis.com/auth/drive.file'];
    this.drive = null;
  }

  /**
   * Initialize the Drive service using service account or OAuth credentials
   */
  async initialize() {
    try {
      // Try to use credentials from environment variable (for Azure deployment)
      const credentialsJson = process.env.GOOGLE_CREDENTIALS;
      if (credentialsJson) {
        const credentials = JSON.parse(credentialsJson);
        
        // Check if it's a service account
        if (credentials.type === 'service_account') {
          const auth = new google.auth.GoogleAuth({
            credentials: credentials,
            scopes: this.SCOPES
          });
          this.drive = google.drive({ version: 'v3', auth });
        } else {
          // OAuth2 credentials
          const oauth2Client = new google.auth.OAuth2(
            credentials.client_id,
            credentials.client_secret,
            credentials.redirect_uri
          );
          oauth2Client.setCredentials(credentials.tokens);
          this.drive = google.drive({ version: 'v3', auth: oauth2Client });
        }
      } else {
        throw new Error('GOOGLE_CREDENTIALS environment variable not set');
      }
    } catch (error) {
      console.error('Error initializing Google Drive:', error);
      throw error;
    }
  }

  /**
   * Create a folder in Google Drive
   */
  async createFolder(folderName, parentFolderId = null) {
    if (!this.drive) await this.initialize();
    
    const fileMetadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    };
    
    if (parentFolderId) {
      fileMetadata.parents = [parentFolderId];
    }
    
    try {
      const response = await this.drive.files.create({
        resource: fileMetadata,
        fields: 'id, name',
      });
      return response.data;
    } catch (error) {
      console.error('Error creating folder:', error);
      throw error;
    }
  }

  /**
   * Check if a folder exists and return its ID
   */
  async findFolder(folderName, parentFolderId = null) {
    if (!this.drive) await this.initialize();
    
    let query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    if (parentFolderId) {
      query += ` and '${parentFolderId}' in parents`;
    }
    
    try {
      const response = await this.drive.files.list({
        q: query,
        fields: 'files(id, name)',
        spaces: 'drive',
      });
      
      if (response.data.files.length > 0) {
        return response.data.files[0];
      }
      return null;
    } catch (error) {
      console.error('Error finding folder:', error);
      throw error;
    }
  }

  /**
   * Get or create a folder
   */
  async getOrCreateFolder(folderName, parentFolderId = null) {
    const existingFolder = await this.findFolder(folderName, parentFolderId);
    if (existingFolder) {
      return existingFolder;
    }
    return await this.createFolder(folderName, parentFolderId);
  }

  /**
   * Upload a PDF file to Google Drive
   */
  async uploadPDF(filePath, folderId = null) {
    if (!this.drive) await this.initialize();
    
    const fileName = path.basename(filePath);
    const fileMetadata = {
      name: fileName,
    };
    
    // Use configured folder ID from environment if no folder ID provided
    if (!folderId && process.env.GOOGLE_DRIVE_FOLDER_ID) {
      folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    }
    
    if (folderId) {
      fileMetadata.parents = [folderId];
    }
    
    const fileContent = await fs.readFile(filePath);
    const media = {
      mimeType: 'application/pdf',
      body: require('stream').Readable.from(fileContent),
    };
    
    try {
      const response = await this.drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id, name, webViewLink, webContentLink',
      });
      
      return response.data;
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  }

  /**
   * Upload multiple PDFs to a specific folder
   */
  async uploadPDFs(filePaths, folderName = 'Subsidie Forms') {
    if (!this.drive) await this.initialize();
    
    // Get or create the main folder
    const mainFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID || null;
    const folder = mainFolderId 
      ? { id: mainFolderId, name: 'Configured Folder' }
      : await this.getOrCreateFolder(folderName);
    
    // Create a subfolder with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const subfolderName = `Forms_${timestamp}`;
    const subfolder = await this.createFolder(subfolderName, folder.id);
    
    const uploadResults = [];
    
    for (const filePath of filePaths) {
      try {
        const result = await this.uploadPDF(filePath, subfolder.id);
        uploadResults.push({
          localPath: filePath,
          driveFile: result,
          success: true,
        });
      } catch (error) {
        uploadResults.push({
          localPath: filePath,
          error: error.message,
          success: false,
        });
      }
    }
    
    return {
      folder: subfolder,
      files: uploadResults,
    };
  }
}

module.exports = GoogleDriveService;