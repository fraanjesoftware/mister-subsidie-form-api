import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import * as crypto from 'crypto';
import { PDFDocument } from 'pdf-lib';
import { SignWellWebhookEvent } from '../types/signwell';
import { SignWellService } from '../services/signwellService';
import { OneDriveService } from '../services/onedriveService';
import { DocumentMetadata, OneDriveUploadResult } from '../types/onedrive';
import { getKnownMetadataSources } from '../utils/tenantConfig';

const TENANT_METADATA_SOURCES = getKnownMetadataSources();

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
      case 'document_completed':
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

            const metadataSource = document.metadata?.source;
            const isApiDocument = metadataSource ? TENANT_METADATA_SOURCES.has(metadataSource) : false;

            // Split the PDF
            const splitPdfs = await splitSignedPdf(pdfBuffer, document.files, context, isApiDocument);
            
            // Log results
            context.log('PDF split results:', {
              originalFiles: splitPdfs.originalFiles.length,
              auditTrail: splitPdfs.auditTrail ? 'Yes' : 'No',
              fullDocument: splitPdfs.fullDocument.length + ' bytes',
              isApiDocument,
              metadataSource,
              tenantId: document.metadata?.tenant_id || null
            });
            
            // Check if OneDrive is configured
            const isOneDriveConfigured = process.env.ONEDRIVE_CLIENT_ID && 
                                        process.env.ONEDRIVE_CLIENT_SECRET && 
                                        process.env.ONEDRIVE_TENANT_ID &&
                                        (process.env.ONEDRIVE_USER_ID || process.env.ONEDRIVE_SITE_ID);
            
            if (isOneDriveConfigured) {
              context.log('Uploading documents to OneDrive...');

              try {
                // Initialize OneDrive service
                const onedriveService = new OneDriveService();

                // Check if this document was created through our API
                const isApiDocument = metadataSource ? TENANT_METADATA_SOURCES.has(metadataSource) : false;

                // Extract folderId from metadata (new application-based flow)
                const rawFolderId = typeof document.metadata?.folder_id === 'string'
                  ? document.metadata.folder_id.trim()
                  : undefined;
                const folderId = rawFolderId && rawFolderId.toLowerCase() !== 'null' && rawFolderId.toLowerCase() !== 'undefined'
                  ? rawFolderId
                  : undefined;
                const applicationId = document.metadata?.application_id;

                // Extract company name with fallback strategies
                let companyName = document.metadata?.company_name;

                if (!companyName && !isApiDocument) {
                  // For external documents, try to extract from document name
                  // Pattern: "20251079 E.F. interieurafbouw raamovereenkomst" -> "E.F. interieurafbouw"
                  const nameMatch = document.name.match(/^\d+\s+(.+?)\s+(raamovereenkomst|overeenkomst|contract|document).*$/i);
                  if (nameMatch) {
                    companyName = nameMatch[1].trim();
                  } else {
                    // Fallback: use document name without numbers
                    companyName = document.name.replace(/^\d+\s+/, '').replace(/\.(pdf|docx?)$/i, '').trim();
                  }
                }

                // Extract metadata from document
                const metadata: DocumentMetadata = {
                  companyName: companyName || 'Onbekend Bedrijf',
                  kvkNumber: document.metadata?.kvk_number || 'Onbekend',
                  documentId: document.id,
                  signedAt: document.completed_at || new Date().toISOString(),
                  signerName: webhookData.event.related_signer?.name,
                  signerEmail: webhookData.event.related_signer?.email,
                  isExternal: !isApiDocument, // Add flag for external documents
                  tenantId: document.metadata?.tenant_id,
                  metadataSource,
                  applicationId, // Add applicationId for tracking
                  folderId, // Add folderId for direct upload
                };
                
                // Format date as DD-MM-YYYY
                const date = new Date(metadata.signedAt);
                const formattedDate = `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`;

                // Prepare documents for upload
                const documentsToUpload: { buffer: Buffer; fileName: string }[] = [];

                // Add full document with different naming based on source
                if (metadata.isExternal) {
                  // For external documents, use original document name with date
                  documentsToUpload.push({
                    buffer: splitPdfs.fullDocument,
                    fileName: `${document.name} - ${formattedDate}.pdf`
                  });
                } else {
                  // For API documents, use standard naming
                  documentsToUpload.push({
                    buffer: splitPdfs.fullDocument,
                    fileName: `SLIM Aanvraag ${metadata.companyName} ${formattedDate}.pdf`
                  });
                }

                // Add individual pages with specific names
                if (!metadata.isExternal) {
                  // For API documents, use standard page naming (updated for new structure)
                  const pageNames = [
                    'De-minimisverklaring',
                    'Machtigingsformulier',
                    'MKB Verklaring SLIM',
                    'Overeenkomst Dienstverlening'
                  ];

                  splitPdfs.originalFiles.forEach((file, index) => {
                    const pageName = pageNames[index] || `Document ${index + 1}`;
                    documentsToUpload.push({
                      buffer: file.buffer,
                      fileName: `${pageName} ${metadata.companyName} ${formattedDate}.pdf`
                    });
                  });
                } else {
                  // For external documents, use original file names
                  splitPdfs.originalFiles.forEach((file) => {
                    documentsToUpload.push({
                      buffer: file.buffer,
                      fileName: `${file.name} - ${formattedDate}.pdf`
                    });
                  });
                }

                // Add audit trail if exists
                if (splitPdfs.auditTrail) {
                  documentsToUpload.push({
                    buffer: splitPdfs.auditTrail,
                    fileName: `Audit Trail ${metadata.companyName} ${formattedDate}.pdf`
                  });
                }

                // Upload documents using appropriate strategy
                let uploadResults: OneDriveUploadResult[] = [];
                let resolvedFolderId = folderId;

                if (resolvedFolderId) {
                  try {
                    await onedriveService.verifyApplicationFolderAccess(resolvedFolderId);
                    context.log('Using application-based upload with folderId:', resolvedFolderId);

                    uploadResults = await Promise.all(
                      documentsToUpload.map(doc =>
                        onedriveService.uploadToFolder(resolvedFolderId as string, doc.buffer, doc.fileName)
                      )
                    );

                    context.log('Documents uploaded to application folder');
                  } catch (verificationError) {
                    context.warn('Application folder upload failed, falling back to legacy structure', {
                      folderId: resolvedFolderId,
                      error: verificationError instanceof Error ? verificationError.message : verificationError
                    });
                    resolvedFolderId = undefined;
                    uploadResults = [];
                  }
                }

                if (!resolvedFolderId) {
                  // FALLBACK: Use date-based folder creation (backward compatibility)
                  context.log('No folderId found, using date-based folder creation (legacy flow)');

                  uploadResults = await onedriveService.uploadSignedDocuments(
                    documentsToUpload,
                    metadata
                  );

                  context.log('Documents uploaded using legacy date-based structure');
                }

                context.log('OneDrive upload completed:', {
                  filesUploaded: uploadResults.length,
                  uploadMethod: resolvedFolderId ? 'application-based' : 'date-based',
                  folderId: resolvedFolderId || 'N/A',
                  applicationId: applicationId || 'N/A',
                  files: uploadResults.map(r => ({
                    name: r.name,
                    size: r.size,
                    webUrl: r.webUrl
                  }))
                });
                
              } catch (uploadError) {
                context.error('Failed to upload to OneDrive:', uploadError);
                // Fail the webhook so SignWell knows there was an error
                return {
                  status: 500,
                  body: JSON.stringify({
                    error: 'OneDrive upload failed',
                    message: uploadError instanceof Error ? uploadError.message : 'Unknown error',
                    documentId: webhookData.data.object.id
                  }),
                  headers: {
                    'Content-Type': 'application/json'
                  }
                };
              }
            } else {
              context.log('OneDrive not configured - skipping upload');
            }
            
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
  context: InvocationContext,
  isApiDocument: boolean = false
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
    
    // For external documents with single file, don't split
    if (!isApiDocument && fileInfo.length === 1 && auditPages <= 1) {
      context.log('External single document detected - skipping split');
      
      // Still extract audit trail if present
      let auditTrail: Buffer | null = null;
      if (auditPages === 1) {
        const auditPdf = await PDFDocument.create();
        const [copiedPage] = await auditPdf.copyPages(pdfDoc, [totalPages - 1]);
        auditPdf.addPage(copiedPage);
        const auditBytes = await auditPdf.save();
        auditTrail = Buffer.from(auditBytes);
      }
      
      return {
        fullDocument: pdfBuffer,
        originalFiles: [], // Don't split external single documents
        auditTrail
      };
    }
    
    const originalFiles: Array<{ name: string; buffer: Buffer }> = [];
    let currentPage = 0;
    
    // Validate page counts for API documents
    if (isApiDocument && fileInfo.length > 0) {
      // Expected structure for SLIM documents (updated: MKB now 1 page, added Overeenkomst)
      const expectedStructure = [
        { name: 'de-minimisverklaring', expectedPages: 3 },
        { name: 'machtigingsformulier', expectedPages: 2 },
        { name: 'mkb verklaring', expectedPages: 1 },
        { name: 'overeenkomst dienstverlening', expectedPages: 1 }
      ];
      
      // Check if structure matches (loosely - by page count pattern)
      const pagePattern = fileInfo.map(f => f.pages_number).join(',');
      const expectedPattern = expectedStructure.map(s => s.expectedPages).join(',');
      
      if (pagePattern !== expectedPattern && fileInfo.length === 4) {
        context.warn(`Page structure mismatch for API document. Expected: ${expectedPattern}, Got: ${pagePattern}`);
        context.warn('Template may have been modified - splitting may be inaccurate');
      }
    }
    
    // Split original files
    for (const file of fileInfo) {
      const newPdf = await PDFDocument.create();
      
      // Copy pages for this file
      for (let i = 0; i < file.pages_number; i++) {
        if (currentPage + i < expectedPages) {
          const [copiedPage] = await newPdf.copyPages(pdfDoc, [currentPage + i]);
          newPdf.addPage(copiedPage);
        }
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
    if (auditPages > 0 && expectedPages < totalPages) {
      const auditPdf = await PDFDocument.create();
      
      // Copy audit pages (usually at the end)
      for (let i = expectedPages; i < totalPages; i++) {
        const [copiedPage] = await auditPdf.copyPages(pdfDoc, [i]);
        auditPdf.addPage(copiedPage);
      }
      
      const auditBytes = await auditPdf.save();
      auditTrail = Buffer.from(auditBytes);
      context.log(`Extracted audit trail: ${auditPages} pages`);
    } else if (auditPages < 0) {
      context.warn(`Warning: Document has fewer pages (${totalPages}) than expected (${expectedPages})`);
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
