const { app } = require('@azure/functions');
const { v4: uuidv4 } = require('uuid');
const DocuSignService = require('../services/docusignService');
const { fillDeMinimisForm } = require('../services/fillDeMinimis');
const { validateDeMinimisData } = require('../models/formModels');

app.http('createDeMinimisSession', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log('createDeMinimisSession function processing request');
        
        try {
            // Parse request body
            const requestBody = await request.json();
            
            // Basic validation
            if (!requestBody.signer || !requestBody.signer.email || !requestBody.signer.name) {
                return {
                    status: 400,
                    body: JSON.stringify({
                        error: 'Missing signer information',
                        message: 'Please provide signer email and name'
                    }),
                    headers: {
                        'Content-Type': 'application/json'
                    }
                };
            }
            
            // Validate De Minimis form data
            const validationErrors = validateDeMinimisData(requestBody.formData || {});
            
            if (validationErrors.length > 0) {
                return {
                    status: 400,
                    body: JSON.stringify({
                        error: 'Invalid form data',
                        message: 'De Minimis form data validation failed',
                        validationErrors: validationErrors
                    }),
                    headers: {
                        'Content-Type': 'application/json'
                    }
                };
            }
            
            // Initialize DocuSign
            const docusign = new DocuSignService();
            await docusign.initialize();
            
            // Fill the De Minimis form
            let pdfBase64;
            let pdfName;
            
            try {
                context.log('Processing De Minimis form');
                const pdfResult = await fillDeMinimisForm(requestBody.formData);
                
                // Convert Uint8Array to Buffer if needed
                const pdfBuffer = Buffer.isBuffer(pdfResult.pdfBytes) 
                    ? pdfResult.pdfBytes 
                    : Buffer.from(pdfResult.pdfBytes);
                
                pdfBase64 = pdfBuffer.toString('base64');
                pdfName = pdfResult.filename;
                context.log('Successfully filled De Minimis PDF, size:', pdfBuffer.length);
                
            } catch (error) {
                context.log('Failed to fill De Minimis PDF:', error.message);
                return {
                    status: 500,
                    body: JSON.stringify({
                        error: 'Failed to generate PDF',
                        message: error.message,
                        formType: 'deMinimis'
                    }),
                    headers: {
                        'Content-Type': 'application/json'
                    }
                };
            }
            
            // Generate unique client user ID for embedded signing
            const clientUserId = uuidv4();
            
            // Create documents array
            const documents = [{
                name: pdfName,
                base64: pdfBase64
            }];
            
            // Create signers array with signature anchors if needed
            const signers = [{
                email: requestBody.signer.email,
                name: requestBody.signer.name,
                clientUserId: clientUserId,
                signatureTabs: requestBody.formData.addSignatureAnchors ? [] : [{
                    documentId: '1',
                    pageNumber: '1',
                    xPosition: '200',
                    yPosition: '100'
                }],
                dateSignedTabs: requestBody.formData.addSignatureAnchors ? [] : [{
                    documentId: '1',
                    pageNumber: '1',
                    xPosition: '350',
                    yPosition: '100'
                }]
            }];
            
            // Create envelope
            const envelopeId = await docusign.createEnvelope({
                emailSubject: 'Please sign your De Minimis declaration',
                emailMessage: 'Please review and sign the attached De Minimis declaration form.',
                documents: documents,
                signers: signers,
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
            
            // Return success response
            return {
                status: 200,
                body: JSON.stringify({
                    success: true,
                    envelopeId: envelopeId,
                    signingUrl: signingUrl,
                    expiresIn: 300, // 5 minutes
                    message: 'De Minimis signing session created successfully',
                    formType: 'deMinimis'
                }),
                headers: {
                    'Content-Type': 'application/json'
                }
            };
            
        } catch (error) {
            context.log('ERROR:', error);
            return {
                status: 500,
                body: JSON.stringify({
                    error: 'Failed to create signing session',
                    message: error.message,
                    details: error.details || {}
                }),
                headers: {
                    'Content-Type': 'application/json'
                }
            };
        }
    }
});