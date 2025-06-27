const { app } = require('@azure/functions');
const { PDFDocument } = require('pdf-lib');
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs').promises;

// Import adapted form filling logic
const { fillDeMinimisForm } = require('../services/fillDeMinimis');
const { fillMachtigingsformulier } = require('../services/fillMachtiging');
const { fillMKBVerklaring } = require('../services/fillMKB');
const GoogleDriveService = require('../services/googleDriveService');

app.http('fillForms', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log('fillForms function processing request');
        
        let requestBody = null;
        let tempDir = null;
        const filesToCleanup = [];

        try {
            // Parse request body with better error handling
            try {
                requestBody = await request.json();
                context.log('Request body received:', JSON.stringify(requestBody, null, 2));
            } catch (parseError) {
                context.log('ERROR: Failed to parse request body:', parseError);
                return {
                    status: 400,
                    body: JSON.stringify({
                        error: 'Invalid JSON in request body',
                        message: 'The request body must be valid JSON',
                        details: parseError.message
                    }),
                    headers: {
                        'Content-Type': 'application/json'
                    }
                };
            }
            
            // Validate request body structure
            if (!requestBody || typeof requestBody !== 'object') {
                return {
                    status: 400,
                    body: JSON.stringify({
                        error: 'Invalid request body',
                        message: 'Request body must be a JSON object',
                        example: {
                            deMinimis: {
                                selectedOption: 1,
                                companyName: "Company Name",
                                address: "Address",
                                postalCode: "1234 AB",
                                city: "City"
                            },
                            machtiging: {
                                companyName: "Company Name",
                                kvkNumber: "12345678"
                            },
                            mkbVerklaring: {
                                companyName: "Company Name",
                                employees: 50,
                                revenue: 5000000,
                                balanceTotal: 2500000
                            },
                            uploadToDrive: true,
                            driveFolderName: "Optional Custom Folder Name"
                        }
                    }),
                    headers: {
                        'Content-Type': 'application/json'
                    }
                };
            }

            // Check if at least one form is requested
            if (!requestBody.deMinimis && !requestBody.machtiging && !requestBody.mkbVerklaring) {
                return {
                    status: 400,
                    body: JSON.stringify({
                        error: 'No forms requested',
                        message: 'Please specify at least one form to fill (deMinimis, machtiging, or mkbVerklaring)'
                    }),
                    headers: {
                        'Content-Type': 'application/json'
                    }
                };
            }

            const results = {
                filled: [],
                errors: [],
                driveUpload: null,
                debug: {
                    environment: {
                        hasGoogleCredentials: !!process.env.GOOGLE_CREDENTIALS,
                        hasGoogleDriveFolderId: !!process.env.GOOGLE_DRIVE_FOLDER_ID,
                        nodeVersion: process.version,
                        platform: process.platform
                    }
                }
            };

            // Create temp directory for PDFs
            try {
                tempDir = path.join(process.cwd(), 'temp');
                await fs.mkdir(tempDir, { recursive: true });
                context.log('Temp directory created:', tempDir);
            } catch (dirError) {
                context.log('ERROR: Failed to create temp directory:', dirError);
                throw new Error(`Failed to create temp directory: ${dirError.message}`);
            }

            // Check if PDF templates exist
            const pdfTemplatesDir = path.join(__dirname, '../pdfs');
            try {
                await fs.access(pdfTemplatesDir);
                context.log('PDF templates directory found:', pdfTemplatesDir);
            } catch (accessError) {
                context.log('ERROR: PDF templates directory not found:', pdfTemplatesDir);
                results.errors.push({
                    form: 'system',
                    error: 'PDF templates directory not found',
                    details: `Expected directory at: ${pdfTemplatesDir}`
                });
            }

            // Fill De-minimis form
            if (requestBody.deMinimis) {
                try {
                    context.log('Processing De-minimis form with data:', JSON.stringify(requestBody.deMinimis));
                    
                    // Validate required fields
                    if (!requestBody.deMinimis.selectedOption) {
                        throw new Error('selectedOption is required (1, 2, or 3)');
                    }
                    
                    const filename = await fillDeMinimisForm(requestBody.deMinimis, tempDir);
                    filesToCleanup.push(path.join(tempDir, filename));
                    
                    results.filled.push({
                        form: 'de-minimis',
                        filename: filename,
                        status: 'success'
                    });
                    context.log('De-minimis form filled successfully:', filename);
                } catch (error) {
                    context.log('ERROR: Error filling De-minimis form:', error);
                    results.errors.push({
                        form: 'de-minimis',
                        error: error.message,
                        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
                    });
                }
            }

            // Fill Machtigingsformulier
            if (requestBody.machtiging) {
                try {
                    context.log('Processing Machtigingsformulier with data:', JSON.stringify(requestBody.machtiging));
                    
                    const filename = await fillMachtigingsformulier(requestBody.machtiging, tempDir);
                    filesToCleanup.push(path.join(tempDir, filename));
                    
                    results.filled.push({
                        form: 'machtiging',
                        filename: filename,
                        status: 'success'
                    });
                    context.log('Machtigingsformulier filled successfully:', filename);
                } catch (error) {
                    context.log('ERROR: Error filling Machtigingsformulier:', error);
                    results.errors.push({
                        form: 'machtiging',
                        error: error.message,
                        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
                    });
                }
            }

            // Fill MKB Verklaring
            if (requestBody.mkbVerklaring) {
                try {
                    context.log('Processing MKB Verklaring with data:', JSON.stringify(requestBody.mkbVerklaring));
                    
                    // Validate required numeric fields
                    const requiredNumericFields = ['employees', 'revenue', 'balanceTotal'];
                    for (const field of requiredNumericFields) {
                        if (requestBody.mkbVerklaring[field] === undefined || requestBody.mkbVerklaring[field] === null) {
                            throw new Error(`${field} is required for MKB Verklaring`);
                        }
                    }
                    
                    const result = await fillMKBVerklaring(requestBody.mkbVerklaring, tempDir);
                    filesToCleanup.push(path.join(tempDir, result.filename));
                    
                    results.filled.push({
                        form: 'mkb-verklaring',
                        filename: result.filename,
                        status: 'success',
                        companySize: result.companySize
                    });
                    context.log('MKB Verklaring filled successfully:', result.filename);
                } catch (error) {
                    context.log('ERROR: Error filling MKB Verklaring:', error);
                    results.errors.push({
                        form: 'mkb-verklaring',
                        error: error.message,
                        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
                    });
                }
            }

            // Upload to Google Drive if requested and forms were filled
            if (requestBody.uploadToDrive !== false && results.filled.length > 0) {
                try {
                    context.log('Attempting Google Drive upload...');
                    
                    // Check environment variables
                    if (!process.env.GOOGLE_CREDENTIALS) {
                        throw new Error('GOOGLE_CREDENTIALS environment variable not set. Please configure Google Drive credentials in Azure Function settings.');
                    }
                    
                    // Validate Google credentials format
                    let googleCreds;
                    try {
                        googleCreds = JSON.parse(process.env.GOOGLE_CREDENTIALS);
                        if (!googleCreds.type || !googleCreds.client_email) {
                            throw new Error('Invalid Google credentials format');
                        }
                    } catch (credError) {
                        throw new Error(`Invalid GOOGLE_CREDENTIALS format: ${credError.message}. Ensure the JSON is valid and complete.`);
                    }
                    
                    const driveService = new GoogleDriveService();
                    await driveService.initialize();
                    
                    // Get file paths
                    const filePaths = results.filled.map(f => path.join(tempDir, f.filename));
                    context.log('Files to upload:', filePaths);
                    
                    // Upload files
                    const uploadResult = await driveService.uploadPDFs(
                        filePaths, 
                        requestBody.driveFolderName || 'Subsidie Forms'
                    );
                    
                    results.driveUpload = {
                        folder: uploadResult.folder,
                        files: uploadResult.files.map(f => ({
                            name: f.driveFile?.name || 'Unknown',
                            viewLink: f.driveFile?.webViewLink || null,
                            success: f.success,
                            error: f.error
                        }))
                    };
                    context.log('Google Drive upload completed successfully');
                } catch (error) {
                    context.log('ERROR: Error uploading to Google Drive:', error);
                    results.errors.push({
                        form: 'google-drive',
                        error: error.message,
                        details: error.code === '404' ? 'Folder not found or no access. Ensure the folder is shared with the service account.' : undefined,
                        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
                    });
                }
            }

            // Clean up temp files
            try {
                context.log('Cleaning up temporary files...');
                for (const filePath of filesToCleanup) {
                    try {
                        await fs.unlink(filePath);
                        context.log('Deleted temp file:', filePath);
                    } catch (unlinkError) {
                        context.log('WARNING: Failed to delete temp file:', filePath, unlinkError.message);
                    }
                }
            } catch (error) {
                context.log('WARNING: Error during cleanup:', error);
            }

            // Prepare response
            const statusCode = results.errors.length === 0 ? 200 : 207; // 207 Multi-Status for partial success
            const response = {
                success: results.errors.length === 0,
                message: results.filled.length > 0 
                    ? `Filled ${results.filled.length} form(s) successfully${results.errors.length > 0 ? `, but ${results.errors.length} error(s) occurred` : ''}`
                    : 'No forms were filled successfully',
                results: results
            };

            // Add debug info in development
            if (process.env.NODE_ENV === 'development' || results.errors.length > 0) {
                response.debug = results.debug;
            }

            // Return results
            context.log('Returning response with status:', statusCode);
            return {
                status: statusCode,
                body: JSON.stringify(response, null, 2),
                headers: {
                    'Content-Type': 'application/json'
                }
            };

        } catch (error) {
            // Log full error details
            context.log('ERROR: Unhandled error in fillForms function:', {
                message: error.message,
                stack: error.stack,
                name: error.name,
                code: error.code
            });

            // Return detailed error response
            return {
                status: 500,
                body: JSON.stringify({
                    error: 'Internal server error',
                    message: error.message,
                    details: process.env.NODE_ENV === 'development' ? {
                        stack: error.stack,
                        code: error.code,
                        name: error.name
                    } : 'Enable development mode for detailed error information',
                    timestamp: new Date().toISOString(),
                    requestId: context.invocationId
                }, null, 2),
                headers: {
                    'Content-Type': 'application/json'
                }
            };
        }
    }
});