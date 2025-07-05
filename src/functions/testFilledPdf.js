const { app } = require('@azure/functions');
const DocuSignService = require('../services/docusignService');
const { fillDeMinimisForm } = require('../services/fillDeMinimis');
const { v4: uuidv4 } = require('uuid');

app.http('testFilledPdf', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            // First, fill the form
            const formData = {
                selectedOption: 1,
                generalData: {
                    companyName: "Test Company BV",
                    kvkNumber: "12345678",
                    street: "Teststraat",
                    houseNumber: "123",
                    city: "Amsterdam",
                    postalCode: "1234AB",
                    signerName: "Jan Jansen",
                    date: "04-07-25"
                },
                addSignatureAnchors: false // No anchors for this test
            };
            
            const filledPdf = await fillDeMinimisForm(formData);
            context.log('PDF filled successfully');
            
            // Initialize DocuSign
            const docusign = new DocuSignService();
            await docusign.initialize();
            context.log('DocuSign initialized');
            
            // Create envelope with the filled PDF
            const testEnvelope = {
                emailSubject: 'Test Filled PDF',
                documents: [{
                    name: filledPdf.filename,
                    base64: filledPdf.pdfBytes.toString('base64')
                }],
                signers: [{
                    email: 'test@example.com',
                    name: 'Test Signer',
                    clientUserId: uuidv4(),
                    signatureTabs: [{
                        documentId: '1',
                        pageNumber: '1',
                        xPosition: '200',
                        yPosition: '100'
                    }]
                }]
            };
            
            context.log('Creating envelope...');
            const envelopeId = await docusign.createEnvelope(testEnvelope);
            
            return {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    success: true,
                    envelopeId: envelopeId,
                    message: 'Filled PDF envelope created successfully!'
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
                    details: error.response?.body || error.toString()
                })
            };
        }
    }
});