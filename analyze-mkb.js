const { PDFDocument } = require('pdf-lib');
const fs = require('fs');

async function analyzePDF() {
  try {
    // Load the PDF
    const existingPdfBytes = fs.readFileSync('3 MKB+verklaring+SLIM (1).pdf');
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    
    // Get the form
    const form = pdfDoc.getForm();
    
    // Get all fields
    const fields = form.getFields();
    
    console.log('Total fields found:', fields.length);
    console.log('\nField details:');
    
    fields.forEach((field, index) => {
      const type = field.constructor.name;
      const name = field.getName();
      console.log(`\nField ${index + 1}:`);
      console.log(`  Name: ${name}`);
      console.log(`  Type: ${type}`);
      
      // If it's a text field, show if it's multiline
      if (type === 'PDFTextField') {
        console.log(`  Multiline: ${field.isMultiline()}`);
        const maxLength = field.getMaxLength();
        console.log(`  Max Length: ${maxLength || 'No limit'}`);
      }
      
      // If it's a radio group, show the options
      if (type === 'PDFRadioGroup') {
        const options = field.getOptions();
        console.log(`  Options: ${options.join(', ')}`);
      }
      
      // If it's a checkbox
      if (type === 'PDFCheckBox') {
        console.log(`  Checkbox field`);
      }
    });
    
    // Also check total pages to understand the structure
    console.log(`\nTotal pages: ${pdfDoc.getPageCount()}`);
    
  } catch (error) {
    console.error('Error analyzing PDF:', error);
  }
}

analyzePDF();