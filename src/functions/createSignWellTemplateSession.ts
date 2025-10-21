import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { SignWellService } from '../services/signwellService';
import { CreateDocumentRequest } from '../types/signwell';
import { mapRecipientTabsToTemplateFields, mapRecipientTabsToTemplateFieldsWithRecipient, RecipientTabs } from '../utils/signwellFieldMapper';
import { computeMetadataSource, getTenantConfig } from '../utils/tenantConfig';
import { shouldUseTestMode } from '../utils/signwellHelpers';

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
  test?: boolean; // Optional: frontend toggle for SignWell test mode
  tenantId?: string; // Optional: tenant identifier for multi-tenant setup
  applicationId?: string; // Optional: application identifier for folder linking
  folderId?: string | null; // Optional: OneDrive folder identifier for reuse
}

/**
 * Creates a SignWell signing session from a template.
 * Supports both single-signer and two-signer templates.
 * 
 * Two-signer template is used when:
 * - Second signer fields are provided (voorletters-tekenbevoegde-2, achternaam-tekenbevoegde-2, functie-tekenbevoegde-2)
 * - OR a second signer object is explicitly provided
 */
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

    const tenant = getTenantConfig(body.tenantId);
    const authorizedRepresentative = tenant.config.authorizedRepresentative;
    const tenantSignWellConfig = tenant.config.signwell || {};
    const metadataSource = computeMetadataSource(tenant.tenantId, tenant.config);
    
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
    
    // Check if we have a second signer
    const secondSigner = body.signers.find(s => s.roleName === 'SecondSigner');
    
    // Check if second signer fields are provided and ALL have non-empty values
    const secondSignerFieldValues = {
      voorletters: primarySigner.tabs.textTabs?.find(t => t.tabLabel === 'voorletters-tekenbevoegde-2')?.value || '',
      achternaam: primarySigner.tabs.textTabs?.find(t => t.tabLabel === 'achternaam-tekenbevoegde-2')?.value || '',
      functie: primarySigner.tabs.textTabs?.find(t => t.tabLabel === 'functie-tekenbevoegde-2')?.value || ''
    };
    
    const hasSecondSignerFields = 
      secondSignerFieldValues.voorletters.trim() !== '' &&
      secondSignerFieldValues.achternaam.trim() !== '' &&
      secondSignerFieldValues.functie.trim() !== '';
    
    context.log('Second signer check:', {
      hasSecondSignerFields,
      secondSigner: !!secondSigner,
      fieldValues: secondSignerFieldValues
    });
    
    // Map frontend tabs to SignWell template fields
    let templateFields: any[];
    
    if (hasSecondSignerFields || secondSigner) {
      // For multi-signer template, map fields with recipient IDs
      const primaryFields = mapRecipientTabsToTemplateFieldsWithRecipient(primarySigner.tabs, 'recipient_1', false);
      const secondaryFields = mapRecipientTabsToTemplateFieldsWithRecipient(primarySigner.tabs, 'recipient_2', true);
      templateFields = [...primaryFields, ...secondaryFields];
      context.log(`Mapped ${primaryFields.length} fields for primary signer and ${secondaryFields.length} fields for second signer`);
    } else {
      // For single-signer template, use the original mapping but exclude second signer fields
      templateFields = mapRecipientTabsToTemplateFields(primarySigner.tabs, true);
      context.log(`Mapped ${templateFields.length} template fields for ${primarySigner.name} (excluding second signer fields)`);
    }

    // Add default fields from environment variables
    const defaultFields = [
      {
        api_id: 'gemachtigde',
        value: authorizedRepresentative.gemachtigde
      },
      {
        api_id: 'gemachtigde_email',
        value: authorizedRepresentative.gemachtigde_email
      },
      {
        api_id: 'gemachtigde_naam',
        value: authorizedRepresentative.gemachtigde_naam
      },
      {
        api_id: 'gemachtigde_telefoon',
        value: authorizedRepresentative.gemachtigde_telefoon
      },
      {
        api_id: 'gemachtigde_kvk',
        value: authorizedRepresentative.gemachtigde_kvk
      }
    ];

    // Add default fields to template fields
    templateFields = [...templateFields, ...defaultFields];
    context.log(`Added ${defaultFields.length} default fields from tenant configuration`, {
      tenantId: tenant.tenantId
    });

    // Generate document name from company name
    const companyNameTab = primarySigner.tabs.textTabs?.find(tab => tab.tabLabel === 'bedrijfsnaam');
    const isIgniteTenant = tenant.tenantId === 'ignite';
    const baseDocumentTitle = isIgniteTenant
      ? 'SLIM Subsidie Aanvraag Ignite'
      : 'SLIM Subsidie Aanvraag';
    const documentName = companyNameTab
      ? `${baseDocumentTitle} - ${companyNameTab.value}`
      : baseDocumentTitle;

    // Initialize SignWell service
    const requestedTestMode = body.test ?? body.testMode;
    const defaultTestMode = shouldUseTestMode();
    const useTestMode = typeof requestedTestMode === 'boolean'
      ? requestedTestMode
      : defaultTestMode;

    const signwellService = new SignWellService({ testMode: useTestMode });

    // Build recipients array
    const recipients = [{
      id: 'recipient_1',
      name: primarySigner.name,
      email: primarySigner.email,
      placeholder_name: 'signer',
      order: 1,
    }];

    // Add second signer if we have second signer fields or an explicit second signer
    if (hasSecondSignerFields || secondSigner) {
      // Get second signer details from fields or from explicit second signer
      const secondSignerName = secondSigner?.name || 
        `${secondSignerFieldValues.voorletters} ${secondSignerFieldValues.achternaam}`.trim();
      
      const secondSignerEmail = secondSigner?.email || primarySigner.email; // Use primary signer's email if not provided
      
      recipients.push({
        id: 'recipient_2',
        name: secondSignerName,
        email: secondSignerEmail,
        placeholder_name: 'signer2',
        order: 2,
      });
      
      context.log('Adding second signer:', { name: secondSignerName, email: secondSignerEmail });
    }

    // Prepare the SignWell request
    const metadata: Record<string, any> = {
      company_name: companyNameTab?.value || '',
      kvk_number: primarySigner.tabs.textTabs?.find(t => t.tabLabel === 'kvk')?.value || '',
      submission_date: new Date().toISOString(),
      source: metadataSource,
      tenant_id: tenant.tenantId
    };

    if (body.applicationId) {
      metadata.application_id = body.applicationId;
    }

    if (body.folderId) {
      metadata.folder_id = body.folderId;
    }

    const documentRequest: CreateDocumentRequest = {
      name: documentName,
      subject: 'SLIM Subsidie - Ondertekeningsverzoek',
      message: 'Beste aanvrager,<br><br>Hierbij ontvangt u de subsidieaanvraag ter ondertekening. Controleer alle gegevens zorgvuldig voordat u ondertekent.<br><br>Met vriendelijke groet,<br>Team Mister Subsidie',
      recipients,
      template_fields: templateFields,      
      embedded_signing: false,
      redirect_uri: body.returnUrl,
      metadata,
      test_mode: useTestMode,
      draft: false,
      send_email: true, // Always send emails unless explicitly disabled
    };

    const resolveTemplateId = (tenantValue?: string, envValue?: string, fallbackValue?: string) => {
      if (tenantValue) {
        return { id: tenantValue, source: 'tenantConfig' as const };
      }
      if (envValue) {
        return { id: envValue, source: 'environment' as const };
      }
      return { id: fallbackValue ?? '', source: 'fallback' as const };
    };

    // Determine which template to use based on number of signers
    let templateId: string;
    let templateSource: 'tenantConfig' | 'environment' | 'fallback';
    
    if (hasSecondSignerFields || secondSigner) {
      // Use two-signer template
      const resolved = resolveTemplateId(
        tenantSignWellConfig.twoSignerTemplateId,
        process.env.SIGNWELL_TWO_SIGNER_TEMPLATE_ID,
        '130fb2e1-f13d-4acb-a8ff-373f3698ad6d'
      );
      templateId = resolved.id;
      templateSource = resolved.source;
      context.log('Using two-signer template', {
        templateSource,
        tenantId: tenant.tenantId
      });
    } else {
      // Use single-signer template from environment variable
      const resolved = resolveTemplateId(
        tenantSignWellConfig.templateId,
        process.env.SIGNWELL_TEMPLATE_ID,
        undefined
      );
      templateId = resolved.id;
      templateSource = resolved.source;
      context.log('Using single-signer template', {
        templateSource,
        tenantId: tenant.tenantId
      });
    }

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
    
    // if (!signingUrl) {
    //   throw new Error('Failed to get signing URL from SignWell response');
    // } Remove for now due to email signing

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
  authLevel: 'function', // Requires function key for access
  handler: createSignWellTemplateSession,
});
