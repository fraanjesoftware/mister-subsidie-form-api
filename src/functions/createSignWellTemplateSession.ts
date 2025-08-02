import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { SignWellService } from '../services/signwellService';
import { CreateDocumentRequest } from '../types/signwell';
import { mapRecipientTabsToTemplateFields, RecipientTabs } from '../utils/signwellFieldMapper';

interface FrontendSigner {
  email: string;
  name: string;
  roleName: 'Applicant' | 'SecondSigner';
  tabs: RecipientTabs;
}

interface CreateTemplateSigningSessionRequest {
  signers: FrontendSigner[];
  returnUrl: string;
  sendEmails?: boolean; // Optional: control email notifications
  testMode?: boolean; // Optional: override test mode
}

export async function createSignWellTemplateSession(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('CreateSignWellTemplateSession function started');

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
    const body = await request.json() as CreateTemplateSigningSessionRequest;
    
    // Validate request
    if (!body.signers || body.signers.length === 0) {
      return {
        status: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          error: 'At least one signer is required',
          validationErrors: ['signers array is empty']
        }),
      };
    }

    // Get the primary signer (Applicant)
    const primarySigner = body.signers.find(s => s.roleName === 'Applicant') || body.signers[0];
    
    // Map frontend tabs to SignWell template fields
    const templateFields = mapRecipientTabsToTemplateFields(primarySigner.tabs);
    context.log(`Mapped ${templateFields.length} template fields for ${primarySigner.name}`);

    // Generate document name from company name
    const companyNameTab = primarySigner.tabs.textTabs?.find(tab => tab.tabLabel === 'bedrijfsnaam');
    const documentName = companyNameTab 
      ? `SLIM Subsidie Aanvraag - ${companyNameTab.value}`
      : 'SLIM Subsidie Aanvraag';

    // Initialize SignWell service
    const signwellService = new SignWellService();

    // Prepare the SignWell request
    const documentRequest: CreateDocumentRequest = {
      name: documentName,
      subject: 'SLIM Subsidie - Ondertekeningsverzoek',
      message: 'Beste aanvrager,<br><br>Hierbij ontvangt u de subsidieaanvraag ter ondertekening. Controleer alle gegevens zorgvuldig voordat u ondertekent.<br><br>Met vriendelijke groet,<br>Team SLIM Subsidie',
      recipients: [{
        id: 'recipient_1',
        name: primarySigner.name,
        email: primarySigner.email,
        placeholder_name: 'signer',
        order: 1,
      }],
      template_fields: templateFields,
      // Add checkbox groups for radio button behavior
      checkbox_groups: [
        {
          group_name: "de-minimis-group",
          recipient_id: "recipient_1",
          checkbox_ids: ["geen", "wel", "andere"],
          validation: "exact",
          exact_value: 1,
          required: true
        },
        {
          group_name: "company-size-group",
          recipient_id: "recipient_1", 
          checkbox_ids: ["kleine", "middel", "grote"],
          validation: "exact",
          exact_value: 1,
          required: true
        }
      ],
      embedded_signing: true,
      embedded_signing_clear_background: true,
      redirect_uri: body.returnUrl,
      metadata: {
        company_name: companyNameTab?.value || '',
        kvk_number: primarySigner.tabs.textTabs?.find(t => t.tabLabel === 'kvk')?.value || '',
        submission_date: new Date().toISOString(),
        source: 'mister-subsidie-frontend'
      },
      test_mode: body.testMode ?? (process.env.SIGNWELL_TEST_MODE === 'true'),
      draft: false,
      send_email: true, // Always send emails unless explicitly disabled
      embedded_signing_notifications: true, // Also enable embedded signing notifications
    };

    // Use the template ID from environment variable
    const templateId = process.env.SIGNWELL_TEMPLATE_ID;
    
    if (!templateId) {
      return {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          error: 'SignWell template not configured',
          message: 'Please contact support - template configuration is missing'
        }),
      };
    }

    // Create document from template
    context.log('Creating document from template:', templateId);
    const document = await signwellService.createDocumentFromTemplate(templateId, documentRequest);
    context.log('Document created successfully:', document.id);

    // Get the signing URL for the primary signer
    const signingUrl = signwellService.getEmbeddedSigningUrl(document, 'recipient_1');
    
    if (!signingUrl) {
      throw new Error('Failed to get signing URL from SignWell response');
    }

    // Return the expected response format
    return {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        signingUrl,
        documentId: document.id,
        status: 'created'
      }),
    };

  } catch (error) {
    context.error('Error creating SignWell signing session:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    let statusCode = 500;
    
    // Determine appropriate status code
    if (errorMessage.includes('API key')) {
      statusCode = 401;
    } else if (errorMessage.includes('422') || errorMessage.includes('validation')) {
      statusCode = 422;
    } else if (errorMessage.includes('404')) {
      statusCode = 404;
    }

    return {
      status: statusCode,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        error: errorMessage,
        message: 'Failed to create signing session. Please try again.',
        validationErrors: statusCode === 422 ? [errorMessage] : undefined,
      }),
    };
  }
}

app.http('createSignWellTemplateSession', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: createSignWellTemplateSession,
});