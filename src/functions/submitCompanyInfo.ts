import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { CompanyInfo, SubmitCompanyInfoResponse } from '../types/application';
import { OneDriveService } from '../services/onedriveService';
import { ExcelService } from '../services/excelService';

/**
 * Azure Function: Submit Company Info
 *
 * Creates or updates an application folder in OneDrive with company data
 * - If folderId is provided: Updates existing folder (rename + update Excel)
 * - If folderId is absent: Creates new folder + Excel file
 *
 * This follows the Single Responsibility Principle - one endpoint manages company info state
 */
export async function submitCompanyInfo(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Submit company info request received');

  try {
    // Parse request body
    const body = await request.text();
    if (!body) {
      return {
        status: 400,
        body: JSON.stringify({
          success: false,
          message: 'Request body is required'
        }),
        headers: { 'Content-Type': 'application/json' }
      };
    }

    const companyInfo: CompanyInfo = JSON.parse(body);
    context.log('Company info received:', {
      applicationId: companyInfo.applicationId,
      bedrijfsnaam: companyInfo.bedrijfsnaam,
      tenantId: companyInfo.tenantId,
      hasFolderId: !!companyInfo.folderId
    });

    // Validate required fields
    const validationErrors = validateCompanyInfo(companyInfo);
    if (validationErrors.length > 0) {
      return {
        status: 400,
        body: JSON.stringify({
          success: false,
          message: 'Validation failed',
          errors: validationErrors
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

    // Initialize services
    const onedriveService = new OneDriveService();
    const excelService = new ExcelService();

    // Generate Excel file
    const excelBuffer = excelService.generateCompanyDataExcel(companyInfo);
    const excelFileName = excelService.getCompanyDataFileName();

    let folderId: string;
    let isUpdate = false;

    // Determine if this is create or update scenario
    if (companyInfo.folderId) {
      // UPDATE SCENARIO: Rename folder and update Excel
      isUpdate = true;
      folderId = companyInfo.folderId;

      context.log('Updating existing folder:', folderId);

      // Rename folder to match new company name (if changed)
      await onedriveService.renameFolder(folderId, companyInfo.applicationId);
      context.log('Folder renamed to:', companyInfo.applicationId);

      // Update Excel file
      await onedriveService.updateFileInFolder(folderId, excelFileName, excelBuffer);
      context.log('Excel file updated');

    } else {
      // CREATE SCENARIO: New folder + Excel file
      context.log('Creating new application folder');

      const folderResult = await onedriveService.createApplicationFolder(
        companyInfo.applicationId,
        companyInfo.tenantId
      );

      folderId = folderResult.folderId;
      context.log('Application folder created:', {
        folderId,
        folderPath: folderResult.folderPath
      });

      // Upload Excel file
      await onedriveService.uploadToFolder(folderId, excelBuffer, excelFileName);
      context.log('Excel file uploaded');
    }

    // Return success response with folderId
    const response: SubmitCompanyInfoResponse = {
      success: true,
      folderId,
      message: isUpdate ? 'Company info updated successfully' : 'Company info submitted successfully'
    };

    return {
      status: 200,
      body: JSON.stringify(response),
      headers: { 'Content-Type': 'application/json' }
    };

  } catch (error) {
    context.error('Error processing company info submission:', error);

    return {
      status: 500,
      body: JSON.stringify({
        success: false,
        message: 'Failed to process company info',
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      headers: { 'Content-Type': 'application/json' }
    };
  }
}

/**
 * Validate company info payload
 * Following DRY principle - centralized validation logic
 */
function validateCompanyInfo(data: CompanyInfo): string[] {
  const errors: string[] = [];

  // Required fields
  if (!data.applicationId) errors.push('applicationId is required');
  if (!data.tenantId) errors.push('tenantId is required');
  if (!data.datum) errors.push('datum is required');
  if (!data.bedrijfsnaam) errors.push('bedrijfsnaam is required');
  if (!data.kvkNummer) errors.push('kvkNummer is required');
  if (!data.btwId) errors.push('btwId is required');
  if (!data.adres) errors.push('adres is required');
  if (!data.postcode) errors.push('postcode is required');
  if (!data.plaats) errors.push('plaats is required');
  if (!data.contactNaam) errors.push('contactNaam is required');
  if (!data.contactEmail) errors.push('contactEmail is required');

  // Email format validation
  if (data.contactEmail && !isValidEmail(data.contactEmail)) {
    errors.push('contactEmail must be a valid email address');
  }

  return errors;
}

/**
 * Simple email validation
 */
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Register Azure Function
app.http('submitCompanyInfo', {
  methods: ['POST'],
  authLevel: 'function',
  handler: submitCompanyInfo
});
