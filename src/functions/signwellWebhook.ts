import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import * as crypto from 'crypto';
import { PDFDocument } from 'pdf-lib';
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
            
            // Split the PDF
            const splitPdfs = await splitSignedPdf(pdfBuffer, document.files, context);
            
            // Log results
            context.log('PDF split results:', {
              originalFiles: splitPdfs.originalFiles.length,
              auditTrail: splitPdfs.auditTrail ? 'Yes' : 'No',
              fullDocument: splitPdfs.fullDocument.length + ' bytes'
            });
            
            // TODO: Upload to OneDrive
            // - splitPdfs.fullDocument - Complete signed document
            // - splitPdfs.originalFiles - Individual files
            // - splitPdfs.auditTrail - Certificate/audit pages
            
            context.log('PDFs ready for OneDrive upload');
            
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

async function splitSignedPdf(
  pdfBuffer: Buffer,
  fileInfo: Array<{ name: string; pages_number: number }>,
  context: InvocationContext
): Promise<{
  fullDocument: Buffer;
  originalFiles: Array<{ name: string; buffer: Buffer }>;
  auditTrail: Buffer | null;
}> {
  try {
    // Load the complete PDF
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const totalPages = pdfDoc.getPageCount();
    
    context.log(`Total pages in signed document: ${totalPages}`);
    
    // Calculate expected pages from file info
    const expectedPages = fileInfo.reduce((sum, file) => sum + file.pages_number, 0);
    const auditPages = totalPages - expectedPages;
    
    context.log(`Expected content pages: ${expectedPages}, Audit pages: ${auditPages}`);
    
    const originalFiles: Array<{ name: string; buffer: Buffer }> = [];
    let currentPage = 0;
    
    // Split original files
    for (const file of fileInfo) {
      const newPdf = await PDFDocument.create();
      
      // Copy pages for this file
      for (let i = 0; i < file.pages_number; i++) {
        const [copiedPage] = await newPdf.copyPages(pdfDoc, [currentPage + i]);
        newPdf.addPage(copiedPage);
      }
      
      const pdfBytes = await newPdf.save();
      originalFiles.push({
        name: file.name,
        buffer: Buffer.from(pdfBytes)
      });
      
      context.log(`Split file: ${file.name} (${file.pages_number} pages)`);
      currentPage += file.pages_number;
    }
    
    // Extract audit trail/certificate pages if they exist
    let auditTrail: Buffer | null = null;
    if (auditPages > 0) {
      const auditPdf = await PDFDocument.create();
      
      // Copy audit pages (usually at the end)
      for (let i = expectedPages; i < totalPages; i++) {
        const [copiedPage] = await auditPdf.copyPages(pdfDoc, [i]);
        auditPdf.addPage(copiedPage);
      }
      
      const auditBytes = await auditPdf.save();
      auditTrail = Buffer.from(auditBytes);
      context.log(`Extracted audit trail: ${auditPages} pages`);
    }
    
    return {
      fullDocument: pdfBuffer, // Keep original as-is
      originalFiles,
      auditTrail
    };
    
  } catch (error) {
    context.error('Failed to split PDF:', error);
    // Return original if splitting fails
    return {
      fullDocument: pdfBuffer,
      originalFiles: [],
      auditTrail: null
    };
  }
}

app.http('webhook', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: signwellWebhook
});