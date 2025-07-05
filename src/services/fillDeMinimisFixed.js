const { PDFDocument } = require('pdf-lib');
const fs = require('fs').promises;
const path = require('path');

async function fillDeMinimisFixed(data, outputDir = null) {
  try {
    // Load the existing PDF from the pdfs directory
    const pdfPath = path.join(__dirname, '../pdfs/1 de-minimisverklaring.pdf');
    const existingPdfBytes = await fs.readFile(pdfPath);
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    
    // Get the form
    const form = pdfDoc.getForm();
    
    // Fill radio button
    const radioGroup = form.getRadioGroup('1.1');
    switch (data.selectedOption) {
      case 1:
        radioGroup.select('Geen de-minimissteun is verleend');
        break;
      case 2:
        radioGroup.select('Wel de-minimissteun is verleend, maar het drempelbedrag niet wordt overschreden');
        break;
      case 3:
        radioGroup.select('al andere staatssteun is verleend voor dezelfde in aanmerking komende kosten');
        break;
      default:
        throw new Error('Invalid option selected. Please choose 1, 2, or 3.');
    }
    
    // Fill general data fields (always filled)
    if (data.generalData) {
      // Only set text if value is provided (avoid empty strings)
      if (data.generalData.companyName) {
        form.getTextField('2.1').setText(data.generalData.companyName);
      }
      if (data.generalData.kvkNumber) {
        form.getTextField('2.2').setText(data.generalData.kvkNumber);
      }
      if (data.generalData.street) {
        form.getTextField('2.3').setText(data.generalData.street);
      }
      if (data.generalData.houseNumber) {
        form.getTextField('2.4').setText(data.generalData.houseNumber);
      }
      if (data.generalData.city) {
        form.getTextField('2.5').setText(data.generalData.city);
      }
      if (data.generalData.postalCode) {
        form.getTextField('2.6_PC').setText(data.generalData.postalCode);
      }
      if (data.generalData.signerName) {
        form.getTextField('2.7').setText(data.generalData.signerName);
      }
      if (data.generalData.date) {
        form.getTextField('2.8_DAT1').setText(data.generalData.date);
      }
    }
    
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

module.exports = { fillDeMinimisFixed };