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
    
    // Fill section 1: Applicant/Beneficiary details (only when values exist)
    if (data.applicantData) {
      if (data.applicantData.companyName) {
        form.getTextField('1.1').setText(data.applicantData.companyName);
      }
      if (data.applicantData.email) {
        form.getTextField('1.2_EM').setText(data.applicantData.email);
      }
      if (data.applicantData.kvkNumber) {
        form.getTextField('1.3_C8').setText(data.applicantData.kvkNumber);
      }
      if (data.applicantData.contactPerson) {
        form.getTextField('1.4').setText(data.applicantData.contactPerson);
      }
      if (data.applicantData.contactEmail) {
        form.getTextField('1.5_EM').setText(data.applicantData.contactEmail);
      }
      if (data.applicantData.position) {
        form.getTextField('1.6').setText(data.applicantData.position);
      }
      if (data.applicantData.phoneNumber) {
        form.getTextField('1.7_TEL').setText(data.applicantData.phoneNumber);
      }
      if (data.applicantData.date) {
        form.getTextField('1.8_C8').setText(data.applicantData.date);
      }
    }
    
    // Fill section 2: Authorized representative details (only when values exist)
    if (data.representativeData) {
      if (data.representativeData.companyName) {
        form.getTextField('2.1').setText(data.representativeData.companyName);
      }
      if (data.representativeData.contactPerson) {
        form.getTextField('2.2').setText(data.representativeData.contactPerson);
      }
      if (data.representativeData.email) {
        form.getTextField('2.3').setText(data.representativeData.email);
      }
      if (data.representativeData.signDate1) {
        form.getTextField('2.4.1_DAT1').setText(data.representativeData.signDate1);
      }
      if (data.representativeData.name) {
        form.getTextField('2.5').setText(data.representativeData.name);
      }
      if (data.representativeData.position) {
        form.getTextField('2.6').setText(data.representativeData.position);
      }
      if (data.representativeData.phoneNumber) {
        form.getTextField('2.7').setText(data.representativeData.phoneNumber);
      }
      if (data.representativeData.signDate2) {
        form.getTextField('2.8.1_DAT1').setText(data.representativeData.signDate2);
      }
    }
    
    // Add signature anchors if requested
    if (data.addSignatureAnchors) {
      const pages = pdfDoc.getPages();
      const firstPage = pages[1]; // Machtiging form has signatures on first page
      
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