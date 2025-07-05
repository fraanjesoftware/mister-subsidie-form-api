const { PDFDocument } = require('pdf-lib');
const fs = require('fs').promises;
const path = require('path');

async function fillDeMinimisSimple(testCase = 'minimal') {
  try {
    // Load the existing PDF
    const pdfPath = path.join(__dirname, '../pdfs/1 de-minimisverklaring.pdf');
    const existingPdfBytes = await fs.readFile(pdfPath);
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    
    const form = pdfDoc.getForm();
    
    switch(testCase) {
      case 'minimal':
        // Just fill company name
        const field_2_1 = form.getTextField('2.1');
        field_2_1.setText('Test Company B.V.');
        break;
        
      case 'radio':
        // Just select radio button
        const radioGroup = form.getRadioGroup('1.1');
        radioGroup.select('Geen de-minimissteun is verleend');
        break;
        
      case 'radio-and-text':
        // Radio + one text field
        const radioGroup2 = form.getRadioGroup('1.1');
        radioGroup2.select('Geen de-minimissteun is verleend');
        const field_2_1_2 = form.getTextField('2.1');
        field_2_1_2.setText('Test Company B.V.');
        break;
        
      case 'all-fields':
        // Fill all fields like original
        const radioGroup3 = form.getRadioGroup('1.1');
        radioGroup3.select('Geen de-minimissteun is verleend');
        
        form.getTextField('2.1').setText('Test Company B.V.');
        form.getTextField('2.2').setText('12345678');
        form.getTextField('2.3').setText('Teststraat');
        form.getTextField('2.4').setText('123');
        form.getTextField('2.5').setText('Amsterdam');
        form.getTextField('2.6_PC').setText('1234AB');
        form.getTextField('2.7').setText('Test User');
        form.getTextField('2.8_DAT1').setText('05-01-25');
        break;
        
      case 'get-all-fields':
        // Test getting all fields like original (even unused ones)
        const radioGroup4 = form.getRadioGroup('1.1');
        const field_1_2 = form.getTextField('1.2');
        const field_1_3 = form.getTextField('1.3');
        const field_1_4 = form.getTextField('1.4');
        const field_2_1 = form.getTextField('2.1');
        const field_2_2 = form.getTextField('2.2');
        const field_2_3 = form.getTextField('2.3');
        const field_2_4 = form.getTextField('2.4');
        const field_2_5 = form.getTextField('2.5');
        const field_2_6_PC = form.getTextField('2.6_PC');
        const field_2_7 = form.getTextField('2.7');
        const field_2_8_DAT1 = form.getTextField('2.8_DAT1');
        
        // Now fill them
        radioGroup4.select('Geen de-minimissteun is verleend');
        field_2_1.setText('Test Company B.V.');
        field_2_2.setText('12345678');
        field_2_3.setText('Teststraat');
        field_2_4.setText('123');
        field_2_5.setText('Amsterdam');
        field_2_6_PC.setText('1234AB');
        field_2_7.setText('Test User');
        field_2_8_DAT1.setText('05-01-25');
        break;
    }
    
    // Save without flattening
    const pdfBytes = await pdfDoc.save();
    const outputFileName = `filled-de-minimis-${testCase}-${Date.now()}.pdf`;
    
    return {
      filename: outputFileName,
      pdfBytes: pdfBytes,
      testCase: testCase
    };
    
  } catch (error) {
    throw new Error(`Error in fillDeMinimisSimple: ${error.message}`);
  }
}

module.exports = { fillDeMinimisSimple };