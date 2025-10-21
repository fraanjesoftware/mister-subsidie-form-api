import axios, { AxiosInstance } from 'axios';
import { 
  OneDriveConfig, 
  OneDriveAuthToken, 
  OneDriveUploadResult, 
  OneDriveFolderResult,
  OneDriveError,
  OneDriveUploadSession,
  DocumentMetadata
} from '../types/onedrive';
import { ONEDRIVE_CONFIG } from '../constants/onedrive';

export class OneDriveService {
  private config: OneDriveConfig;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;
  private graphClient: AxiosInstance;

  constructor(config?: Partial<OneDriveConfig>) {
    // Check if axios is available
    if (!axios) {
      throw new Error('axios is not available. Please ensure axios is installed.');
    }
    
    this.config = {
      clientId: config?.clientId || process.env.ONEDRIVE_CLIENT_ID || '',
      clientSecret: config?.clientSecret || process.env.ONEDRIVE_CLIENT_SECRET || '',
      tenantId: config?.tenantId || process.env.ONEDRIVE_TENANT_ID || '',
      rootFolder: '', // Not used anymore - we generate it dynamically
      userId: config?.userId || process.env.ONEDRIVE_USER_ID,
      siteId: config?.siteId || process.env.ONEDRIVE_SITE_ID,
    };

    if (!this.config.clientId || !this.config.clientSecret || !this.config.tenantId) {
      const missingVars = [];
      if (!this.config.clientId) missingVars.push('ONEDRIVE_CLIENT_ID');
      if (!this.config.clientSecret) missingVars.push('ONEDRIVE_CLIENT_SECRET');
      if (!this.config.tenantId) missingVars.push('ONEDRIVE_TENANT_ID');
      throw new Error(`OneDrive configuration incomplete. Missing: ${missingVars.join(', ')}`);
    }

    this.graphClient = axios.create({
      baseURL: ONEDRIVE_CONFIG.GRAPH_API_BASE_URL,
      timeout: 30000,
    });
  }

  /**
   * Get or refresh the access token
   */
  private async authenticate(): Promise<string> {
    // Check if we have a valid token
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken;
    }

