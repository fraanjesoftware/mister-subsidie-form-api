/**
 * Application-related type definitions for the OneDrive file system
 */

/**
 * Company information from the frontend (Step 0 payload)
 * Matches the frontend CompanyInfo interface exactly
 */
export interface CompanyInfo {
  // Application metadata
  applicationId: string;
  tenantId: string;
  datum: string;

  // OneDrive folder ID (optional - present when updating)
  folderId?: string;

  // Bedrijfsinformatie
  bedrijfsnaam: string;
  kvkNummer: string;
  btwId: string;
  website: string;
  adres: string;
  postcode: string;
  plaats: string;
  provincie: string;
  naceClassificatie: string;

  // Contactpersoon
  contactNaam: string;
  contactTelefoon: string;
  contactEmail: string;
  contactGeslacht: 'man' | 'vrouw' | 'anders';
  hoofdcontactPersoon: 'Wout' | 'Tim' | 'Nathalie';
}

/**
 * Metadata for creating/managing application folders in OneDrive
 */
export interface ApplicationFolderMetadata {
  applicationId: string;
  tenantId: string;
  companyName: string;
  createdDate: string; // ISO format
}

/**
 * Response from submitCompanyInfo endpoint
 */
export interface SubmitCompanyInfoResponse {
  success: boolean;
  folderId: string;
  message?: string;
}

/**
 * Response from uploadBankStatement endpoint
 */
export interface UploadBankStatementResponse {
  success: boolean;
  message?: string;
}
