const { app } = require('@azure/functions');
const { v4: uuidv4 } = require('uuid');
const DocuSignService = require('../services/docusignService');
const fs = require('fs').promises;
const path = require('path');
const { fillDeMinimisForm } = require('../services/fillDeMinimis');
const { fillMachtigingForm } = require('../services/fillMachtiging');
const { fillMKBForm } = require('../services/fillMKB');
const { 
    validateDeMinimisData, 
    validateMachtigingData, 
    validateMKBData 
} = require('../models/formModels');

app.http('createSigningSession', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log('createSigningSession function processing request');
        
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
            
            // Validate form type
            const validFormTypes = ['deMinimis', 'machtiging', 'mkb'];
            if (!requestBody.formType || !validFormTypes.includes(requestBody.formType)) {
                return {
                    status: 400,
                    body: JSON.stringify({
                        error: 'Invalid form type',
                        message: `Please provide a valid formType: ${validFormTypes.join(', ')}`
                    }),
                    headers: {
                        'Content-Type': 'application/json'
                    }
                };
            }
            
            // Validate form data based on type
            let validationErrors = [];
            if (requestBody.formType === 'deMinimis') {
                validationErrors = validateDeMinimisData(requestBody.formData || {});
            } else if (requestBody.formType === 'machtiging') {
                validationErrors = validateMachtigingData(requestBody.formData || {});
            } else if (requestBody.formType === 'mkb') {
                validationErrors = validateMKBData(requestBody.formData || {});
            }
            
            if (validationErrors.length > 0) {
                return {
                    status: 400,
                    body: JSON.stringify({
                        error: 'Invalid form data',
                        message: 'Form data validation failed',
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
            
            // Fill the appropriate form based on formType
            let pdfBase64;
            let pdfName;
            let pdfResult;
            
            try {
                context.log(`Processing ${requestBody.formType} form`);
                
                switch (requestBody.formType) {
                    case 'deMinimis':
                        pdfResult = await fillDeMinimisForm(requestBody.formData);
                        break;
                    case 'machtiging':
                        pdfResult = await fillMachtigingForm(requestBody.formData);
                        break;
                    case 'mkb':
                        pdfResult = await fillMKBForm(requestBody.formData);
                        break;
                }
                
                // Convert Uint8Array to Buffer if needed
                const pdfBuffer = Buffer.isBuffer(pdfResult.pdfBytes) 
                    ? pdfResult.pdfBytes 
                    : Buffer.from(pdfResult.pdfBytes);
                
                pdfBase64 = pdfBuffer.toString('base64');
                pdfName = pdfResult.filename;
                context.log(`Successfully filled ${requestBody.formType} PDF, size:`, pdfBuffer.length);
                
            } catch (error) {
                context.log(`Failed to fill ${requestBody.formType} PDF:`, error.message);
                return {
                    status: 500,
                    body: JSON.stringify({
                        error: 'Failed to generate PDF',
                        message: error.message,
                        formType: requestBody.formType
                    }),
                    headers: {
                        'Content-Type': 'application/json'
                    }
                };
            }
            
            // Generate unique client user ID for embedded signing
            const clientUserId = uuidv4();
            
            // Create documents array - EXACTLY like testMinimalEnvelope
            const documents = [{
                name: pdfName,
                base64: pdfBase64
            }];
            
            // Create signers array - EXACTLY like testMinimalEnvelope
            const signers = [{
                email: requestBody.signer.email,
                name: requestBody.signer.name,
                clientUserId: clientUserId,
                signatureTabs: [{
                    documentId: '1',
                    pageNumber: '1',
                    xPosition: '200',
                    yPosition: '100'
                }],
                dateSignedTabs: [{
                    documentId: '1',
                    pageNumber: '1',
                    xPosition: '350',
                    yPosition: '100'
                }]
            }];
            
            // Create envelope - EXACTLY like testMinimalEnvelope
            const envelopeId = await docusign.createEnvelope({
                emailSubject: 'Please sign your subsidy forms',
                emailMessage: 'Please review and sign the attached subsidy forms.',
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
                    message: `Signing session created successfully for ${requestBody.formType} form`
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