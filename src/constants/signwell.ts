export const SIGNWELL_CONFIG = {
  API_BASE_URL: 'https://www.signwell.com/api/v1',
  RATE_LIMIT: {
    STANDARD: 100, // requests per 60 seconds
    TEST_MODE: 20, // requests per minute
    DOCUMENT_CREATION: 30, // requests per minute
  },
  TIMEOUTS: {
    DEFAULT: 30000, // 30 seconds
    UPLOAD: 120000, // 2 minutes for file uploads
  },
  ERRORS: {
    UNAUTHORIZED: 'SIGNWELL_UNAUTHORIZED',
    RATE_LIMIT_EXCEEDED: 'SIGNWELL_RATE_LIMIT_EXCEEDED',
    INVALID_REQUEST: 'SIGNWELL_INVALID_REQUEST',
    DOCUMENT_NOT_FOUND: 'SIGNWELL_DOCUMENT_NOT_FOUND',
    SERVER_ERROR: 'SIGNWELL_SERVER_ERROR',
  },
  DOCUMENT_STATUS: {
    DRAFT: 'draft',
    SENT: 'sent',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
  },
  RECIPIENT_STATUS: {
    PENDING: 'pending',
    SENT: 'sent',
    VIEWED: 'viewed',
    SIGNED: 'signed',
    DECLINED: 'declined',
  },
  WEBHOOK_EVENTS: {
    DOCUMENT_COMPLETED: 'document_completed',
    DOCUMENT_SENT: 'document_sent',
    RECIPIENT_COMPLETED: 'recipient_completed',
    RECIPIENT_VIEWED: 'recipient_viewed',
  },
  FIELD_TYPES: {
    TEXT: 'text',
    SIGNATURE: 'signature',
    DATE: 'date',
    CHECKBOX: 'checkbox',
    INITIAL: 'initial',
  },
} as const;

export const SIGNWELL_ENVIRONMENTS = {
  PRODUCTION: {
    name: 'production',
    apiUrl: 'https://www.signwell.com/api/v1',
  },
  TEST: {
    name: 'test',
    apiUrl: 'https://www.signwell.com/api/v1', // Same URL, but test_mode flag is used
  },
} as const;