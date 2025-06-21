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

        try {
            // Parse request body
            const formData = await request.json();
            
            // Validate request
            if (!formData || typeof formData !== 'object') {
                return {
                    status: 400,
                    body: JSON.stringify({
                        error: 'Invalid request body. Please provide form data.',
                        example: {
                            deMinimis: { /* ... */ },
                            machtiging: { /* ... */ },
                            mkbVerklaring: { /* ... */ }
                        }
                    }),
                    headers: {
                        'Content-Type': 'application/json'
                    }
                };
            }

            const results = {
                filled: [],
                errors: [],
                driveUpload: null
            };

            // Create temp directory for PDFs
            const tempDir = path.join(process.cwd(), 'temp');
            await fs.mkdir(tempDir, { recursive: true });

            // Fill De-minimis form
            if (formData.deMinimis) {
                try {
                    context.log('Filling De-minimis form...');
                    const filename = await fillDeMinimisForm(formData.deMinimis, tempDir);
                    results.filled.push({
                        form: 'de-minimis',
                        filename: filename,
                        status: 'success'
                    });
                } catch (error) {
                    context.log.error('Error filling De-minimis form:', error);
                    results.errors.push({
                        form: 'de-minimis',
                        error: error.message
                    });
                }
            }

            // Fill Machtigingsformulier
            if (formData.machtiging) {
                try {
                    context.log('Filling Machtigingsformulier...');
                    const filename = await fillMachtigingsformulier(formData.machtiging, tempDir);
                    results.filled.push({
                        form: 'machtiging',
                        filename: filename,
                        status: 'success'
                    });
                } catch (error) {
                    context.log.error('Error filling Machtigingsformulier:', error);
                    results.errors.push({
                        form: 'machtiging',
                        error: error.message
                    });
                }
            }

            // Fill MKB Verklaring
            if (formData.mkbVerklaring) {
                try {
                    context.log('Filling MKB Verklaring...');
                    const result = await fillMKBVerklaring(formData.mkbVerklaring, tempDir);
                    results.filled.push({
                        form: 'mkb-verklaring',
                        filename: result.filename,
                        status: 'success',
                        companySize: result.companySize
                    });
                } catch (error) {
                    context.log.error('Error filling MKB Verklaring:', error);
                    results.errors.push({
                        form: 'mkb-verklaring',
                        error: error.message
                    });
                }
            }

            // Upload to Google Drive if requested and forms were filled
            if (formData.uploadToDrive !== false && results.filled.length > 0) {
                try {
                    context.log('Uploading to Google Drive...');
                    const driveService = new GoogleDriveService();
                    
                    // Get file paths
                    const filePaths = results.filled.map(f => path.join(tempDir, f.filename));
                    
                    // Upload files
                    const uploadResult = await driveService.uploadPDFs(
                        filePaths, 
                        formData.driveFolderName || 'Subsidie Forms'
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
                } catch (error) {
                    context.log.error('Error uploading to Google Drive:', error);
                    results.errors.push({
                        form: 'google-drive',
                        error: error.message
                    });
                }
            }

            // Clean up temp files
            try {
                for (const file of results.filled) {
                    await fs.unlink(path.join(tempDir, file.filename));
                }
            } catch (error) {
                context.log.warn('Error cleaning up temp files:', error);
            }

            // Return results
            return {
                status: results.errors.length === 0 ? 200 : 207,
                body: JSON.stringify({
                    success: results.errors.length === 0,
                    message: `Filled ${results.filled.length} forms successfully`,
                    results: results
                }),
                headers: {
                    'Content-Type': 'application/json'
                }
            };

        } catch (error) {
            context.log.error('Unhandled error:', error);
            return {
                status: 500,
                body: JSON.stringify({
                    error: 'Internal server error',
                    message: error.message
                }),
                headers: {
                    'Content-Type': 'application/json'
                }
            };
        }
    }
});