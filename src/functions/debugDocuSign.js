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
            
            // Create a minimal test envelope
            const testEnvelope = {
                emailSubject: 'Test Document',
                documents: [{
                    name: 'test.pdf',
                    base64: 'JVBERi0xLjQKJeLjz9MKMyAwIG9iago8PC9UeXBlL1hPYmplY3QvU3VidHlwZS9JbWFnZS9XaWR0aCAxL0hlaWdodCAxL0JpdHNQZXJDb21wb25lbnQgOC9Db2xvclNwYWNlL0RldmljZVJHQi9GaWx0ZXIvRmxhdGVEZWNvZGUvTGVuZ3RoIDEyPj5zdHJlYW0KeJztwTEBAAAAwqD1T20LL6AAAAAAAA4GQAABAAZ' // Minimal valid PDF
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