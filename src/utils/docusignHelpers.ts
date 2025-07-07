import * as crypto from 'crypto';
import { DOCUSIGN_CONSTANTS } from '../constants/docusign';

/**
 * Format RSA private key for DocuSign (handles various formats)
 */
export function formatRSAPrivateKey(privateKey: string): string {
  if (!privateKey) {
    throw new Error(DOCUSIGN_CONSTANTS.ERRORS.PRIVATE_KEY_REQUIRED);
  }

  // Handle Azure environment variables where \n is stored as literal string
  if (privateKey.includes('\\n')) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }
  
  // If still a single line, format it properly
  if (privateKey.includes('BEGIN') && privateKey.split('\n').length < 3) {
    // Extract the base64 content between the markers
    const match = privateKey.match(/-----BEGIN RSA PRIVATE KEY-----\s*(.+?)\s*-----END RSA PRIVATE KEY-----/);
    if (match && match[1]) {
      const base64Content = match[1].trim();
      // Split into 64-character lines as required by PEM format
      const lines = base64Content.match(/.{1,64}/g) || [];
      privateKey = `-----BEGIN RSA PRIVATE KEY-----\n${lines.join('\n')}\n-----END RSA PRIVATE KEY-----`;
    }
  }

  return privateKey;
}

/**
 * Validate webhook notification
 */
export function validateWebhookSignature(payload: string, signature: string, secret: string): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const computedSignature = hmac.digest('base64');
  return computedSignature === signature;
}

/**
 * Log envelope details for debugging
 */
export function logEnvelopeDetails(
  accountId: string | null,
  emailSubject: string,
  documents: any[],
  signers: any[]
): void {
  console.log('=== Sending to DocuSign ===');
  console.log('Account ID:', accountId);
  console.log('Email Subject:', emailSubject);
  console.log('Number of Documents:', documents.length);
  console.log('Documents:', documents.map((d: any) => ({
    name: d.name,
    documentId: d.documentId,
    fileExtension: d.fileExtension,
    base64Length: d.documentBase64?.length || 0
  })));
  console.log('Number of Signers:', signers.length);
  console.log('Signers:', signers.map((s: any) => ({
    email: s.email,
    name: s.name,
    recipientId: s.recipientId,
    clientUserId: s.clientUserId,
    tabs: {
      signHereTabs: s.tabs?.signHereTabs?.length || 0,
      dateSignedTabs: s.tabs?.dateSignedTabs?.length || 0,
      textTabs: s.tabs?.textTabs?.length || 0
    }
  })));
  console.log('==========================');
}

/**
 * Get allowed origins for iframe embedding
 */
export function getAllowedOrigins(): string[] {
  return process.env.DOCUSIGN_ALLOWED_ORIGINS?.split(',').map(origin => origin.trim()) || [
    'http://localhost:5173',
    'https://purple-dune-0613f4303.1.azurestaticapps.net'
  ];
}

/**
 * Get primary origin for message origins
 */
export function getPrimaryOrigin(): string {
  // Determine the primary origin based on environment
  const primaryOrigin = process.env.NODE_ENV === 'production' 
    ? 'https://purple-dune-0613f4303.1.azurestaticapps.net'
    : 'http://localhost:5173';
  
  // If a specific primary origin is set in environment variables, use that
  return process.env.DOCUSIGN_PRIMARY_ORIGIN || primaryOrigin;
}