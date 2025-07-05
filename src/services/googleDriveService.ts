import * as fs from 'fs/promises';
import * as path from 'path';
import { google, drive_v3 } from 'googleapis';
import { GoogleAuth, OAuth2Client } from 'google-auth-library';
import { Readable } from 'stream';

interface DriveFile {
  id: string;
  name: string;
  webViewLink?: string;
  webContentLink?: string;
}

interface UploadResult {
  filename?: string;
  localPath?: string;
  driveFile?: DriveFile;
  error?: string;
  success: boolean;
}

interface UploadPDFsResult {
  folder: DriveFile;
  files: UploadResult[];
}

interface PDFFile {
  filename: string;
  pdfBytes: Uint8Array;
}

class GoogleDriveService {
  private SCOPES: string[];
  private drive: drive_v3.Drive | null;

  constructor() {
    // Use 'drive' scope to access shared folders and files
    // 'drive.file' only allows access to files created by this app
    this.SCOPES = ['https://www.googleapis.com/auth/drive'];
    this.drive = null;
  }

  /**
   * Initialize the Drive service using service account or OAuth credentials
   */
  async initialize(): Promise<void> {
    try {
      // Try to use credentials from environment variable (for Azure deployment)
      const credentialsJson = process.env.GOOGLE_CREDENTIALS;
      if (credentialsJson) {
        const credentials = JSON.parse(credentialsJson);
        
        // Check if it's a service account
        if (credentials.type === 'service_account') {
          const auth = new GoogleAuth({
            credentials: credentials,
            scopes: this.SCOPES
          });
          this.drive = google.drive({ version: 'v3', auth: auth as any });
        } else {
          // OAuth2 credentials
          const oauth2Client = new OAuth2Client(
            credentials.client_id,
            credentials.client_secret,
            credentials.redirect_uri
          );
          oauth2Client.setCredentials(credentials.tokens);
          this.drive = google.drive({ version: 'v3', auth: oauth2Client as any });
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
  async createFolder(folderName: string, parentFolderId?: string | null): Promise<DriveFile> {
    if (!this.drive) await this.initialize();
    
    const fileMetadata: drive_v3.Schema$File = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    };
    
    if (parentFolderId) {
      fileMetadata.parents = [parentFolderId];
    }
    
    try {
      const response = await this.drive!.files.create({
        requestBody: fileMetadata,
        fields: 'id, name',
      });
      return response.data as DriveFile;
    } catch (error) {
      console.error('Error creating folder:', error);
      throw error;
    }
  }

  /**
   * Check if a folder exists and return its ID
   */
  async findFolder(folderName: string, parentFolderId?: string | null): Promise<DriveFile | null> {
    if (!this.drive) await this.initialize();
    
    let query = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    if (parentFolderId) {
      query += ` and '${parentFolderId}' in parents`;
    }
    
    try {
      const response = await this.drive!.files.list({
        q: query,
        fields: 'files(id, name)',
        spaces: 'drive',
      });
      
      if (response.data.files && response.data.files.length > 0) {
        return response.data.files[0] as DriveFile;
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
  async getOrCreateFolder(folderName: string, parentFolderId?: string | null): Promise<DriveFile> {
    const existingFolder = await this.findFolder(folderName, parentFolderId);
    if (existingFolder) {
      return existingFolder;
    }
    return await this.createFolder(folderName, parentFolderId);
  }

  /**
   * Upload a PDF file to Google Drive
   */
  async uploadPDF(filePath: string, folderId?: string | null): Promise<DriveFile> {
    if (!this.drive) await this.initialize();
    
    const fileName = path.basename(filePath);
    const fileMetadata: drive_v3.Schema$File = {
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
      body: Readable.from(Buffer.from(fileContent)),
    };
    
    try {
      const response = await this.drive!.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id, name, webViewLink, webContentLink',
      });
      
      return response.data as DriveFile;
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  }

  /**
   * Upload a PDF from memory to Google Drive
   */
  async uploadPDFFromMemory(filename: string, pdfBytes: Uint8Array, folderId?: string | null): Promise<DriveFile> {
    if (!this.drive) await this.initialize();
    
    const fileMetadata: drive_v3.Schema$File = {
      name: filename,
    };
    
    // Use configured folder ID from environment if no folder ID provided
    if (!folderId && process.env.GOOGLE_DRIVE_FOLDER_ID) {
      folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    }
    
    if (folderId) {
      fileMetadata.parents = [folderId];
    }
    
    const media = {
      mimeType: 'application/pdf',
      body: Readable.from(Buffer.from(pdfBytes)),
    };
    
    try {
      const response = await this.drive!.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id, name, webViewLink, webContentLink',
      });
      
      return response.data as DriveFile;
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  }

  /**
   * Upload multiple PDFs from memory to a specific folder
   */
  async uploadPDFsFromMemory(pdfFiles: PDFFile[], folderName: string = 'Subsidie Forms'): Promise<UploadPDFsResult> {
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
    
    const uploadResults: UploadResult[] = [];
    
    for (const pdfFile of pdfFiles) {
      try {
        const result = await this.uploadPDFFromMemory(pdfFile.filename, pdfFile.pdfBytes, subfolder.id);
        uploadResults.push({
          filename: pdfFile.filename,
          driveFile: result,
          success: true,
        });
      } catch (error) {
        uploadResults.push({
          filename: pdfFile.filename,
          error: (error as Error).message,
          success: false,
        });
      }
    }
    
    return {
      folder: subfolder,
      files: uploadResults,
    };
  }

  /**
   * Upload multiple PDFs to a specific folder
   */
  async uploadPDFs(filePaths: string[], folderName: string = 'Subsidie Forms'): Promise<UploadPDFsResult> {
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
    
    const uploadResults: UploadResult[] = [];
    
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
          error: (error as Error).message,
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

export default GoogleDriveService;