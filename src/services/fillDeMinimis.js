const { PDFDocument, rgb } = require('pdf-lib');
const fs = require('fs').promises;
const path = require('path');

async function fillDeMinimisForm(data, outputDir = null) {
  try {
    // Load the existing PDF from the pdfs directory
    const pdfPath = path.join(__dirname, '../pdfs/1 de-minimisverklaring.pdf');
    const existingPdfBytes = await fs.readFile(pdfPath);
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    
    // Get the form
    const form = pdfDoc.getForm();
    
    // Handle radio button selection
    const radioGroup = form.getRadioGroup('1.1');
    switch (data.selectedOption) {
      case 1: // Geen de-minimissteun is verleend
        radioGroup.select('Geen de-minimissteun is verleend');
        break;
        
      case 2: // Wel de-minimissteun is verleend, maar het drempelbedrag niet wordt overschreden
        radioGroup.select('Wel de-minimissteun is verleend, maar het drempelbedrag niet wordt overschreden');
        if (data.option2Data) {
          // Only get and fill fields when data exists
          if (data.option2Data.field_1_2) {
            form.getTextField('1.2').setText(data.option2Data.field_1_2);
          }
          if (data.option2Data.field_1_3) {
            form.getTextField('1.3').setText(data.option2Data.field_1_3);
          }
          if (data.option2Data.field_1_4) {
            form.getTextField('1.4').setText(data.option2Data.field_1_4);
          }
        }
        break;
        
      case 3: // al andere staatssteun is verleend voor dezelfde in aanmerking komende kosten
        radioGroup.select('al andere staatssteun is verleend voor dezelfde in aanmerking komende kosten');
        if (data.option3Data) {
          // Only get and fill fields when data exists
          if (data.option3Data.field_1_2) {
            form.getTextField('1.2').setText(data.option3Data.field_1_2);
          }
          if (data.option3Data.field_1_3) {
            form.getTextField('1.3').setText(data.option3Data.field_1_3);
          }
          if (data.option3Data.field_1_4) {
            form.getTextField('1.4').setText(data.option3Data.field_1_4);
          }
        }
        break;
        
      default:
        throw new Error('Invalid option selected. Please choose 1, 2, or 3.');
    }
    
    // Fill the general data fields (only when values exist)
    if (data.generalData) {
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
    
    // Add signature anchors if requested
    if (data.addSignatureAnchors) {
      const pages = pdfDoc.getPages();
      const lastPage = pages[pages.length - 1];
      
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
    
    // TEMPORARILY DISABLE FLATTEN - Testing if this causes DocuSign issues
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