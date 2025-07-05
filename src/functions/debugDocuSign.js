const { app } = require('@azure/functions');
const DocuSignService = require('../services/docusignService');
const { v4: uuidv4 } = require('uuid');

app.http('debugDocuSign', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            context.log('Debug: Starting DocuSign test...');
            
            // Initialize DocuSign
            const docusign = new DocuSignService();
            await docusign.initialize();
            
            context.log('Debug: DocuSign initialized successfully');
            context.log('Debug: Account ID:', docusign.accountId);
            
            // Create a minimal test envelope with a proper PDF
            const minimalPdfBase64 = 'JVBERi0xLjUKJeLjz9MKNCAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCjUgMCBvYmoKPDwKL1R5cGUgL1BhZ2UKL1BhcmVudCAyIDAgUgovUmVzb3VyY2VzIDMgMCBSCi9NZWRpYUJveCBbMCAwIDYxMiA3OTJdCi9Db250ZW50cyA2IDAgUgo+PgplbmRvYmoKNiAwIG9iago8PAovTGVuZ3RoIDQ0Cj4+CnN0cmVhbQpCVApxCjcwIDUwIFRECi9GMSAxMiBUZgooVGVzdCBEb2N1bWVudCkgVGoKRVQKUQplbmRzdHJlYW0KZW5kb2JqCjIgMCBvYmoKPDwKL1R5cGUgL1BhZ2VzCi9LaWRzIFs1IDAgUl0KL0NvdW50IDEKL1Jlc291cmNlcyAzIDAgUgo+PgplbmRvYmoKMyAwIG9iago8PAovRm9udCA8PAovRjEgPDwKL1R5cGUgL0ZvbnQKL1N1YnR5cGUgL1R5cGUxCi9CYXNlRm9udCAvSGVsdmV0aWNhCj4+Cj4+Cj4+CmVuZG9iagp4cmVmCjAgNwowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMDkgMDAwMDAgbiAKMDAwMDAwMDI4MiAwMDAwMCBuIAowMDAwMDAwMzY2IDAwMDAwIG4gCjAwMDAwMDAwNTggMDAwMDAgbiAKMDAwMDAwMDExNSAwMDAwMCBuIAowMDAwMDAwMjM3IDAwMDAwIG4gCnRyYWlsZXIKPDwKL1NpemUgNwovUm9vdCA0IDAgUgo+PgpzdGFydHhyZWYKNDcwCiUlRU9G';
            
            const testEnvelope = {
                emailSubject: 'Test Document',
                documents: [{
                    name: 'test.pdf',
                    base64: minimalPdfBase64
                }],
                signers: [{
                    email: 'test@example.com',
                    name: 'Test Signer',
                    clientUserId: uuidv4(),
                    signatureTabs: [{
                        documentId: '1',
                        pageNumber: '1',
                        xPosition: '100',
                        yPosition: '100'
                    }]
                }]
            };
            
            context.log('Debug: Creating envelope with:', JSON.stringify(testEnvelope, null, 2));
            
            try {
                const envelopeId = await docusign.createEnvelope(testEnvelope);
                
                return {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        success: true,
                        envelopeId: envelopeId,
                        message: 'Envelope created successfully!'
                    })
                };
            } catch (envError) {
                context.log.error('Envelope creation error:', envError);
                
                // Try to get more error details
                let errorDetails = {
                    message: envError.message,
                    status: envError.response?.status,
                    statusText: envError.response?.statusText,
                    body: envError.response?.body,
                    headers: envError.response?.headers
                };
                
                return {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        error: 'Envelope creation failed',
                        details: errorDetails
                    })
                };
            }
            
        } catch (error) {
            context.log.error('Debug error:', error);
            return {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    error: 'Debug test failed',
                    message: error.message,
                    stack: error.stack
                })
            };
        }
    }
});