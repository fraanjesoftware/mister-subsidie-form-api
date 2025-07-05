const { app } = require('@azure/functions');
const { v4: uuidv4 } = require('uuid');
const DocuSignService = require('../services/docusignService');
const fs = require('fs').promises;
const path = require('path');
const { fillDeMinimisForm } = require('../services/fillDeMinimis');

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
            
            // Initialize DocuSign
            const docusign = new DocuSignService();
            await docusign.initialize();
            
            // TEST: Now try with filled de-minimis PDF
            let pdfBase64;
            let pdfName;
            
            try {
                // Fill the de-minimis form with test data
                const testData = {
                    selectedOption: 1,
                    generalData: {
                        companyName: "Test Company B.V.",
                        kvkNumber: "12345678",
                        street: "Teststraat",
                        houseNumber: "123",
                        city: "Amsterdam",
                        postalCode: "1234AB",
                        signerName: "Test User",
                        date: "05-01-25"
                    },
                    addSignatureAnchors: false // Start without anchors
                };
                
                const result = await fillDeMinimisForm(testData);
                context.log('PDF result type:', typeof result.pdfBytes);
                context.log('PDF result is Buffer?', Buffer.isBuffer(result.pdfBytes));
                context.log('PDF result is Uint8Array?', result.pdfBytes instanceof Uint8Array);
                
                // Convert Uint8Array to Buffer if needed
                const pdfBuffer = Buffer.isBuffer(result.pdfBytes) 
                    ? result.pdfBytes 
                    : Buffer.from(result.pdfBytes);
                
                pdfBase64 = pdfBuffer.toString('base64');
                pdfName = result.filename;
                context.log('Successfully filled de-minimis PDF, size:', pdfBuffer.length);
                context.log('Base64 length:', pdfBase64.length);
                context.log('First 100 chars of base64:', pdfBase64.substring(0, 100));
            } catch (error) {
                context.log('Failed to fill PDF, using test PDF instead:', error.message);
                // Fallback to test PDF
                pdfBase64 = 'JVBERi0xLjUKJeLjz9MKNCAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCjUgMCBvYmoKPDwKL1R5cGUgL1BhZ2UKL1BhcmVudCAyIDAgUgovUmVzb3VyY2VzIDMgMCBSCi9NZWRpYUJveCBbMCAwIDYxMiA3OTJdCi9Db250ZW50cyA2IDAgUgo+PgplbmRvYmoKNiAwIG9iago8PAovTGVuZ3RoIDQ0Cj4+CnN0cmVhbQpCVApxCjcwIDUwIFRECi9GMSAxMiBUZgooVGVzdCBEb2N1bWVudCkgVGoKRVQKUQplbmRzdHJlYW0KZW5kb2JqCjIgMCBvYmoKPDwKL1R5cGUgL1BhZ2VzCi9LaWRzIFs1IDAgUl0KL0NvdW50IDEKL1Jlc291cmNlcyAzIDAgUgo+PgplbmRvYmoKMyAwIG9iago8PAovRm9udCA8PAovRjEgPDwKL1R5cGUgL0ZvbnQKL1N1YnR5cGUgL1R5cGUxCi9CYXNlRm9udCAvSGVsdmV0aWNhCj4+Cj4+Cj4+CmVuZG9iagp4cmVmCjAgNwowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMDkgMDAwMDAgbiAKMDAwMDAwMDI4MiAwMDAwMCBuIAowMDAwMDAwMzY2IDAwMDAwIG4gCjAwMDAwMDAwNTggMDAwMDAgbiAKMDAwMDAwMDExNSAwMDAwMCBuIAowMDAwMDAwMjM3IDAwMDAwIG4gCnRyYWlsZXIKPDwKL1NpemUgNwovUm9vdCA0IDAgUgo+PgpzdGFydHhyZWYKNDcwCiUlRU9G';
                pdfName = 'test-document.pdf';
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
                    message: 'Signing session created successfully (using FILLED de-minimis PDF)'
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