import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import * as crypto from 'crypto';
import { SignWellWebhookEvent } from '../types/signwell';

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
    
    context.log('Webhook event:', webhookData.event);
    context.log('Document ID:', webhookData.document?.id);
    context.log('Document status:', webhookData.document?.status);

    // Handle different webhook events
    switch (webhookData.event) {
      case 'document_completed':
        context.log('Document completed:', {
          documentId: webhookData.document.id,
          documentName: webhookData.document.name,
          completedAt: webhookData.document.completed_at
        });
        
        // Here you can:
        // - Update your database
        // - Download the completed PDF
        // - Send notifications
        // - Trigger other workflows
        
        break;

      case 'document_sent':
        context.log('Document sent to recipients:', {
          documentId: webhookData.document.id,
          recipients: webhookData.document.recipients.map(r => ({
            name: r.name,
            email: r.email,
            status: r.status
          }))
        });
        break;

      case 'recipient_completed':
        context.log('Recipient completed signing:', {
          documentId: webhookData.document.id,
          recipientName: webhookData.recipient?.name,
          recipientEmail: webhookData.recipient?.email,
          signedAt: webhookData.recipient?.signed_at
        });
        break;

      case 'recipient_viewed':
        context.log('Recipient viewed document:', {
          documentId: webhookData.document.id,
          recipientName: webhookData.recipient?.name,
          recipientEmail: webhookData.recipient?.email,
          viewedAt: webhookData.recipient?.viewed_at
        });
        break;

      default:
        context.log('Unknown webhook event:', webhookData.event);
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