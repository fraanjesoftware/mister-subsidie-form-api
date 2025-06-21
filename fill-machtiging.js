const { PDFDocument } = require('pdf-lib');
const fs = require('fs');

async function fillMachtigingsformulier(data) {
  try {
    // Load the existing PDF
    const existingPdfBytes = fs.readFileSync('2 Machtigingsformulier leeg (1).pdf');
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
    
    // Fill section 1: Gegevens van de aanvrager/begunstigde (Applicant/Beneficiary details)
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
    
    // Fill section 2: Gegevens van de gemachtigde (Authorized representative details)
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
    
    // Save the filled PDF
    const pdfBytes = await pdfDoc.save();
    const outputFileName = `filled-machtiging-${Date.now()}.pdf`;
    fs.writeFileSync(outputFileName, pdfBytes);
    
    console.log(`Machtigingsformulier filled successfully! Saved as: ${outputFileName}`);
    
  } catch (error) {
    console.error('Error filling PDF:', error);
  }
}

// Example usage
async function runExample() {
  await fillMachtigingsformulier({
    applicantData: {
      companyName: 'Tech Innovatie B.V.',
      email: 'info@techinnovatie.nl',
      kvkNumber: '12345678', // Max 8 characters
      contactPerson: 'Jan de Vries',
      contactEmail: 'jan.devries@techinnovatie.nl',
      position: 'Directeur',
      phoneNumber: '0612345678', // Max 10 characters
      date: '21-06-25' // DD-MM-YY format, max 8 characters
    },
    representativeData: {
      companyName: 'Subsidie Adviseurs B.V.',
      contactPerson: 'Maria Janssen',
      email: 'maria@subsidieadviseurs.nl',
      signDate1: '21-06-25', // DD-MM-YY format
      name: 'Maria Janssen',
      position: 'Senior Adviseur',
      phoneNumber: '0687654321',
      signDate2: '21-06-25' // DD-MM-YY format
    }
  });
}

// Export the function for use in other modules
module.exports = { fillMachtigingsformulier };

// Run example if this file is executed directly
if (require.main === module) {
  runExample();
}