const { app } = require('@azure/functions');
const { PDFDocument } = require('pdf-lib');
const fs = require('fs').promises;
const path = require('path');
const DocuSignService = require('../services/docusignService');
const { v4: uuidv4 } = require('uuid');

app.http('testPdfFormIssue', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            const docusign = new DocuSignService();
            await docusign.initialize();
            
            // Test 1: Load PDF with pdf-lib but don't modify it
            const pdfPath = path.join(__dirname, '../pdfs/1 de-minimisverklaring.pdf');
            const existingPdfBytes = await fs.readFile(pdfPath);
            const pdfDoc = await PDFDocument.load(existingPdfBytes);
            
            // Just save it without any modifications
            const pdfBytes = await pdfDoc.save();
            const pdfBase64 = Buffer.from(pdfBytes).toString('base64');
            
            context.log('PDF loaded and saved with pdf-lib, size:', pdfBytes.length);
            
            const clientUserId = uuidv4();
            const documents = [{
                name: 'test-pdf-form-issue.pdf',
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
                emailSubject: 'Test PDF Form Issue',
                emailMessage: 'Testing PDF loaded with pdf-lib',
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
                    message: 'PDF loaded with pdf-lib (no modifications) works!'
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