import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { UploadBankStatementResponse } from '../types/application';
import { OneDriveService } from '../services/onedriveService';
import { formatTimestamp } from '../utils/time';
import { ONEDRIVE_CONFIG } from '../constants/onedrive';

/**
 * Azure Function: Upload Bank Statement
 *
 * Uploads a bank statement PDF to an existing application folder
 * Requires folderId from the frontend (set during company info submission)
 */
export async function uploadBankStatement(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Bank statement upload request received');

  try {
    // Parse multipart form data
    const formData = await request.formData();

    const file = formData.get('file') as File;
    const folderId = formData.get('folderId') as string;
    const applicationId = formData.get('applicationId') as string;
    const kvkNummer = formData.get('kvkNummer') as string;
    const bedrijfsnaam = formData.get('bedrijfsnaam') as string;

    context.log('Bank statement upload details:', {
      fileName: file?.name,
      fileSize: file?.size,
      folderId,
      applicationId,
      kvkNummer,
      bedrijfsnaam
    });

    // Validate required fields
    if (!file) {
      return {
        status: 400,
        body: JSON.stringify({
          success: false,
          message: 'File is required'
        }),
        headers: { 'Content-Type': 'application/json' }
      };
    }

    if (!folderId) {
      return {
        status: 400,
        body: JSON.stringify({
          success: false,
          message: 'folderId is required'
        }),
        headers: { 'Content-Type': 'application/json' }
      };
    }

    if (!applicationId) {
      return {
        status: 400,
        body: JSON.stringify({
          success: false,
          message: 'applicationId is required'
        }),
        headers: { 'Content-Type': 'application/json' }
      };
    }

    // Validate file type (PDF only)
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return {
        status: 400,
        body: JSON.stringify({
          success: false,
          message: 'Only PDF files are allowed'
        }),
        headers: { 'Content-Type': 'application/json' }
      };
    }

    // Validate file size (max 10MB)
    const maxFileSize = 10 * 1024 * 1024; // 10MB in bytes
    if (file.size > maxFileSize) {
      return {
        status: 400,
        body: JSON.stringify({
          success: false,
          message: 'File size must be less than 10MB'
        }),
        headers: { 'Content-Type': 'application/json' }
      };
    }

    // Check if OneDrive is configured
    const isOneDriveConfigured = process.env.ONEDRIVE_CLIENT_ID &&
                                process.env.ONEDRIVE_CLIENT_SECRET &&
                                process.env.ONEDRIVE_TENANT_ID &&
                                (process.env.ONEDRIVE_USER_ID || process.env.ONEDRIVE_SITE_ID);

    if (!isOneDriveConfigured) {
      return {
        status: 503,
        body: JSON.stringify({
          success: false,
          message: 'OneDrive is not configured'
        }),
        headers: { 'Content-Type': 'application/json' }
      };
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    // Initialize OneDrive service
    const onedriveService = new OneDriveService();

    try {
      await onedriveService.verifyApplicationFolderAccess(folderId, applicationId);
    } catch (validationError) {
      context.log('Folder verification failed for bank statement upload', {
        folderId,
        applicationId,
        error: validationError instanceof Error ? validationError.message : validationError
      });

      return {
        status: 403,
        body: JSON.stringify({
          success: false,
          message: 'Folder validation failed for supplied applicationId'
        }),
        headers: { 'Content-Type': 'application/json' }
      };
    }

    // Upload directly to the folder using folderId
    const timestamp = formatTimestamp();
    const sanitizedCompany = (bedrijfsnaam || '').replace(ONEDRIVE_CONFIG.SANITIZE_REGEX, '_').trim();
    const companyPrefix = sanitizedCompany ? `${sanitizedCompany} - ` : '';
    const storedFileName = `${companyPrefix}bankafschrift-${timestamp}.pdf`; // Append timestamp to retain history
    const uploadResult = await onedriveService.uploadToFolder(
      folderId,
      fileBuffer,
      storedFileName
    );

    context.log('Bank statement uploaded successfully:', {
      fileId: uploadResult.id,
      fileName: uploadResult.name,
      webUrl: uploadResult.webUrl
    });

    // Write audit entry alongside the upload
    const auditEntry = {
      action: 'uploadBankStatement',
      uploadedAt: new Date().toISOString(),
      applicationId,
      folderId,
      originalFileName: file.name,
      storedFileName,
      fileSize: file.size,
      kvkNummer,
      bedrijfsnaam
    };

    try {
      await onedriveService.recordAuditEntry(folderId, 'bankafschrift', auditEntry, timestamp);
    } catch (auditError) {
      const logMethod = typeof context.warn === 'function' ? context.warn : context.log;
      logMethod.call(context, 'Failed to write audit entry for bank statement upload', auditError);
    }

    // Return success response
    const response: UploadBankStatementResponse = {
      success: true,
      message: 'Bank statement uploaded successfully'
    };

    return {
      status: 200,
      body: JSON.stringify(response),
      headers: { 'Content-Type': 'application/json' }
    };

  } catch (error) {
    context.error('Error uploading bank statement:', error);

    return {
      status: 500,
      body: JSON.stringify({
        success: false,
        message: 'Failed to upload bank statement',
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      headers: { 'Content-Type': 'application/json' }
    };
  }
}

// Register Azure Function
app.http('uploadBankStatement', {
  methods: ['POST'],
  authLevel: 'function',
  handler: uploadBankStatement
});
