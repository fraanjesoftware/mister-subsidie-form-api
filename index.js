const { fillDeMinimisForm } = require('./fill-de-minimis');
const { fillMachtigingsformulier } = require('./fill-machtiging');
const { fillMKBVerklaring, determineCompanySize } = require('./fill-mkb-verklaring');
const { fillAndUploadForms } = require('./fill-and-upload');

// Example: Fill all forms
async function fillForms() {
  // Fill de-minimis form
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
  
  // Fill machtigingsformulier
  await fillMachtigingsformulier({
    applicantData: {
      companyName: 'Your Company B.V.',
      email: 'info@yourcompany.nl',
      kvkNumber: '12345678',
      contactPerson: 'John Doe',
      contactEmail: 'john@yourcompany.nl',
      position: 'Director',
      phoneNumber: '0612345678',
      date: '21-06-25'
    },
    representativeData: {
      companyName: 'Adviseur B.V.',
      contactPerson: 'Jane Smith',
      email: 'jane@adviseur.nl',
      signDate1: '21-06-25',
      name: 'Jane Smith',
      position: 'Consultant',
      phoneNumber: '0687654321',
      signDate2: '21-06-25'
    }
  });
  
  // Fill MKB verklaring with automatic size determination
  const mkbResult = await fillMKBVerklaring({
    companyName: 'Your Company B.V.',
    financialYear: '2024',
    employees: 45,
    annualTurnover: 8000000,   // €8 million
    balanceTotal: 6000000,      // €6 million
    signerName: 'John Doe',
    signerPosition: 'Director',
    dateAndLocation: '21-06-25, Amsterdam',
    isIndependent: true,
    hasLargeCompanyOwnership: false,
    hasPartnerCompanies: false
  });
  
  console.log(`All forms filled successfully!`);
  console.log(`Company was determined to be: ${mkbResult.companySize.type}`);
}

// Run if called directly
if (require.main === module) {
  fillForms().catch(console.error);
}

module.exports = { 
  fillDeMinimisForm, 
  fillMachtigingsformulier, 
  fillMKBVerklaring,
  determineCompanySize,
  fillAndUploadForms
};