import { DocuSignErrorDetails } from '../types/docusign';

/**
 * Custom error class for DocuSign API errors
 */
export class DocuSignError extends Error {
  details?: DocuSignErrorDetails;
  
  constructor(message: string, details?: DocuSignErrorDetails) {
    super(message);
    this.name = 'DocuSignError';
    this.details = details;
  }
}

/**
 * Handle DocuSign API errors consistently (DRY principle)
 */
export function handleDocuSignError(error: any, context: string): DocuSignError {
  // Extract detailed error information
  const errorDetails: DocuSignErrorDetails = {
    status: error.response?.status || error.status,
    statusText: error.response?.statusText,
    message: error.response?.body?.message || error.response?.text || error.message,
    errorCode: error.response?.body?.errorCode,
    rawBody: error.response?.text || error.response?.body,
    headers: error.response?.headers
  };
  
  console.error(`=== DocuSign API Error (${context}) ===`);
  console.error('Status:', errorDetails.status);
  console.error('Status Text:', errorDetails.statusText);
  console.error('Error Message:', errorDetails.message);
  console.error('Error Code:', errorDetails.errorCode);
  console.error('Raw Body:', errorDetails.rawBody);
  if (errorDetails.headers) {
    console.error('Response Headers:', JSON.stringify(errorDetails.headers, null, 2));
  }
  
  // Try to parse the error if it's a string
  if (typeof errorDetails.rawBody === 'string') {
    try {
      const parsed = JSON.parse(errorDetails.rawBody);
      console.error('Parsed Error:', JSON.stringify(parsed, null, 2));
    } catch (e) {
      console.error('Could not parse error body as JSON');
    }
  }
  console.error('=====================================');
  
  return new DocuSignError(errorDetails.message || `DocuSign API Error in ${context}`, errorDetails);
}