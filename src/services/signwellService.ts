import axios, { AxiosInstance } from 'axios';
import FormData from 'form-data';
import { SIGNWELL_CONFIG } from '../constants/signwell';
import {
  SignWellConfig,
  CreateDocumentRequest,
  SignWellDocument,
} from '../types/signwell';
import {
  buildSignWellHeaders,
  formatSignWellError,
  generateRecipientId,
  shouldUseTestMode,
  validateEmail,
} from '../utils/signwellHelpers';

export class SignWellService {
  private apiKey: string;
  private baseUrl: string;
  private testMode: boolean;
  private axiosInstance: AxiosInstance;

  constructor(config?: Partial<SignWellConfig>) {
    this.apiKey = config?.apiKey || process.env.SIGNWELL_API_KEY || '';
    this.baseUrl = config?.baseUrl || SIGNWELL_CONFIG.API_BASE_URL;
    this.testMode = config?.testMode ?? shouldUseTestMode();

    if (!this.apiKey) {
      throw new Error('SignWell API key is required');
    }

    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      timeout: SIGNWELL_CONFIG.TIMEOUTS.DEFAULT,
      headers: buildSignWellHeaders(this.apiKey),
    });
  }

  async createDocument(request: CreateDocumentRequest): Promise<SignWellDocument> {
    try {
      // Validate recipients
      for (const recipient of request.recipients) {
        if (!validateEmail(recipient.email)) {
          throw new Error(`Invalid email address: ${recipient.email}`);
        }
        if (!recipient.id) {
          recipient.id = generateRecipientId();
        }
      }

      const payload = {
        ...request,
        test_mode: request.test_mode ?? this.testMode,
      };

      const response = await this.axiosInstance.post<SignWellDocument>(
        '/documents',
        payload
      );

      return response.data;
    } catch (error) {
      const errorMessage = formatSignWellError(error);
      throw new Error(`Failed to create SignWell document: ${errorMessage}`);
    }
  }

  async createDocumentFromTemplate(
    templateId: string,
    request: Omit<CreateDocumentRequest, 'template_id'>
  ): Promise<SignWellDocument> {
    try {
      const payload = {
        ...request,
        template_id: templateId,
        test_mode: request.test_mode ?? this.testMode,
      };

      // Ensure all recipients have IDs
      if (payload.recipients) {
        payload.recipients = payload.recipients.map(recipient => ({
          ...recipient,
          id: recipient.id || generateRecipientId(),
        }));
      }

      // Log the request for debugging
      console.log('SignWell API Request:', JSON.stringify(payload, null, 2));

      const response = await this.axiosInstance.post<SignWellDocument>(
        '/document_templates/documents/',
        payload
      );

      return response.data;
    } catch (error: any) {
      const errorMessage = formatSignWellError(error);
      
      // Log detailed error for debugging
      console.error('SignWell API Error:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        headers: error.response?.headers
      });
      
      throw new Error(`Failed to create SignWell document from template: ${errorMessage}`);
    }
  }

  async createDocumentWithFile(
    file: Buffer,
    fileName: string,
    request: Omit<CreateDocumentRequest, 'file' | 'file_url'>
  ): Promise<SignWellDocument> {
    try {
      const formData = new FormData();
      
      // Add file
      formData.append('file', file, {
        filename: fileName,
        contentType: 'application/pdf',
      });

      // Add other fields
      formData.append('name', request.name);
      if (request.subject) formData.append('subject', request.subject);
      if (request.message) formData.append('message', request.message);
      formData.append('test_mode', String(request.test_mode ?? this.testMode));
      
      // Add recipients as JSON
      const recipients = request.recipients.map(recipient => ({
        ...recipient,
        id: recipient.id || generateRecipientId(),
      }));
      formData.append('recipients', JSON.stringify(recipients));

      // Add fields if present
      if (request.fields) {
        formData.append('fields', JSON.stringify(request.fields));
      }

      // Add embedded signing options
      if (request.embedded_signing !== undefined) {
        formData.append('embedded_signing', String(request.embedded_signing));
      }
      if (request.embedded_signing_clear_background !== undefined) {
        formData.append('embedded_signing_clear_background', String(request.embedded_signing_clear_background));
      }
      if (request.redirect_uri) {
        formData.append('redirect_uri', request.redirect_uri);
      }

      // Add metadata if present
      if (request.metadata) {
        formData.append('metadata', JSON.stringify(request.metadata));
      }

      const response = await this.axiosInstance.post<SignWellDocument>(
        '/documents',
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            'X-Api-Key': this.apiKey,
          },
          timeout: SIGNWELL_CONFIG.TIMEOUTS.UPLOAD,
        }
      );

      return response.data;
    } catch (error) {
      const errorMessage = formatSignWellError(error);
      throw new Error(`Failed to create SignWell document with file: ${errorMessage}`);
    }
  }

  async getDocument(documentId: string): Promise<SignWellDocument> {
    try {
      const response = await this.axiosInstance.get<SignWellDocument>(
        `/documents/${documentId}`
      );
      return response.data;
    } catch (error) {
      const errorMessage = formatSignWellError(error);
      throw new Error(`Failed to get SignWell document: ${errorMessage}`);
    }
  }

  async getCompletedPdf(documentId: string): Promise<Buffer> {
    try {
      const response = await this.axiosInstance.get(
        `/documents/${documentId}/completed_pdf`,
        {
          responseType: 'arraybuffer',
        }
      );
      return Buffer.from(response.data);
    } catch (error) {
      const errorMessage = formatSignWellError(error);
      throw new Error(`Failed to get completed PDF: ${errorMessage}`);
    }
  }

  async deleteDocument(documentId: string): Promise<void> {
    try {
      await this.axiosInstance.delete(`/documents/${documentId}`);
    } catch (error) {
      const errorMessage = formatSignWellError(error);
      throw new Error(`Failed to delete SignWell document: ${errorMessage}`);
    }
  }

  async sendReminder(documentId: string): Promise<void> {
    try {
      await this.axiosInstance.post(`/documents/${documentId}/remind`);
    } catch (error) {
      const errorMessage = formatSignWellError(error);
      throw new Error(`Failed to send reminder: ${errorMessage}`);
    }
  }

  getEmbeddedSigningUrl(document: SignWellDocument, recipientId?: string): string | undefined {
    if (!recipientId) {
      // Return the first recipient's URL if no specific recipient is requested
      const firstRecipient = document.recipients.find(r => r.embedded_signing_url);
      return firstRecipient?.embedded_signing_url;
    }

    const recipient = document.recipients.find(r => r.id === recipientId);
    return recipient?.embedded_signing_url;
  }
}