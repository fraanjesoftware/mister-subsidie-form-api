const { PDFDocument, rgb } = require('pdf-lib');
const fs = require('fs').promises;
const path = require('path');

async function fillMachtigingsformulier(data, outputDir = null) {
  try {
    // Load the existing PDF
    const pdfPath = path.join(__dirname, '../pdfs/2 Machtigingsformulier leeg.pdf');
    const existingPdfBytes = await fs.readFile(pdfPath);
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    
    // Get the form
    const form = pdfDoc.getForm();
    
    // Get all text fields
    const field_1_1 = form.getTextField('1.1');
    const field_1_2_EM = form.getTextField('1.2_EM');
    const field_1_3_C8 = form.getTextField('1.3_C8');
    const field_1_4 = form.getTextField('1.4');
    const field_1_5_EM = form.getTextField('1.5_EM');
    const field_1_6 = form.getTextField('1.6');
    const field_1_7_TEL = form.getTextField('1.7_TEL');
    const field_1_8_C8 = form.getTextField('1.8_C8');
    const field_2_1 = form.getTextField('2.1');
    const field_2_2 = form.getTextField('2.2');
    const field_2_3 = form.getTextField('2.3');
    const field_2_4_1_DAT1 = form.getTextField('2.4.1_DAT1');
    const field_2_5 = form.getTextField('2.5');
    const field_2_6 = form.getTextField('2.6');
    const field_2_7 = form.getTextField('2.7');
    const field_2_8_1_DAT1 = form.getTextField('2.8.1_DAT1');
    
    // Fill section 1: Applicant/Beneficiary details
    if (data.applicantData) {
      field_1_1.setText(data.applicantData.companyName || '');
      field_1_2_EM.setText(data.applicantData.email || '');
      field_1_3_C8.setText(data.applicantData.kvkNumber || ''); // Max 8 chars
      field_1_4.setText(data.applicantData.contactPerson || '');
      field_1_5_EM.setText(data.applicantData.contactEmail || '');
      field_1_6.setText(data.applicantData.position || '');
      field_1_7_TEL.setText(data.applicantData.phoneNumber || ''); // Max 10 chars
      field_1_8_C8.setText(data.applicantData.date || ''); // Max 8 chars (DD-MM-YY)
    }
    
    // Fill section 2: Authorized representative details
    if (data.representativeData) {
      field_2_1.setText(data.representativeData.companyName || '');
      field_2_2.setText(data.representativeData.contactPerson || '');
      field_2_3.setText(data.representativeData.email || '');
      field_2_4_1_DAT1.setText(data.representativeData.signDate1 || ''); // Max 8 chars
      field_2_5.setText(data.representativeData.name || '');
      field_2_6.setText(data.representativeData.position || '');
      field_2_7.setText(data.representativeData.phoneNumber || '');
      field_2_8_1_DAT1.setText(data.representativeData.signDate2 || ''); // Max 8 chars
    }
    
    // Add signature anchors if requested
    if (data.addSignatureAnchors) {
      const pages = pdfDoc.getPages();
      const firstPage = pages[1]; // Machtiging form has signatures on first page
      
      // Add invisible text for DocuSign anchor
      const { height } = firstPage.getSize();
      
      // Add first signature anchor for applicant (adjust Y position based on form layout)
      firstPage.drawText('/sig1/', {
        x: 380,
        y: 280, // Adjust based on where applicant signature field should be
        size: 1,
        color: rgb(1, 1, 1), // White text (invisible on white background)
      });
      
      // Add date anchor next to first signature
      firstPage.drawText('/date1/', {
        x: 190,
        y: 200,
        size: 1,
        color: rgb(1, 1, 1),
      });
      
      // Add second signature anchor for representative
      firstPage.drawText('/sig2/', {
        x: 380,
        y: 328, // Adjust based on where representative signature field should be
        size: 1,
        color: rgb(1, 1, 1),
      });
      
      // Add date anchor next to second signature
      firstPage.drawText('/date2/', {
        x: 190,
        y: 328,
        size: 1,
        color: rgb(1, 1, 1),
      });
    }
    
    // Save the filled PDF
    const pdfBytes = await pdfDoc.save();
    const outputFileName = `filled-machtiging-${Date.now()}.pdf`;
    
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
    throw new Error(`Error filling Machtigingsformulier: ${error.message}`);
  }
}

module.exports = { fillMachtigingsformulier };