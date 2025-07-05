const { app } = require('@azure/functions');
const { fillDeMinimisForm } = require('../services/fillDeMinimis');

app.http('testPdfAnchors', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            // Fill form with anchors
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
                addSignatureAnchors: true
            };
            
            const result = await fillDeMinimisForm(formData);
            
            // Return the PDF as base64 so we can inspect it
            return {
                status: 200,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    success: true,
                    filename: result.filename,
                    pdfBase64: result.pdfBytes.toString('base64'),
                    message: 'PDF created with signature anchors. Download and search for /sig1/ and /date1/'
                })
            };
            
        } catch (error) {
            context.log.error('Error:', error);
            return {
                status: 500,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    error: 'Failed to create PDF',
                    message: error.message
                })
            };
        }
    }
});