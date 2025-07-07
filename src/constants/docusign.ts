/**
 * DocuSign service constants (DRY principle)
 */
export const DOCUSIGN_CONSTANTS = {
  // JWT Configuration
  JWT_LIFETIME: 3600, // 1 hour in seconds
  SCOPES: ['signature', 'impersonation'] as string[],
  
  // Tab Configuration
  ANCHOR_UNITS: 'pixels',
  DEFAULT_ANCHOR_X_OFFSET: '0',
  DEFAULT_ANCHOR_Y_OFFSET: '0',
  
  // Email Templates
  DEFAULT_EMAIL_SUBJECT: 'Please sign your subsidy forms',
  DEFAULT_EMAIL_MESSAGE: 'Please review and sign the attached documents.',
  
  // API Configuration
  DEFAULT_BASE_URL: 'https://demo.docusign.net/restapi',
  
  // Document Configuration
  DEFAULT_FILE_EXTENSION: 'pdf',
  
  // Recipient Configuration
  DEFAULT_ROUTING_ORDER: 1,
  DEFAULT_AUTH_METHOD: 'none',
  
  // Signing Configuration
  DEFAULT_ENVELOPE_STATUS: 'sent',
  SIGNING_URL_EXPIRY: 300, // 5 minutes
  
  // Error Messages
  ERRORS: {
    MISSING_SIGNERS: 'Please provide at least one signer',
    INVALID_SIGNER: 'Please provide email, name, and roleName',
    MISSING_RETURN_URL: 'Please provide a returnUrl for embedded signing',
    MISSING_PRIVATE_KEY: 'DOCUSIGN_RSA_PRIVATE_KEY environment variable not set',
    PRIVATE_KEY_REQUIRED: 'Private key is required'
  }
} as const;