const { fillDeMinimisForm } = require('./fill-de-minimis');

// Example: Simple API usage
async function fillForm() {
  // Option 1: No de-minimis support
  await fillDeMinimisForm({
    selectedOption: 1,
    generalData: {
      companyName: 'Your Company B.V.',
      kvkNumber: '12345678',
      street: 'Main Street',
      houseNumber: '100',
      city: 'Amsterdam',
      postalCode: '1000AA',
      signerName: 'John Doe',
      date: '21-06-25'
    }
  });
  
  console.log('Form filled successfully!');
}

// Run if called directly
if (require.main === module) {
  fillForm().catch(console.error);
}

module.exports = { fillDeMinimisForm };