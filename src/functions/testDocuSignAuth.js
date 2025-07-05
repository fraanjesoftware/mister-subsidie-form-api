const { app } = require('@azure/functions');
const DocuSignService = require('../services/docusignService');

app.http('testDocuSignAuth', {
    methods: ['GET', 'POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            context.log('Testing DocuSign authentication...');
            
            const docusign = new DocuSignService();
            await docusign.initialize();
            
            return {
                status: 200,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    success: true,
                    message: 'DocuSign authentication successful',
                    accountId: docusign.accountId,
                    basePath: docusign.apiClient.basePath
                })
            };
            
        } catch (error) {
            context.log.error('Auth test error:', error);
            return {
                status: 500,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    error: 'Authentication failed',
                    message: error.message,
                    details: error.response?.body || error.toString()
                })
            };
        }
    }
});