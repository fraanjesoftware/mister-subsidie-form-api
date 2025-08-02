import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { SignWellService } from '../services/signwellService';
import { CreateDocumentRequest } from '../types/signwell';
import { mapRecipientTabsToTemplateFields, RecipientTabs } from '../utils/signwellFieldMapper';

interface Signer {
  email: string;
  name: string;
  roleName: 'Applicant' | 'SecondSigner';
  tabs?: RecipientTabs;
}

interface CreateSignWellSigningSessionRequest {
  templateId?: string;
  signers?: Signer[]; // Support old frontend format
  returnUrl?: string; // Support old frontend format
  // Also support new format
  name?: string;
  subject?: string;
  message?: string;
  recipients?: Array<{
    id?: string;
    name: string;
    email: string;
    placeholder_name?: string;
    order?: number;
  }>;
  embeddedSigning?: boolean;
  embeddedSigningNotifications?: boolean;
  redirectUri?: string;
  metadata?: Record<string, any>;
  testMode?: boolean;
  draft?: boolean;
  send_email?: boolean;
  checkbox_groups?: Array<{
    group_name: string;
    recipient_id: string;
    checkbox_ids: string[];
    validation?: 'minimum' | 'maximum' | 'exact' | 'range';
    required?: boolean;
    min_value?: number;
    max_value?: number;
    exact_value?: number;
  }>;
  checkboxGroups?: Array<{
    group_name: string;
    recipient_id: string;
    checkbox_ids: string[];
    validation?: 'minimum' | 'maximum' | 'exact' | 'range';
    required?: boolean;
    min_value?: number;
    max_value?: number;
    exact_value?: number;
  }>;
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
    
    // Support both old frontend format (signers) and new format (recipients)
    let recipients = body.recipients;
    let templateFields: Array<{ api_id: string; value: string | boolean }> = [];
    let documentName = body.name;
    let returnUrl = body.redirectUri || body.returnUrl;
    
    // Handle old frontend format with signers and tabs
    if (body.signers && body.signers.length > 0) {
      context.log('Processing signers format with tabs');
      
      // Map signers to recipients and extract template fields
      recipients = body.signers.map((signer, index) => {
        const recipientId = `recipient_${index + 1}`;
        
        // Map tabs to template fields if present
        if (signer.tabs) {
          const signerFields = mapRecipientTabsToTemplateFields(signer.tabs);
          templateFields.push(...signerFields);
          context.log(`Mapped ${signerFields.length} template fields for ${signer.name}`);
        }
        
        return {
          id: recipientId,
          name: signer.name,
          email: signer.email,
          placeholder_name: 'signer', // Map to your template's placeholder
          order: index + 1,
        };
      });
      
      // Generate document name from company name if available
      const companyNameTab = body.signers[0]?.tabs?.textTabs?.find(tab => tab.tabLabel === 'bedrijfsnaam');
      documentName = companyNameTab 
        ? `SLIM Subsidie Aanvraag - ${companyNameTab.value}`
        : 'SLIM Subsidie Aanvraag';
    }
    
    if (!documentName) {
      documentName = 'SignWell Document';
    }

    if (!recipients || recipients.length === 0) {
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
      name: documentName,
      subject: body.subject || 'Please sign this document',
      message: body.message || 'This document requires your signature',
      recipients: recipients.map((recipient, index) => ({
        id: recipient.id || `recipient_${index + 1}`,
        name: recipient.name,
        email: recipient.email,
        placeholder_name: recipient.placeholder_name,
        order: recipient.order || index + 1,
      })),
      template_fields: templateFields.length > 0 ? templateFields : undefined,
      checkbox_groups: body.checkbox_groups || body.checkboxGroups,
      embedded_signing: body.embeddedSigning ?? true,
      redirect_uri: returnUrl,
      metadata: body.metadata || {},
      test_mode: body.testMode ?? true,
      draft: body.draft ?? false,
      send_email: body.send_email ?? body.embeddedSigningNotifications,
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

    // Support both response formats
    if (body.signers) {
      // Old frontend format expects a single signingUrl
      const firstSigningUrl = signingUrls[0]?.signingUrl;
      return {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          signingUrl: firstSigningUrl,
          documentId: document.id,
          status: 'created',
        }),
      };
    } else {
      // New format with all signing URLs
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
    }
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