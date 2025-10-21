export interface OneDriveConfig {
  clientId: string;
  clientSecret: string;
  tenantId: string;
  rootFolder: string;
  userId?: string; // For personal OneDrive
  siteId?: string; // For SharePoint
}

export interface OneDriveAuthToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  ext_expires_in: number;
}

export interface OneDriveUploadResult {
  id: string;
  name: string;
  webUrl: string;
  size: number;
  createdDateTime: string;
  '@microsoft.graph.downloadUrl'?: string;
}

export interface OneDriveFolderResult {
  id: string;
  name: string;
  webUrl: string;
  folder: {
    childCount: number;
  };
}

export interface OneDriveError {
  error: {
    code: string;
    message: string;
    innerError?: {
      code: string;
      date: string;
      'request-id': string;
    };
  };
}

export interface OneDriveUploadSession {
  uploadUrl: string;
  expirationDateTime: string;
  nextExpectedRanges: string[];
}

export interface DocumentMetadata {
  companyName: string;
  kvkNumber: string;
  documentId: string;
  signedAt: string;
  signerName?: string;
  signerEmail?: string;
  isExternal?: boolean;
  tenantId?: string;
  metadataSource?: string;
  applicationId?: string; // Application ID for folder lookup
  folderId?: string; // OneDrive folder ID for direct access
}
