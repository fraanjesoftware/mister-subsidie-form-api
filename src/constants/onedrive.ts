export const ONEDRIVE_CONFIG = {
  GRAPH_API_BASE_URL: 'https://graph.microsoft.com/v1.0',
  AUTH_URL: 'https://login.microsoftonline.com',
  SCOPES: ['https://graph.microsoft.com/.default'],
  
  // File upload settings
  MAX_FILE_SIZE: 4 * 1024 * 1024, // 4MB for simple upload
  CHUNK_SIZE: 320 * 1024, // 320KB chunks for large file upload
  
  // Retry settings
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000, // 1 second
  RETRY_MULTIPLIER: 2,
  
  // Folder structure
  FOLDER_PREFIX: 'SLIM Subsidies',
  
  // File naming
  DATE_FORMAT: 'yyyy-MM-MMMM', // 2025-01-January
  SANITIZE_REGEX: /[<>:"/\\|?*]/g, // Characters not allowed in file names
} as const;

export const ONEDRIVE_ERRORS = {
  ITEM_NOT_FOUND: 'itemNotFound',
  ITEM_ALREADY_EXISTS: 'nameAlreadyExists',
  INVALID_REQUEST: 'invalidRequest',
  UNAUTHENTICATED: 'unauthenticated',
  ACCESS_DENIED: 'accessDenied',
  QUOTA_EXCEEDED: 'quotaLimitReached',
} as const;