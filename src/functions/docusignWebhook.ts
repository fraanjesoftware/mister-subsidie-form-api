import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import DocuSignService from '../services/docusignService';
import GoogleDriveService from '../services/googleDriveService';

interface WebhookPayload {
  event?: string;
  status?: string;
  envelopeId?: string;
}

interface CustomFields {
  [key: string]: string;
}

app.http('docusignWebhook', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    context.log('DocuSign webhook received');
    
    try {
      // Get the raw body for signature validation
      const rawBody = await request.text();
      
      // Validate webhook signature if secret is configured
      if (process.env.DOCUSIGN_WEBHOOK_SECRET) {
        const signature = request.headers.get('x-docusign-signature-1');
        if (!signature) {
          context.log('ERROR: Missing webhook signature');
          return {
            status: 401,
            body: 'Unauthorized'
          };
        }
        
        const isValid = DocuSignService.validateWebhookSignature(
          rawBody,
          signature,
          process.env.DOCUSIGN_WEBHOOK_SECRET
        );
        
        if (!isValid) {
          context.log('ERROR: Invalid webhook signature');
          return {
            status: 401,
            body: 'Unauthorized'
          };
        }
      }
      
      // Parse the webhook payload
      const payload: WebhookPayload = JSON.parse(rawBody);
      context.log('Webhook event:', payload.event);
      
      // We're interested in envelope-completed events
      if (payload.event === 'envelope-completed' || 
          (payload.status === 'completed' && payload.envelopeId)) {
        
        const envelopeId = payload.envelopeId;
        if (!envelopeId) {
          context.log('ERROR: No envelopeId in webhook payload');
          return {
            status: 200,
            body: 'OK'
          };
        }
        
        context.log('Processing completed envelope:', envelopeId);
        
        try {
          // Initialize DocuSign service
          const docusign = new DocuSignService();
          await docusign.initialize();
          
          // Get envelope details including custom fields
          context.log('Retrieving envelope metadata...');
          const envelopeDetails = await docusign.getEnvelopeDetails(envelopeId);
          
          // Extract custom fields
          const customFields: CustomFields = {};
          if (envelopeDetails.customFields && envelopeDetails.customFields.textCustomFields) {
            envelopeDetails.customFields.textCustomFields.forEach((field: any) => {
              customFields[field.name] = field.value;
            });
          }
          
          context.log('Custom fields retrieved:', customFields);
          
          // Check if we should upload to Drive
          const uploadToDrive = customFields.uploadToDrive === 'true';
          const driveFolderName = customFields.driveFolderName || 'Signed Subsidy Forms';
          // const signerEmail = customFields.signerEmail; // For future email notifications
          
          if (uploadToDrive) {
            context.log('Downloading signed documents...');
            const signedDocuments = await docusign.downloadSignedDocuments(envelopeId);
            
            context.log('Uploading signed documents to Google Drive...');
            
            const driveService = new GoogleDriveService();
            await driveService.initialize();
            
            // Prepare documents for upload
            const pdfFiles = signedDocuments.map(doc => ({
              filename: doc.name.replace('.pdf', '-signed.pdf'),
              pdfBytes: doc.pdfBytes as Uint8Array
            }));
            
            // Upload to Drive
            const uploadResult = await driveService.uploadPDFsFromMemory(
              pdfFiles,
              driveFolderName
            );
            
            context.log('Documents uploaded to Google Drive successfully');
            context.log('Upload result:', {
              folder: uploadResult.folder,
              files: uploadResult.files.map(f => ({
                name: f.driveFile?.name || 'Unknown',
                viewLink: f.driveFile?.webViewLink || null,
                success: f.success
              }))
            });
            
            // TODO: If you want to send notification emails, you would do it here
            // You could use the signerEmail from custom fields
            
          } else {
            context.log('Upload to Drive disabled for this envelope');
          }
          
          context.log('Envelope processing completed successfully');
          
        } catch (error: any) {
          context.log('ERROR: Error processing completed envelope:', error);
          // In a stateless system, we just log the error
          // You might want to send this to a monitoring service
        }
      }
      
      // Always return 200 to acknowledge receipt
      return {
        status: 200,
        body: 'OK'
      };
      
    } catch (error: any) {
      context.log('ERROR: Webhook processing error:', error);
      
      // Still return 200 to prevent retries for malformed payloads
      return {
        status: 200,
        body: 'OK'
      };
    }
  }
});