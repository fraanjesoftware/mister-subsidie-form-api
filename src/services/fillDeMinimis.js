const { PDFDocument, rgb } = require('pdf-lib');
const fs = require('fs').promises;
const path = require('path');

async function fillDeMinimisForm(data, outputDir = null) {
  try {
    // Load the existing PDF
        const pdfPath = path.join(__dirname, '../pdfs/1 de-minimisverklaring.pdf');
        const existingPdfBytes = await fs.readFile(pdfPath);
        const pdfDoc = await PDFDocument.load(existingPdfBytes);
        
        const form = pdfDoc.getForm();
    
        const radioGroup3 = form.getRadioGroup('1.1');
        
        // Fill general data from request
        if (data.generalData) {
            form.getTextField('2.1').setText(data.generalData.companyName || '');
            form.getTextField('2.2').setText(data.generalData.kvkNumber || '');
            form.getTextField('2.3').setText(data.generalData.street || '');
            form.getTextField('2.4').setText(data.generalData.houseNumber || '');
            form.getTextField('2.5').setText(data.generalData.city || '');
            form.getTextField('2.6_PC').setText(data.generalData.postalCode || '');
            form.getTextField('2.7').setText(data.generalData.signerName || '');
            form.getTextField('2.8_DAT1').setText(data.generalData.date || '');
        }
    
    // Conditional logic based on the selected option
    switch (data.selectedOption) {
      case 1: // Geen de-minimissteun is verleend
        radioGroup3.select('Geen de-minimissteun is verleend');
        break;
        
      case 2: // Wel de-minimissteun is verleend, maar het drempelbedrag niet wordt overschreden
        radioGroup3.select('Wel de-minimissteun is verleend, maar het drempelbedrag niet wordt overschreden');
        if (data.option2Data) {
          form.getTextField('1.2').setText(data.option2Data.field_1_2 || '');
          form.getTextField('1.3').setText(data.option2Data.field_1_3 || '');
          form.getTextField('1.4').setText(data.option2Data.field_1_4 || '');
        }
        break;
        
      case 3: // al andere staatssteun is verleend voor dezelfde in aanmerking komende kosten
        radioGroup3.select('al andere staatssteun is verleend voor dezelfde in aanmerking komende kosten');
        if (data.option3Data) {
          form.getTextField('1.2').setText(data.option3Data.field_1_2 || '');
          form.getTextField('1.3').setText(data.option3Data.field_1_3 || '');
          form.getTextField('1.4').setText(data.option3Data.field_1_4 || '');
        }
        break;
        
      default:
        throw new Error('Invalid option selected. Please choose 1, 2, or 3.');
    }
    
    
    // Add signature anchors if requested
    if (data.addSignatureAnchors) {
      const pages = pdfDoc.getPages();
      const lastPage = pages[pages.length - 1];
      
      // Add invisible text for DocuSign anchor
      // Position near where signature should go (adjust based on your form)
      const { height } = lastPage.getSize();
      
      // Add signature anchor (using very light gray instead of white)
      lastPage.drawText('/sig1/', {
        x: 205,
        y: 765, // Adjust based on where signature field should be
        size: 6, // Increased size for better detection
        color: rgb(0.95, 0.95, 0.95), // Very light gray (barely visible)
      });
      
      // Add date anchor next to signature
      lastPage.drawText('/date1/', {
        x: 192,
        y: 730,
        size: 6, // Increased size for better detection
        color: rgb(0.95, 0.95, 0.95), // Very light gray (barely visible)
      });
    }
    
    // DO NOT FLATTEN - DocuSign works better with unflattened forms
    // form.flatten();
    
    // Save the filled PDF
    const pdfBytes = await pdfDoc.save();
    const outputFileName = `filled-de-minimis-${Date.now()}.pdf`;
    
    // If outputDir is provided, save to disk (backward compatibility)
    if (outputDir) {
      const outputPath = path.join(outputDir, outputFileName);
      await fs.writeFile(outputPath, pdfBytes);
      return outputFileName;
    }
    
    // Otherwise return the PDF bytes and filename
    return {
      filename: outputFileName,
      pdfBytes: pdfBytes
    };
    
  } catch (error) {
    throw new Error(`Error filling De-minimis PDF: ${error.message}`);
  }
}

module.exports = { fillDeMinimisForm };