export interface SignWellConfig {
  apiKey: string;
  baseUrl: string;
  testMode: boolean;
}

export interface SignWellRecipient {
  id: string;
  name: string;
  email: string;
  placeholder_name?: string;
  order?: number;
}

export interface SignWellField {
  api_id: string;
  name?: string;
  type?: 'text' | 'signature' | 'date' | 'checkbox' | 'initial' | 'dropdown';
  x?: number;
  y?: number;
  page?: number;
  width?: number;
  height?: number;
  required?: boolean;
  value?: string | boolean;
  placeholder?: string;
  recipient_id?: string;
}

export interface CreateDocumentRequest {
  test_mode?: boolean;
  name: string;
  subject?: string;
  message?: string;
  recipients: SignWellRecipient[];
  fields?: SignWellField[];
  file_url?: string;
  file?: Buffer;
  template_id?: string;
  embedded_signing?: boolean;
  embedded_signing_clear_background?: boolean;
  redirect_uri?: string;
  custom_requester_name?: string;
  custom_requester_email?: string;
  metadata?: Record<string, any>;
  draft?: boolean;
  send_email?: boolean;
}

export interface SignWellDocument {
  id: string;
  name: string;
  status: 'draft' | 'sent' | 'completed' | 'cancelled';
  created_at: string;
  completed_at?: string;
  recipients: SignWellDocumentRecipient[];
  embedded_signing_url?: string;
  files?: SignWellFile[];
}

export interface SignWellDocumentRecipient {
  id: string;
  name: string;
  email: string;
  status: 'pending' | 'sent' | 'viewed' | 'signed' | 'declined';
  embedded_signing_url?: string;
  viewed_at?: string;
  signed_at?: string;
}

export interface SignWellFile {
  id: string;
  name: string;
  url: string;
}

export interface SignWellWebhookEvent {
  event: {
    hash: string;
    time: number;
    type: 'document_signed' | 'document_completed' | 'document_sent' | 'recipient_completed' | 'recipient_viewed';
    related_signer?: {
      email: string;
      name: string;
    };
  };
  data: {
    object: SignWellDocument & {
      archived: boolean;
      template_id: string;
      files: Array<{
        name: string;
        pages_number: number;
      }>;
      fields: any[];
      metadata: Record<string, any>;
    };
    account_id: string;
    workspace_id: string;
  };
}

export interface SignWellError {
  error: {
    type: string;
    message: string;
    errors?: Record<string, string[]>;
  };
}