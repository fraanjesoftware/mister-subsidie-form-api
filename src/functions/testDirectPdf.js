const { app } = require('@azure/functions');
const DocuSignService = require('../services/docusignService');
const { v4: uuidv4 } = require('uuid');

app.http('testDirectPdf', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            const requestBody = await request.json();
            
            // Initialize DocuSign
            const docusign = new DocuSignService();
            await docusign.initialize();
            
            // Simple test PDF base64 (same as working test endpoints)
            const testPdfBase64 = 'JVBERi0xLjUKJeLjz9MKNCAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCjUgMCBvYmoKPDwKL1R5cGUgL1BhZ2UKL1BhcmVudCAyIDAgUgovUmVzb3VyY2VzIDMgMCBSCi9NZWRpYUJveCBbMCAwIDYxMiA3OTJdCi9Db250ZW50cyA2IDAgUgo+PgplbmRvYmoKNiAwIG9iago8PAovTGVuZ3RoIDQ0Cj4+CnN0cmVhbQpCVApxCjcwIDUwIFRECi9GMSAxMiBUZgooVGVzdCBEb2N1bWVudCkgVGoKRVQKUQplbmRzdHJlYW0KZW5kb2JqCjIgMCBvYmoKPDwKL1R5cGUgL1BhZ2VzCi9LaWRzIFs1IDAgUl0KL0NvdW50IDEKL1Jlc291cmNlcyAzIDAgUgo+PgplbmRvYmoKMyAwIG9iago8PAovRm9udCA8PAovRjEgPDwKL1R5cGUgL0ZvbnQKL1N1YnR5cGUgL1R5cGUxCi9CYXNlRm9udCAvSGVsdmV0aWNhCj4+Cj4+Cj4+CmVuZG9iagp4cmVmCjAgNwowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMDkgMDAwMDAgbiAKMDAwMDAwMDI4MiAwMDAwMCBuIAowMDAwMDAwMzY2IDAwMDAwIG4gCjAwMDAwMDAwNTggMDAwMDAgbiAKMDAwMDAwMDExNSAwMDAwMCBuIAowMDAwMDAwMjM3IDAwMDAwIG4gCnRyYWlsZXIKPDwKL1NpemUgNwovUm9vdCA0IDAgUgo+PgpzdGFydHhyZWYKNDcwCiUlRU9G';
            
            const clientUserId = uuidv4();
            
            // Use the EXACT same structure as createSigningSession
            const documents = [{
                name: 'test-document.pdf',
                base64: testPdfBase64
            }];
            
            const signers = [{
                email: requestBody.signer?.email || 'test@example.com',
                name: requestBody.signer?.name || 'Test User',
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
            
            // Create envelope using the EXACT same method as createSigningSession
            const envelopeId = await docusign.createEnvelope({
                emailSubject: 'Please sign your subsidy forms',
                emailMessage: 'Please review and sign the attached subsidy forms.',
                documents: documents,
                signers: signers,
                status: 'sent'
            });
            
            // Get embedded signing URL
            const returnUrl = requestBody.returnUrl || 'https://example.com/signing-complete';
            const signingUrl = await docusign.getEmbeddedSigningUrl(
                envelopeId,
                signers[0].email,
                signers[0].name,
                clientUserId,
                returnUrl
            );
            
            return {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    success: true,
                    envelopeId: envelopeId,
                    signingUrl: signingUrl,
                    message: 'Test with direct PDF successful!'
                })
            };
            
        } catch (error) {
            context.log.error('Error:', error);
            return {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    error: 'Test failed',
                    message: error.message,
                    details: error.details || error.toString()
                })
            };
        }
    }
});