const { PDFDocument } = require('pdf-lib');
const fs = require('fs');

async function analyzePDF() {
  try {
    // Load the PDF
    const existingPdfBytes = fs.readFileSync('1 de-minimisverklaring (1).pdf');
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
      }
      
      // If it's a radio group, show the options
      if (type === 'PDFRadioGroup') {
        const options = field.getOptions();
        console.log(`  Options: ${options.join(', ')}`);
      }
    });
    
  } catch (error) {
    console.error('Error analyzing PDF:', error);
  }
}

analyzePDF();