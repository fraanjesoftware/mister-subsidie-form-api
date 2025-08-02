import { SignWellError } from '../types/signwell';

export function isSignWellError(error: unknown): error is { response: { data: SignWellError } } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof (error as any).response === 'object' &&
    'data' in (error as any).response &&
    'error' in (error as any).response.data
  );
}

export function formatSignWellError(error: unknown): string {
  if (isSignWellError(error)) {
    const signwellError = error.response.data.error;
    let message = signwellError.message;
    
    if (signwellError.errors) {
      const errorDetails = Object.entries(signwellError.errors)
        .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
        .join('; ');
      message += ` (${errorDetails})`;
    }
    
    return message;
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  return 'Unknown SignWell error';
}

export function generateRecipientId(): string {
  return `recipient_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function buildSignWellHeaders(apiKey: string): Record<string, string> {
  return {
    'X-Api-Key': apiKey,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
}

export function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '');
}

export function getSignWellEnvironment(): 'production' | 'test' {
  const env = process.env.SIGNWELL_ENVIRONMENT || process.env.NODE_ENV;
  return env === 'production' ? 'production' : 'test';
}

export function shouldUseTestMode(): boolean {
  return getSignWellEnvironment() === 'test' || process.env.SIGNWELL_TEST_MODE === 'true';
}