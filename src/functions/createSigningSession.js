const { app } = require('@azure/functions');
const { v4: uuidv4 } = require('uuid');

// Import services
const { fillDeMinimisForm } = require('../services/fillDeMinimis');
const { fillMachtigingsformulier } = require('../services/fillMachtiging');
const { fillMKBVerklaring } = require('../services/fillMKB');
const DocuSignService = require('../services/docusignService');

app.http('createSigningSession', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log('createSigningSession function processing request');
        
        let requestBody = null;

        try {
            // Parse request body
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

            // Validate request
            if (!requestBody || typeof requestBody !== 'object') {
                return {
                    status: 400,
                    body: JSON.stringify({
                        error: 'Invalid request body',
                        message: 'Request body must be a JSON object'
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
                        message: 'Please specify at least one form to fill'
                    }),
                    headers: {
                        'Content-Type': 'application/json'
                    }
                };
            }

            // Validate signer information
            if (!requestBody.signer || !requestBody.signer.email || !requestBody.signer.name) {
                return {
                    status: 400,
                    body: JSON.stringify({
                        error: 'Missing signer information',
                        message: 'Please provide signer email and name',
                        example: {
                            signer: {
                                email: 'signer@example.com',
                                name: 'John Doe'
                            }
                        }
                    }),
                    headers: {
                        'Content-Type': 'application/json'
                    }
                };
            }

            const results = {
                filled: [],
                errors: []
            };

            // Array to hold PDFs in memory
            const pdfFiles = [];

            // Fill De-minimis form
            if (requestBody.deMinimis) {
                try {
                    context.log('Processing De-minimis form for signing...');
                    
                    const result = await fillDeMinimisForm(requestBody.deMinimis);
                    
                    pdfFiles.push({
                        filename: result.filename,
                        pdfBytes: result.pdfBytes,
                        form: 'de-minimis'
                    });
                    
                    results.filled.push({
                        form: 'de-minimis',
                        filename: result.filename,
                        status: 'success'
                    });
                    context.log('De-minimis form filled successfully:', result.filename);
                } catch (error) {
                    context.log('ERROR: Error filling De-minimis form:', error);
                    results.errors.push({
                        form: 'de-minimis',
                        error: error.message
                    });
                }
            }

            // Fill Machtigingsformulier
            if (requestBody.machtiging) {
                try {
                    context.log('Processing Machtigingsformulier for signing...');
                    
                    const result = await fillMachtigingsformulier(requestBody.machtiging);
                    
                    pdfFiles.push({
                        filename: result.filename,
                        pdfBytes: result.pdfBytes,
                        form: 'machtiging'
                    });
                    
                    results.filled.push({
                        form: 'machtiging',
                        filename: result.filename,
                        status: 'success'
                    });
                    context.log('Machtigingsformulier filled successfully:', result.filename);
                } catch (error) {
                    context.log('ERROR: Error filling Machtigingsformulier:', error);
                    results.errors.push({
                        form: 'machtiging',
                        error: error.message
                    });
                }
            }

            // Fill MKB Verklaring
            if (requestBody.mkbVerklaring) {
                try {
                    context.log('Processing MKB Verklaring for signing...');
                    
                    const result = await fillMKBVerklaring(requestBody.mkbVerklaring);
                    
                    pdfFiles.push({
                        filename: result.filename,
                        pdfBytes: result.pdfBytes,
                        form: 'mkb-verklaring'
                    });
                    
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
                        error: error.message
                    });
                }
            }

            // Check if any forms were filled successfully
            if (pdfFiles.length === 0) {
                return {
                    status: 400,
                    body: JSON.stringify({
                        error: 'No forms filled successfully',
                        results: results
                    }),
                    headers: {
                        'Content-Type': 'application/json'
                    }
                };
            }

            // Create DocuSign envelope
            try {
                context.log('Creating DocuSign envelope...');
                
                const docusign = new DocuSignService();
                
                // Debug: Check RSA key format
                const keyDebug = {
                    hasKey: !!process.env.DOCUSIGN_RSA_PRIVATE_KEY,
                    keyLength: process.env.DOCUSIGN_RSA_PRIVATE_KEY?.length || 0,
                    hasBeginMarker: process.env.DOCUSIGN_RSA_PRIVATE_KEY?.includes('BEGIN RSA') || false,
                    hasNewlines: process.env.DOCUSIGN_RSA_PRIVATE_KEY?.includes('\n') || false
                };
                context.log('RSA Key Debug:', keyDebug);
                
                await docusign.initialize();
                
                // Generate unique client user ID for embedded signing
                const clientUserId = uuidv4();
                
                // Prepare documents for DocuSign
                const documents = pdfFiles.map((pdf, index) => ({
                    name: pdf.filename,
                    base64: pdf.pdfBytes.toString('base64')
                }));
                
                // Create signers with tabs for each document
                const signatureTabs = [];
                const dateSignedTabs = [];
                
                // For each document, create appropriate signature tabs
                pdfFiles.forEach((pdf, index) => {
                    const documentId = String(index + 1);
                    
                    // All forms use absolute positioning for now
                    signatureTabs.push({
                        documentId: documentId,
                        pageNumber: '1',
                        xPosition: '200',
                        yPosition: '100'
                    });
                    dateSignedTabs.push({
                        documentId: documentId,
                        pageNumber: '1',
                        xPosition: '350',
                        yPosition: '100'
                    });
                });
                
                const signers = [{
                    email: requestBody.signer.email,
                    name: requestBody.signer.name,
                    clientUserId: clientUserId, // Required for embedded signing
                    signatureTabs: signatureTabs,
                    dateSignedTabs: dateSignedTabs
                }];
                
                // Add custom fields to store metadata for webhook
                const customFields = {
                    textCustomFields: [
                        {
                            name: 'uploadToDrive',
                            value: String(requestBody.uploadToDrive !== false),
                            show: 'false'
                        },
                        {
                            name: 'driveFolderName',
                            value: requestBody.driveFolderName || 'Signed Subsidy Forms',
                            show: 'false'
                        },
                        {
                            name: 'signerEmail',
                            value: requestBody.signer.email,
                            show: 'false'
                        }
                    ]
                };
                
                // Create the envelope
                const envelopeId = await docusign.createEnvelope({
                    emailSubject: requestBody.emailSubject || 'Please sign your subsidy forms',
                    emailMessage: requestBody.emailMessage || 'Please review and sign the attached subsidy forms.',
                    documents: documents,
                    signers: signers,
                    customFields: customFields,
                    status: 'sent'
                });
                
                context.log('Envelope created:', envelopeId);
                
                // Get embedded signing URL
                const returnUrl = requestBody.returnUrl || 'https://yourapp.com/signing-complete';
                const signingUrl = await docusign.getEmbeddedSigningUrl(
                    envelopeId,
                    requestBody.signer.email,
                    requestBody.signer.name,
                    clientUserId,
                    returnUrl
                );
                
                context.log('Embedded signing URL generated');
                
                // Return success response - no session tracking needed!
                return {
                    status: 200,
                    body: JSON.stringify({
                        success: true,
                        envelopeId: envelopeId,
                        signingUrl: signingUrl,
                        expiresIn: 300, // 5 minutes
                        forms: results.filled,
                        message: 'Signing session created successfully. Use the signingUrl in an iframe for embedded signing.'
                    }),
                    headers: {
                        'Content-Type': 'application/json'
                    }
                };
                
            } catch (error) {
                context.log('ERROR: Error creating DocuSign envelope:', error);
                context.log('ERROR Details:', JSON.stringify(error.details || {}, null, 2));
                
                return {
                    status: 500,
                    body: JSON.stringify({
                        error: 'Failed to create signing session',
                        message: error.message,
                        details: error.details || {},
                        results: results
                    }),
                    headers: {
                        'Content-Type': 'application/json'
                    }
                };
            }

        } catch (error) {
            // Log full error details
            context.log('ERROR: Unhandled error in createSigningSession:', {
                message: error.message,
                stack: error.stack,
                name: error.name
            });

            // Return error response
            return {
                status: 500,
                body: JSON.stringify({
                    error: 'Internal server error',
                    message: error.message,
                    timestamp: new Date().toISOString()
                }),
                headers: {
                    'Content-Type': 'application/json'
                }
            };
        }
    }
});