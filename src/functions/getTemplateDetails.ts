import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import DocuSignService from '../services/docusignService';

interface TemplateDetailsRequest {
  templateId?: string;
}

app.http('getTemplateDetails', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    context.log('getTemplateDetails function processing request');
    
    try {
      let templateId: string | undefined;
      
      // Handle both GET and POST requests
      if (request.method === 'GET') {
        // Get templateId from query parameters
        templateId = request.query.get('templateId') || undefined;
      } else {
        // Get templateId from request body
        const requestBody = await request.json() as TemplateDetailsRequest;
        templateId = requestBody.templateId;
      }
      
      // Use default template ID from environment if not provided
      if (!templateId) {
        templateId = process.env.DOCUSIGN_TEMPLATE_ID;
        if (!templateId) {
          return {
            status: 400,
            body: JSON.stringify({
              error: 'Missing templateId',
              message: 'Please provide a templateId in the request or set DOCUSIGN_TEMPLATE_ID environment variable'
            }),
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          };
        }
      }
      
      // Initialize DocuSign
      const docusign = new DocuSignService();
      await docusign.initialize();
      
      // Get template details
      const templateDetails = await docusign.getTemplateDetails(templateId);
      
      context.log(`Template details retrieved successfully for template: ${templateId}`);
      
      // Return template details
      return {
        status: 200,
        body: JSON.stringify({
          success: true,
          template: templateDetails,
          usage: {
            roles: 'Use these role names in the "roleName" field when creating signing sessions',
            customFields: 'Use these field names when setting custom field values (metadata only, not visible to signers)',
            tabs: 'Use these tab labels to pre-fill form fields that signers will see',
            example: {
              signers: [
                {
                  email: 'signer@example.com',
                  name: 'John Doe',
                  roleName: templateDetails.roles[0]?.roleName || 'Signer',
                  tabs: templateDetails.roles[0]?.tabs ? {
                    textTabs: templateDetails.roles[0].tabs
                      .filter((tab: any) => tab.type === 'text')
                      .map((tab: any) => ({
                        tabLabel: tab.tabLabel,
                        value: 'Your pre-filled value here'
                      })),
                    checkboxTabs: templateDetails.roles[0].tabs
                      .filter((tab: any) => tab.type === 'checkbox')
                      .map((tab: any) => ({
                        tabLabel: tab.tabLabel,
                        selected: 'true'
                      }))
                  } : undefined
                }
              ],
              customFields: {
                textCustomFields: templateDetails.customFields.textCustomFields.map((field: any) => ({
                  name: field.name,
                  value: 'Metadata value (not visible to signers)'
                }))
              }
            }
          }
        }),
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      };
      
    } catch (error: any) {
      context.log('ERROR:', error);
      return {
        status: 500,
        body: JSON.stringify({
          error: 'Failed to retrieve template details',
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