    try {
      const tokenUrl = `${ONEDRIVE_CONFIG.AUTH_URL}/${this.config.tenantId}/oauth2/v2.0/token`;
      
      const params = new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        scope: ONEDRIVE_CONFIG.SCOPES.join(' '),
        grant_type: 'client_credentials',
      });

      const response = await axios.post<OneDriveAuthToken>(tokenUrl, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      this.accessToken = response.data.access_token;
      // Set expiry 5 minutes before actual expiry for safety
      this.tokenExpiry = new Date(Date.now() + (response.data.expires_in - 300) * 1000);
      
      // Update axios instance with new token
      this.graphClient.defaults.headers.common['Authorization'] = `Bearer ${this.accessToken}`;
      
      return this.accessToken;
    } catch (error) {
      // Log raw error for debugging
      console.error('OneDrive authentication raw error:', error);
      console.error('Error type:', typeof error);
      console.error('Error constructor:', error?.constructor?.name);
      
      // Try to get more details
      if (error && typeof error === 'object') {
        console.error('Error keys:', Object.keys(error));
        if ('response' in error) {
          console.error('Error response:', error.response);
        }
        if ('message' in error) {
          console.error('Error message:', error.message);
        }
      }
      
      throw new Error(`Failed to authenticate with OneDrive: ${this.formatError(error)}`);
    }
  }

  /**
   * Get the base path for OneDrive operations
   */
  private getBasePath(): string {
    if (this.config.siteId) {
      // SharePoint site
      return `/sites/${this.config.siteId}/drive`;
    } else if (this.config.userId) {
      // Personal OneDrive
      return `/users/${this.config.userId}/drive`;
    } else {
      // Default to me (requires delegated permissions)
      throw new Error('Either userId or siteId must be configured for app-only authentication');
    }
  }

  /**
   * Create folder structure for document organization
   */
  async createFolderStructure(metadata: DocumentMetadata): Promise<string> {
    await this.authenticate();

    const date = new Date(metadata.signedAt);
    const year = date.getFullYear();
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    // Sanitize company name for folder name
    const sanitizedCompanyName = this.sanitizeFileName(metadata.companyName);
    
    // Get folder names from environment variables with fallbacks
    const apiRootFolderName = process.env.ONEDRIVE_API_FOLDER_NAME || 'SLIM Subsidies';
    const igniteRootFolderName = process.env.ONEDRIVE_IGNITE_FOLDER_NAME || `${apiRootFolderName} Ignite`;
    const externalRootFolderName = process.env.ONEDRIVE_EXTERNAL_FOLDER_NAME || 'SignWell Documenten';
    const isIgniteTenant = (metadata.tenantId?.toLowerCase() === 'ignite') || (metadata.metadataSource?.toLowerCase() === 'ignite');
    
    // Different folder structure for external documents
    let folderPath: string;
    if (metadata.isExternal) {
      // External documents go to: /[ExternalFolderName]/2025/Company Name - 15-11-2025
      const rootFolder = externalRootFolderName;
      const yearFolder = String(year);
      const companyFolder = `${sanitizedCompanyName} - ${day}-${month}-${year}`;
      folderPath = `${rootFolder}/${yearFolder}/${companyFolder}`;
    } else {
      // API documents go to: /[APIFolderName] 2025/Company Name - 15-11-2025 14-35
      const rootFolderBase = isIgniteTenant ? igniteRootFolderName : apiRootFolderName;
      const rootFolder = `${rootFolderBase} ${year}`;
      const companyFolder = `${sanitizedCompanyName} - ${day}-${month}-${year} ${hours}-${minutes}`;
      folderPath = `${rootFolder}/${companyFolder}`;
    }
    
    // Create folders recursively
    const folderId = await this.createFolderRecursive(folderPath);
    return folderId;
  }

  /**
   * Create folders recursively
   */
  private async createFolderRecursive(path: string): Promise<string> {
    const segments = path.split('/').filter(s => s);
    let currentPath = '';
    let parentId = 'root';

    for (const segment of segments) {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;
      
      try {
        // Try to get the folder by path
        const basePath = this.getBasePath();
        const response = await this.graphClient.get<OneDriveFolderResult>(
          `${basePath}/root:/${currentPath}`
        );
        parentId = response.data.id;
      } catch (error: any) {
        // If folder doesn't exist, create it
        if (error.response?.status === 404) {
          const newFolder = await this.createFolder(segment, parentId);
          parentId = newFolder.id;
        } else {
          throw new Error(`Failed to create folder structure: ${this.formatError(error)}`);
        }
      }
    }

    return parentId;
  }


  /**
   * Create a folder
   */
  private async createFolder(name: string, parentId: string): Promise<OneDriveFolderResult> {
    try {
      const basePath = this.getBasePath();
      const response = await this.graphClient.post<OneDriveFolderResult>(
        `${basePath}/items/${parentId}/children`,
        {
          name: name,
          folder: {},
          '@microsoft.graph.conflictBehavior': 'rename',
        }
      );
      return response.data;
    } catch (error) {
      throw new Error(`Failed to create folder: ${this.formatError(error)}`);
    }
  }

  /**
   * Upload a file to OneDrive
   */
  async uploadFile(
    buffer: Buffer, 
    fileName: string, 
    folderId: string
  ): Promise<OneDriveUploadResult> {
    await this.authenticate();

    const sanitizedFileName = this.sanitizeFileName(fileName);
    
    // Use simple upload for files < 4MB, otherwise use upload session
    if (buffer.length < ONEDRIVE_CONFIG.MAX_FILE_SIZE) {
      return this.simpleUpload(buffer, sanitizedFileName, folderId);
    } else {
      return this.largeFileUpload(buffer, sanitizedFileName, folderId);
    }
  }

  /**
   * Simple upload for small files
   */
  private async simpleUpload(
    buffer: Buffer, 
    fileName: string, 
    folderId: string
  ): Promise<OneDriveUploadResult> {
    try {
      const basePath = this.getBasePath();
      const response = await this.graphClient.put<OneDriveUploadResult>(
        `${basePath}/items/${folderId}:/${encodeURIComponent(fileName)}:/content`,
        buffer,
        {
          headers: {
            'Content-Type': 'application/pdf',
          },
        }
      );
      return response.data;
    } catch (error) {
      throw new Error(`Failed to upload file: ${this.formatError(error)}`);
    }
  }

  /**
   * Large file upload using upload session
   */
  private async largeFileUpload(
    buffer: Buffer, 
    fileName: string, 
    folderId: string
  ): Promise<OneDriveUploadResult> {
    try {
      // Create upload session
      const basePath = this.getBasePath();
      const sessionResponse = await this.graphClient.post<OneDriveUploadSession>(
        `${basePath}/items/${folderId}:/${encodeURIComponent(fileName)}:/createUploadSession`,
        {
          item: {
            '@microsoft.graph.conflictBehavior': 'rename',
            name: fileName,
          },
        }
      );

      const uploadUrl = sessionResponse.data.uploadUrl;
      const fileSize = buffer.length;
      let uploadedBytes = 0;

      // Upload in chunks
      while (uploadedBytes < fileSize) {
        const chunkSize = Math.min(ONEDRIVE_CONFIG.CHUNK_SIZE, fileSize - uploadedBytes);
        const chunk = buffer.subarray(uploadedBytes, uploadedBytes + chunkSize);
        
        const contentRange = `bytes ${uploadedBytes}-${uploadedBytes + chunkSize - 1}/${fileSize}`;
        
        const chunkResponse = await axios.put(uploadUrl, chunk, {
          headers: {
            'Content-Length': chunkSize.toString(),
            'Content-Range': contentRange,
          },
        });

        uploadedBytes += chunkSize;

        // Last chunk returns the file metadata
        if (uploadedBytes >= fileSize) {
          return chunkResponse.data as OneDriveUploadResult;
        }
      }

      throw new Error('Upload completed but no file metadata returned');
    } catch (error) {
      throw new Error(`Failed to upload large file: ${this.formatError(error)}`);
    }
  }

  /**
   * Upload documents from SignWell webhook
   */
  async uploadSignedDocuments(
    documents: { buffer: Buffer; fileName: string }[],
    metadata: DocumentMetadata
  ): Promise<OneDriveUploadResult[]> {
    try {
      // Create folder structure
      const folderId = await this.createFolderStructure(metadata);
      
      // Upload all documents in parallel
      const uploadPromises = documents.map(doc => 
        this.uploadFileWithRetry(doc.buffer, doc.fileName, folderId)
      );
      
      const results = await Promise.all(uploadPromises);
      return results;
    } catch (error) {
      throw new Error(`Failed to upload signed documents: ${this.formatError(error)}`);
    }
  }

  /**
   * Upload file with retry logic
   */
  private async uploadFileWithRetry(
    buffer: Buffer,
    fileName: string,
    folderId: string,
    attempt = 1
  ): Promise<OneDriveUploadResult> {
    try {
      return await this.uploadFile(buffer, fileName, folderId);
    } catch (error) {
      if (attempt < ONEDRIVE_CONFIG.MAX_RETRIES) {
        const delay = ONEDRIVE_CONFIG.RETRY_DELAY * Math.pow(ONEDRIVE_CONFIG.RETRY_MULTIPLIER, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.uploadFileWithRetry(buffer, fileName, folderId, attempt + 1);
      }
      throw error;
    }
  }

  /**
   * Create application-based folder at tenant root
   * Used for new application-based file organization
   */
  async createApplicationFolder(
    applicationId: string,
    tenantId: string
  ): Promise<{ folderId: string; folderPath: string }> {
    await this.authenticate();

    // Determine root folder based on tenant
    const isIgniteTenant = tenantId?.toLowerCase() === 'ignite';
    const apiRootFolderName = process.env.ONEDRIVE_API_FOLDER_NAME || 'SLIM Subsidies';
    const igniteRootFolderName = process.env.ONEDRIVE_IGNITE_FOLDER_NAME || `${apiRootFolderName} Ignite`;
    const rootFolderName = isIgniteTenant ? igniteRootFolderName : apiRootFolderName;

    // Application folders go directly in root: /SLIM Subsidies/CompanyName-DD-MM-YYYY/
    const folderPath = `${rootFolderName}/${applicationId}`;

    try {
      // Create folder structure recursively
      const folderId = await this.createFolderRecursive(folderPath);

      return {
        folderId,
        folderPath
      };
    } catch (error) {
      throw new Error(`Failed to create application folder: ${this.formatError(error)}`);
    }
  }

  /**
   * Rename folder by ID
   * Used when user changes company name after initial submission
   */
  async renameFolder(folderId: string, newName: string): Promise<void> {
    await this.authenticate();

    try {
      const basePath = this.getBasePath();
      await this.graphClient.patch(
        `${basePath}/items/${folderId}`,
        {
          name: newName
        }
      );
    } catch (error) {
      throw new Error(`Failed to rename folder: ${this.formatError(error)}`);
    }
  }

  /**
   * Upload file directly to folder by ID
   * More efficient than path-based upload when folderId is known
   */
  async uploadToFolder(
    folderId: string,
    buffer: Buffer,
    fileName: string
  ): Promise<OneDriveUploadResult> {
    await this.authenticate();

    const sanitizedFileName = this.sanitizeFileName(fileName);

    // Use simple upload for files < 4MB, otherwise use upload session
    if (buffer.length < ONEDRIVE_CONFIG.MAX_FILE_SIZE) {
      return this.simpleUpload(buffer, sanitizedFileName, folderId);
    } else {
      return this.largeFileUpload(buffer, sanitizedFileName, folderId);
    }
  }

  /**
   * Update existing file in folder
   * Replaces file content if it exists, creates if it doesn't
   */
  async updateFileInFolder(
    folderId: string,
    fileName: string,
    buffer: Buffer
  ): Promise<OneDriveUploadResult> {
    // Same as uploadToFolder - OneDrive API handles replace automatically
    // with '@microsoft.graph.conflictBehavior': 'replace'
    return this.uploadToFolder(folderId, buffer, fileName);
  }

  /**
   * Sanitize file name for OneDrive
   */
  private sanitizeFileName(fileName: string): string {
    return fileName.replace(ONEDRIVE_CONFIG.SANITIZE_REGEX, '_');
  }


  /**
   * Format error message
   */
  private formatError(error: any): string {
    // Handle null or undefined
    if (!error) {
      return 'Unknown error (null or undefined)';
    }
    
    // Check if axios is available and if it's an axios error
    if (typeof axios !== 'undefined' && axios.isAxiosError && axios.isAxiosError(error)) {
      // Handle Azure AD authentication errors (different structure than Graph API errors)
      if (error.response?.data) {
        const data = error.response.data;
        
        // Azure AD OAuth errors have error and error_description at root level
        if (typeof data.error === 'string' && data.error_description) {
          return `${data.error}: ${data.error_description}`;
        }
        
        // Graph API errors have nested error object
        const graphError = data as OneDriveError;
        if (graphError?.error?.code && graphError?.error?.message) {
          return `${graphError.error.code}: ${graphError.error.message}`;
        }
        
        // Fallback to showing full response
        return `HTTP ${error.response.status}: ${JSON.stringify(data)}`;
      }
      // If there's no response (network error)
      if (error.code) {
        return `Network error (${error.code}): ${error.message}`;
      }
      return error.message || 'Unknown axios error';
    }
    
    // Handle regular Error objects
    if (error instanceof Error) {
      return error.message;
    }
    
    // Handle objects with message property
    if (typeof error === 'object' && 'message' in error) {
      return String(error.message);
    }
    
    // Last resort - stringify the error
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
}
