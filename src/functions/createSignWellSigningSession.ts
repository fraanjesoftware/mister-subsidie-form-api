import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { SignWellService } from '../services/signwellService';
import { CreateDocumentRequest } from '../types/signwell';

interface CreateSignWellSigningSessionRequest {
  templateId?: string;
  name: string;
  subject?: string;
  message?: string;
  recipients: Array<{
    name: string;
    email: string;
    placeholder_name?: string;
    order?: number;
  }>;
  embeddedSigning?: boolean;
  redirectUri?: string;
  metadata?: Record<string, any>;
  testMode?: boolean;
}

export async function createSignWellSigningSession(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('CreateSignWellSigningSession function started');

  try {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        },
      };
    }

    // Parse request body
    const body = await request.json() as CreateSignWellSigningSessionRequest;
    
    if (!body.name) {
      return {
        status: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        },
        body: JSON.stringify({ error: 'Document name is required' }),
      };
    }

    if (!body.recipients || body.recipients.length === 0) {
      return {
        status: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        },
        body: JSON.stringify({ error: 'At least one recipient is required' }),
      };
    }

    // Initialize SignWell service
    const signwellService = new SignWellService();

    // Prepare the request
    const documentRequest: CreateDocumentRequest = {
      name: body.name,
      subject: body.subject,
      message: body.message,
      recipients: body.recipients.map((recipient, index) => ({
        id: `recipient_${index + 1}`,
        name: recipient.name,
        email: recipient.email,
        placeholder_name: recipient.placeholder_name,
        order: recipient.order || index + 1,
      })),
      embedded_signing: body.embeddedSigning ?? true,
      redirect_uri: body.redirectUri,
      metadata: body.metadata,
      test_mode: body.testMode,
    };

    let document;

    // Create document from template or from scratch
    if (body.templateId) {
      context.log('Creating document from template:', body.templateId);
      document = await signwellService.createDocumentFromTemplate(
        body.templateId,
        documentRequest
      );
    } else {
      context.log('Creating new document');
      // For now, we'll require a template ID
      // In a full implementation, you'd handle file uploads here
      return {
        status: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        },
        body: JSON.stringify({ 
          error: 'Template ID is required. Direct document creation with file upload is not yet implemented.' 
        }),
      };
    }

    context.log('Document created successfully:', document.id);

    // Get embedded signing URLs for all recipients
    const signingUrls = document.recipients.map(recipient => ({
      recipientId: recipient.id,
      name: recipient.name,
      email: recipient.email,
      signingUrl: recipient.embedded_signing_url,
      status: recipient.status,
    }));

    return {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        documentId: document.id,
        documentName: document.name,
        status: document.status,
        signingUrls,
        metadata: body.metadata,
      }),
    };
  } catch (error: any) {
    context.error('Error creating SignWell signing session:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    let statusCode = 500;
    
    if (errorMessage.includes('API key')) {
      statusCode = 401;
    } else if (errorMessage.includes('422')) {
      statusCode = 422;
    }

    return {
      status: statusCode,
      headers: {
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error : undefined,
      }),
    };
  }
}

app.http('createSignWellSigningSession', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: createSignWellSigningSession,
});