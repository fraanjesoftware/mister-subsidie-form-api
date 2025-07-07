import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import DocuSignService from '../services/docusignService';

interface Signer {
  email: string;
  name: string;
  roleName: string; // The role name as defined in the template
  clientUserId?: string;
  tabs?: {
    textTabs?: Array<{
      tabLabel: string;
      value: string;
    }>;
    checkboxTabs?: Array<{
      tabLabel: string;
      selected: string; // "true" or "false"
    }>;
    radioGroupTabs?: Array<{
      groupName: string;
      radios: Array<{
        value: string;
        selected: string; // "true" or "false"
      }>;
    }>;
    listTabs?: Array<{
      tabLabel: string;
      value: string;
    }>;
  };
}

interface TemplateSigningRequest {
  templateId: string;
  signers: Signer[];
  returnUrl: string;
  emailSubject?: string;
  customFields?: any;
  forEmbedding?: boolean; // Whether to create embedded signing session
  sendCompletionEmail?: boolean; // Send completion email to embedded signers
  notification?: {
    useAccountDefaults?: boolean;
    reminders?: {
      reminderEnabled: string;
      reminderDelay: string;
      reminderFrequency: string;
    };
    expirations?: {
      expireEnabled: string;
      expireAfter: string;
      expireWarn: string;
    };
  };
}

app.http('createTemplateSigningSession', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    context.log('createTemplateSigningSession function processing request');
    
    try {
      // Parse request body
      const requestBody = await request.json() as TemplateSigningRequest;
      
      if (!requestBody.signers || requestBody.signers.length === 0) {
        return {
          status: 400,
          body: JSON.stringify({
            error: 'Missing signers',
            message: 'Please provide at least one signer'
          }),
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        };
      }
      
      // Validate each signer
      for (const [index, signer] of requestBody.signers.entries()) {
        if (!signer.email || !signer.name || !signer.roleName) {
          return {
            status: 400,
            body: JSON.stringify({
              error: 'Invalid signer information',
              message: `Signer at index ${index}: Please provide email, name, and roleName`
            }),
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          };
        }
      }
      
      const forEmbedding = requestBody.forEmbedding !== false; // Default to true
      
      if (forEmbedding && !requestBody.returnUrl) {
        return {
          status: 400,
          body: JSON.stringify({
            error: 'Missing returnUrl',
            message: 'Please provide a returnUrl for embedded signing'
          }),
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        };
      }
      
      // Initialize DocuSign
      const docusign = new DocuSignService();
      await docusign.initialize();
      
      // Prepare template roles
      const templateRoles = requestBody.signers.map((signer, index) => ({
        email: signer.email,
        name: signer.name,
        roleName: signer.roleName,
        // Only the first signer uses embedded signing when forEmbedding is true
        clientUserId: (forEmbedding && index === 0) ? (signer.clientUserId || uuidv4()) : undefined,
        tabs: signer.tabs, // Pass tabs to pre-fill form fields
        // Enable email notifications for embedded signers (first signer only when forEmbedding is true)
        embeddedRecipientStartURL: (requestBody.sendCompletionEmail && forEmbedding && index === 0) ? 'SIGN_AT_DOCUSIGN' : undefined
      }));
      
      // Create envelope from template
      const envelopeId = await docusign.createEnvelopeFromTemplate(
        requestBody.templateId,
        templateRoles,
        requestBody.customFields,
        requestBody.emailSubject,
        'sent',
        requestBody.notification
      );
      
      context.log('Envelope created from template:', envelopeId);
      
      // If embedded signing is requested, get the signing URL for the first signer
      let signingUrl: string | undefined;
      let clientUserId: string | undefined;
      
      if (forEmbedding && requestBody.signers.length > 0) {
        const firstSigner = requestBody.signers[0];
        clientUserId = templateRoles[0].clientUserId;
        
        // Get signing URL (redirect flow)
        // DocuSign will redirect back to returnUrl with event parameters:
        // - Success: returnUrl?docusign=callback&event=signing_complete
        // - Cancel: returnUrl?docusign=callback&event=cancel
        // - Decline: returnUrl?docusign=callback&event=decline
        signingUrl = await docusign.getSigningUrl(
          envelopeId,
          firstSigner.email,
          firstSigner.name,
          clientUserId!,
          requestBody.returnUrl
        );
        
        context.log('Signing URL generated for template-based envelope (redirect flow)');
      }
      
      // Return success response with CORS headers
      return {
        status: 200,
        body: JSON.stringify({
          success: true,
          envelopeId: envelopeId,
          signingUrl: signingUrl,
          clientUserId: clientUserId,
          expiresIn: signingUrl ? 300 : undefined, // 5 minutes
          message: forEmbedding 
            ? `Template-based signing session created successfully. First signer will be redirected to DocuSign, subsequent signers will receive email notifications.`
            : 'Template-based envelope created successfully. All signers will receive email notifications.',
          templateId: requestBody.templateId,
          signers: templateRoles.map(role => ({
            email: role.email,
            name: role.name,
            roleName: role.roleName,
            clientUserId: role.clientUserId
          }))
        }),
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      };
      
    } catch (error: any) {
      context.log('ERROR:', error);
      return {
        status: 500,
        body: JSON.stringify({
          error: 'Failed to create template-based signing session',
          message: error.message,
          details: error.details || {}
        }),
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      };
    }
  }
});