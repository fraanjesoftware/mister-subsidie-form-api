/**
 * DocuSign TypeScript type definitions
 */

// Base interface for common tab properties (DRY principle)
export interface BaseTab {
  anchorString?: string;
  anchorXOffset?: string;
  anchorYOffset?: string;
  documentId?: string;
  pageNumber?: string;
  xPosition?: string;
  yPosition?: string;
}

// Specific tab interfaces extend BaseTab
export interface SignatureTab extends BaseTab {}

export interface DateSignedTab extends BaseTab {}

export interface TextTab extends BaseTab {
  value?: string;
  locked?: boolean;
}

export interface Signer {
  email: string;
  name: string;
  routingOrder?: number;
  clientUserId?: string;
  signatureTabs?: SignatureTab[];
  dateSignedTabs?: DateSignedTab[];
  textTabs?: TextTab[];
}

export interface Document {
  name: string;
  base64: string;
}

export interface EnvelopeOptions {
  emailSubject?: string;
  emailMessage?: string;
  documents: Document[];
  signers: Signer[];
  customFields?: any;
  status?: string;
}

export interface DownloadedDocument {
  documentId: string;
  name: string;
  pdfBytes: any;
}

export interface EnvelopeDetails {
  envelope: any;
  customFields: any;
}

export interface DocuSignErrorDetails {
  status?: number;
  statusText?: string;
  message?: string;
  errorCode?: string;
  rawBody?: any;
  headers?: any;
}

// Tab configuration types for factory methods
export interface TabAnchorConfig {
  anchorString: string;
  anchorXOffset?: string;
  anchorYOffset?: string;
}

export interface TabPositionConfig {
  documentId: string;
  pageNumber: string;
  xPosition: string;
  yPosition: string;
}

// Template role configuration
export interface TemplateRole {
  email: string;
  name: string;
  roleName: string;
  clientUserId?: string;
  tabs?: any;
  embeddedRecipientStartURL?: string;
}

// Notification configuration
export interface NotificationConfig {
  useAccountDefaults?: boolean;
  reminders?: {
    reminderEnabled: string;
    reminderDelay: string;
    reminderFrequency: string;
  };
  expirations?: {
    expireEnabled: string;
    expireAfter: string;
    expireWarn: string;
  };
}

// Recipient view request configuration
export interface RecipientViewConfig {
  envelopeId: string;
  signerEmail: string;
  signerName: string;
  clientUserId: string;
  returnUrl: string;
  forEmbedding?: boolean;
}