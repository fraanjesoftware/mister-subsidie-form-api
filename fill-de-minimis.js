const { PDFDocument } = require('pdf-lib');
const fs = require('fs');

async function fillDeMinimisForm(data) {
  try {
    // Load the existing PDF
    const existingPdfBytes = fs.readFileSync('1 de-minimisverklaring (1).pdf');
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    
    // Get the form
    const form = pdfDoc.getForm();
    
    // Get fields
    const radioGroup = form.getRadioGroup('1.1');
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
    
    // Conditional logic based on the selected option
    switch (data.selectedOption) {
      case 1: // Geen de-minimissteun is verleend
        radioGroup.select('Geen de-minimissteun is verleend');
        // No additional fields needed for option 1
        break;
        
      case 2: // Wel de-minimissteun is verleend, maar het drempelbedrag niet wordt overschreden
        radioGroup.select('Wel de-minimissteun is verleend, maar het drempelbedrag niet wordt overschreden');
        // Fill fields for option 2
        if (data.option2Data) {
          field_1_2.setText(data.option2Data.field_1_2 || '');
      
        }
        break;
        
      case 3: // al andere staatssteun is verleend voor dezelfde in aanmerking komende kosten
        radioGroup.select('al andere staatssteun is verleend voor dezelfde in aanmerking komende kosten');
        // Fill fields for option 3
        if (data.option3Data) {
          field_1_3.setText(data.option3Data.field_1_3 || '');
          field_1_4.setText(data.option3Data.field_1_4 || '');
        }
        break;
        
      default:
        console.error('Invalid option selected. Please choose 1, 2, or 3.');
        return;
    }
    
    // Fill the section below checkboxes (always filled)
    if (data.generalData) {
      field_2_1.setText(data.generalData.companyName || '');
      field_2_2.setText(data.generalData.kvkNumber || '');
      field_2_3.setText(data.generalData.street || '');
      field_2_4.setText(data.generalData.houseNumber || '');
      field_2_5.setText(data.generalData.city || '');
      field_2_6_PC.setText(data.generalData.postalCode || '');
      field_2_7.setText(data.generalData.signerName || '');
      field_2_8_DAT1.setText(data.generalData.date || '');
    }
    
    // Save the filled PDF
    const pdfBytes = await pdfDoc.save();
    const outputFileName = `filled-de-minimis-${Date.now()}.pdf`;
    fs.writeFileSync(outputFileName, pdfBytes);
    
    console.log(`PDF filled successfully! Saved as: ${outputFileName}`);
    
  } catch (error) {
    console.error('Error filling PDF:', error);
  }
}

// Example usage with different scenarios
async function runExamples() {
  // Example 1: No de-minimis support provided
  console.log('\nExample 1: No de-minimis support');
  await fillDeMinimisForm({
    selectedOption: 1,
    generalData: {
      companyName: 'ABC Bedrijf B.V.',
      kvkNumber: '12345678',
      street: 'Hoofdstraat',
      houseNumber: '123',
      city: 'Amsterdam',
      postalCode: '1234AB',
      signerName: 'Jan Jansen',
      date: '21-06-25'
    }
  });
  
  // Example 2: De-minimis support provided but threshold not exceeded
  console.log('\nExample 2: De-minimis support provided but threshold not exceeded');
  await fillDeMinimisForm({
    selectedOption: 2,
    option2Data: {
      field_1_2: 'Subsidie voor innovatie',
      field_1_3: '15000',
      field_1_4: '01-01-2024'
    },
    generalData: {
      companyName: 'XYZ Innovatie B.V.',
      kvkNumber: '87654321',
      street: 'Innovatielaan',
      houseNumber: '45',
      city: 'Utrecht',
      postalCode: '3500AB',
      signerName: 'Maria de Vries',
      date: '21-06-25'
    }
  });
  
  // Example 3: Other state aid provided for same eligible costs
  console.log('\nExample 3: Other state aid provided');
  await fillDeMinimisForm({
    selectedOption: 3,
    option3Data: {
      field_1_2: 'WBSO regeling',
      field_1_3: '25000',
      field_1_4: '15-03-2024'
    },
    generalData: {
      companyName: 'Tech Solutions B.V.',
      kvkNumber: '11223344',
      street: 'Technopark',
      houseNumber: '789',
      city: 'Eindhoven',
      postalCode: '5600CD',
      signerName: 'Peter Bakker',
      date: '21-06-25'
    }
  });
}

// Export the function for use in other modules
module.exports = { fillDeMinimisForm };

// Run examples if this file is executed directly
if (require.main === module) {
  runExamples();
}