const { app } = require('@azure/functions');
const { PDFDocument } = require('pdf-lib');
const fs = require('fs').promises;
const path = require('path');
const DocuSignService = require('../services/docusignService');
const { v4: uuidv4 } = require('uuid');

app.http('testMinimalFormFill', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            const requestBody = await request.json();
            const testNumber = requestBody.test || 1;
            
            const docusign = new DocuSignService();
            await docusign.initialize();
            
            // Load the de-minimis PDF
            const pdfPath = path.join(__dirname, '../pdfs/1 de-minimisverklaring.pdf');
            const existingPdfBytes = await fs.readFile(pdfPath);
            const pdfDoc = await PDFDocument.load(existingPdfBytes);
            
            let testDescription = '';
            
            switch(testNumber) {
                case 1:
                    // Test 1: Just load and save (no modifications)
                    testDescription = 'No modifications - just load and save';
                    break;
                    
                case 2:
                    // Test 2: Get form but don't fill anything
                    const form = pdfDoc.getForm();
                    testDescription = 'Got form reference but made no changes';
                    break;
                    
                case 3:
                    // Test 3: Fill just one field
                    const form3 = pdfDoc.getForm();
                    const companyField = form3.getTextField('2.1');
                    companyField.setText('Test Company');
                    testDescription = 'Filled only company name field';
                    break;
                    
                case 4:
                    // Test 4: Fill one field and flatten
                    const form4 = pdfDoc.getForm();
                    const companyField4 = form4.getTextField('2.1');
                    companyField4.setText('Test Company');
                    form4.flatten();
                    testDescription = 'Filled company name and flattened';
                    break;
            }
            
            // Save the PDF
            const pdfBytes = await pdfDoc.save();
            const pdfBase64 = Buffer.from(pdfBytes).toString('base64');
            
            context.log(`Test ${testNumber}: ${testDescription}, PDF size: ${pdfBytes.length}`);
            
            // Create envelope
            const clientUserId = uuidv4();
            const documents = [{
                name: `test-${testNumber}.pdf`,
                base64: pdfBase64
            }];
            
            const signers = [{
                email: 'test@example.com',
                name: 'Test User',
                clientUserId: clientUserId,
                signatureTabs: [{
                    documentId: '1',
                    pageNumber: '1',
                    xPosition: '200',
                    yPosition: '100'
                }]
            }];
            
            const envelopeId = await docusign.createEnvelope({
                emailSubject: `Test ${testNumber}: ${testDescription}`,
                emailMessage: 'Testing minimal form modifications',
                documents: documents,
                signers: signers,
                status: 'sent'
            });
            
            return {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    success: true,
                    envelopeId: envelopeId,
                    test: testNumber,
                    description: testDescription,
                    message: `Test ${testNumber} successful!`
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
                    details: error.details || {}
                })
            };
        }
    }
});