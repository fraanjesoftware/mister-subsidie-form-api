const { fillAndUploadForms } = require('./index');

// Quick example - fills all forms and uploads to Google Drive
async function quickStart() {
  const companyData = {
    // De-minimis declaration
    deMinimis: {
      selectedOption: 1, // 1 = no support, 2 = support below threshold, 3 = other state aid
      generalData: {
        companyName: 'Your Company B.V.',
        kvkNumber: '12345678',
        street: 'Main Street',
        houseNumber: '100',
        city: 'Amsterdam',
        postalCode: '1000AA',
        signerName: 'Your Name',
        date: '21-06-25'
      }
    },
    
    // Authorization form
    machtiging: {
      applicantData: {
        companyName: 'Your Company B.V.',
        email: 'info@yourcompany.nl',
        kvkNumber: '12345678',
        contactPerson: 'Your Name',
        contactEmail: 'you@yourcompany.nl',
        position: 'Director',
        phoneNumber: '0612345678',
        date: '21-06-25'
      },
      representativeData: {
        companyName: 'Advisor Company B.V.',
        contactPerson: 'Advisor Name',
        email: 'advisor@company.nl',
        signDate1: '21-06-25',
        name: 'Advisor Name',
        position: 'Consultant',
        phoneNumber: '0687654321',
        signDate2: '21-06-25'
      }
    },
    
    // SME declaration (size calculated automatically)
    mkbVerklaring: {
      companyName: 'Your Company B.V.',
      financialYear: '2024',
      employees: 45,              // < 50 = small, < 250 = medium, >= 250 = large
      annualTurnover: 8000000,    // €8 million
      balanceTotal: 6000000,      // €6 million
      signerName: 'Your Name',
      signerPosition: 'Director',
      dateAndLocation: '21-06-25, Amsterdam',
      isIndependent: true,
      hasLargeCompanyOwnership: false,
      hasPartnerCompanies: false
    },
    
    // Set to true to delete local PDFs after successful upload
    deleteLocalAfterUpload: false
  };
  
  try {
    console.log('Starting form generation and upload process...\n');
    
    // Note: First time running will open browser for Google authentication
    const result = await fillAndUploadForms(companyData, true);
    
    console.log('\n✅ Success! All forms have been filled and uploaded to Google Drive.');
    console.log('\nCheck your Google Drive for the "Subsidie Forms" folder.');
    
  } catch (error) {
    if (error.message.includes('credentials.json')) {
      console.error('\n❌ Google Drive setup required!');
      console.error('Please follow the instructions in GOOGLE_DRIVE_SETUP.md');
      console.error('\nYou can still run without Drive upload:');
      console.error('const result = await fillAndUploadForms(companyData, false);');
    } else {
      console.error('\n❌ Error:', error.message);
    }
  }
}

// Run the example
quickStart();