import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import * as crypto from 'crypto';
import { SignWellWebhookEvent } from '../types/signwell';
import { SignWellService } from '../services/signwellService';

const SIGNWELL_API_APP_ID = process.env.SIGNWELL_API_APP_ID || 'd3957989-c389-4f24-aacc-74f507ccc59e';

function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

export async function signwellWebhook(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('SignWell webhook received');

  try {
    // Get the raw body for signature verification
    const rawBody = await request.text();
    const signature = request.headers.get('x-signwell-signature');
    
    // Verify webhook signature if provided
    if (signature && SIGNWELL_API_APP_ID) {
      const isValid = verifyWebhookSignature(rawBody, signature, SIGNWELL_API_APP_ID);
      if (!isValid) {
        context.warn('Invalid webhook signature');
        return {
          status: 401,
          body: 'Unauthorized'
        };
      }
    }

    // Parse the webhook payload
    const webhookData = JSON.parse(rawBody) as SignWellWebhookEvent;
    
    context.log('Webhook event type:', webhookData.event.type);
    context.log('Document ID:', webhookData.data.object.id);
    context.log('Document status:', webhookData.data.object.status);

    // Handle different webhook events
    switch (webhookData.event.type) {
      case 'document_signed':
        const document = webhookData.data.object;
        context.log('Document signed:', {
          documentId: document.id,
          documentName: document.name,
          status: document.status,
          signer: webhookData.event.related_signer,
          files: document.files
        });
        
        // Check if document is fully completed (webhook uses 'Completed' with capital C)
        if ((document as any).status === 'Completed' || document.status === 'completed') {
          context.log('Document is fully completed, downloading PDF...');
          
          try {
            // Initialize SignWell service
            const signwellService = new SignWellService();
            
            // Download the completed PDF
            const pdfBuffer = await signwellService.getCompletedPdf(document.id);
            context.log(`Downloaded PDF for document ${document.id}, size: ${pdfBuffer.length} bytes`);
            
            // TODO: Upload to OneDrive
            // For now, just log success
            context.log('PDF downloaded successfully, ready for OneDrive upload');
            
          } catch (error) {
            context.error('Failed to download PDF:', error);
          }
        }
        
        break;

      case 'document_sent':
        context.log('Document sent to recipients:', {
          documentId: webhookData.data.object.id,
          recipients: webhookData.data.object.recipients.map(r => ({
            name: r.name,
            email: r.email,
            status: r.status
          }))
        });
        break;

      case 'recipient_completed':
        context.log('Recipient completed signing:', {
          documentId: webhookData.data.object.id,
          signer: webhookData.event.related_signer
        });
        break;

      case 'recipient_viewed':
        context.log('Recipient viewed document:', {
          documentId: webhookData.data.object.id,
          signer: webhookData.event.related_signer
        });
        break;

      default:
        context.log('Unknown webhook event:', webhookData.event.type);
    }

    // Log the full webhook payload for debugging
    context.log('Full webhook payload:', JSON.stringify(webhookData, null, 2));

    // Return success response
    return {
      status: 200,
      body: JSON.stringify({ received: true })
    };

  } catch (error) {
    context.error('Error processing SignWell webhook:', error);
    
    return {
      status: 500,
      body: JSON.stringify({ 
        error: 'Failed to process webhook',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
}

app.http('webhook', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: signwellWebhook
});