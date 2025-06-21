const { fillDeMinimisForm } = require('./fill-de-minimis');
const { fillMachtigingsformulier } = require('./fill-machtiging');
const { fillMKBVerklaring } = require('./fill-mkb-verklaring');
const GoogleDriveService = require('./google-drive-service');
const fs = require('fs');
const path = require('path');

async function fillAndUploadForms(formData, uploadToDrive = true) {
  const filledForms = [];
  
  try {
    console.log('Starting form filling process...\n');
    
    // Fill De-minimis form
    if (formData.deMinimis) {
      console.log('Filling De-minimis form...');
      await fillDeMinimisForm(formData.deMinimis);
      const deMinimisFile = getLatestFile('filled-de-minimis-*.pdf');
      if (deMinimisFile) filledForms.push(deMinimisFile);
    }
    
    // Fill Machtigingsformulier
    if (formData.machtiging) {
      console.log('Filling Machtigingsformulier...');
      await fillMachtigingsformulier(formData.machtiging);
      const machtigingFile = getLatestFile('filled-machtiging-*.pdf');
      if (machtigingFile) filledForms.push(machtigingFile);
    }
    
    // Fill MKB Verklaring
    if (formData.mkbVerklaring) {
      console.log('Filling MKB Verklaring...');
      const result = await fillMKBVerklaring(formData.mkbVerklaring);
      if (result && result.filename) {
        filledForms.push(result.filename);
        console.log(`Company size determined: ${result.companySize.type}`);
      }
    }
    
    console.log(`\nCompleted filling ${filledForms.length} forms.`);
    
    // Upload to Google Drive if enabled
    if (uploadToDrive && filledForms.length > 0) {
      console.log('\nUploading to Google Drive...');
      const driveService = new GoogleDriveService();
      
      try {
        const uploadResult = await driveService.uploadPDFs(filledForms, 'Subsidie Forms');
        
        console.log('\nUpload complete!');
        console.log(`Folder: ${uploadResult.folder.name}`);
        console.log('\nUploaded files:');
        
        uploadResult.files.forEach(file => {
          if (file.success) {
            console.log(`✓ ${file.driveFile.name}`);
            console.log(`  View: ${file.driveFile.webViewLink}`);
          } else {
            console.log(`✗ ${file.localPath}: ${file.error}`);
          }
        });
        
        // Optionally delete local files after successful upload
        if (formData.deleteLocalAfterUpload) {
          console.log('\nCleaning up local files...');
          filledForms.forEach(file => {
            try {
              fs.unlinkSync(file);
              console.log(`Deleted: ${file}`);
            } catch (err) {
              console.error(`Error deleting ${file}:`, err.message);
            }
          });
        }
        
        return {
          localFiles: filledForms,
          driveUpload: uploadResult,
        };
      } catch (error) {
        console.error('Error uploading to Google Drive:', error);
        console.log('Files are still available locally:', filledForms);
        throw error;
      }
    }
    
    return {
      localFiles: filledForms,
      driveUpload: null,
    };
    
  } catch (error) {
    console.error('Error in fill and upload process:', error);
    throw error;
  }
}

// Helper function to get the latest generated file
function getLatestFile(pattern) {
  const files = fs.readdirSync('.').filter(f => {
    const regex = new RegExp(pattern.replace('*', '.*'));
    return regex.test(f);
  });
  
  if (files.length === 0) return null;
  
  // Sort by modification time and get the latest
  const sorted = files.sort((a, b) => {
    const statA = fs.statSync(a);
    const statB = fs.statSync(b);
    return statB.mtime - statA.mtime;
  });
  
  return sorted[0];
}

// Example usage
async function runExample() {
  const formData = {
    deMinimis: {
      selectedOption: 1,
      generalData: {
        companyName: 'Tech Innovatie B.V.',
        kvkNumber: '12345678',
        street: 'Innovatielaan',
        houseNumber: '100',
        city: 'Amsterdam',
        postalCode: '1000AA',
        signerName: 'Jan de Vries',
        date: '21-06-25'
      }
    },
    machtiging: {
      applicantData: {
        companyName: 'Tech Innovatie B.V.',
        email: 'info@techinnovatie.nl',
        kvkNumber: '12345678',
        contactPerson: 'Jan de Vries',
        contactEmail: 'jan@techinnovatie.nl',
        position: 'Directeur',
        phoneNumber: '0612345678',
        date: '21-06-25'
      },
      representativeData: {
        companyName: 'Subsidie Experts B.V.',
        contactPerson: 'Maria Janssen',
        email: 'maria@subsidie-experts.nl',
        signDate1: '21-06-25',
        name: 'Maria Janssen',
        position: 'Senior Consultant',
        phoneNumber: '0687654321',
        signDate2: '21-06-25'
      }
    },
    mkbVerklaring: {
      companyName: 'Tech Innovatie B.V.',
      financialYear: '2024',
      employees: 45,
      annualTurnover: 8500000,
      balanceTotal: 6000000,
      signerName: 'Jan de Vries',
      signerPosition: 'Directeur',
      dateAndLocation: '21-06-2025, Amsterdam',
      isIndependent: true,
      hasLargeCompanyOwnership: false,
      hasPartnerCompanies: false
    },
    deleteLocalAfterUpload: false // Set to true to delete local files after upload
  };
  
  try {
    const result = await fillAndUploadForms(formData);
    console.log('\nProcess completed successfully!');
  } catch (error) {
    console.error('Process failed:', error);
  }
}

module.exports = { fillAndUploadForms };

// Run example if this file is executed directly
if (require.main === module) {
  runExample();
}