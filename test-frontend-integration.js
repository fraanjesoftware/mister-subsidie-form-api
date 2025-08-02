const axios = require('axios');

// This simulates the exact request format from the frontend
const API_URL = 'https://mister-subsidie-form-api-h8fvgydvheenczea.westeurope-01.azurewebsites.net/api/createSignWellTemplateSession';

async function testFrontendIntegration() {
  // Example request as documented in the frontend implementation guide
  const frontendRequest = {
    signers: [
      {
        email: "john@company.com",
        name: "John Doe",
        roleName: "Applicant",
        tabs: {
          radioGroupTabs: [
            {
              groupName: "de-minimis-radio",
              radios: [
                { value: "geen", selected: true },
                { value: "wel", selected: false },
                { value: "andere", selected: false }
              ]
            },
            {
              groupName: "company-type",
              radios: [
                { value: "kleine", selected: false },
                { value: "middel", selected: true },
                { value: "grote", selected: false }
              ]
            }
          ],
          textTabs: [
            // Company Information
            { tabLabel: "bedrijfsnaam", value: "ABC Company B.V." },
            { tabLabel: "kvk", value: "12345678" },
            { tabLabel: "onderneming-adres", value: "Keizersgracht 123" },
            { tabLabel: "postcode", value: "1015 CJ" },
            { tabLabel: "plaats", value: "Amsterdam" },
            { tabLabel: "nace", value: "62.01 - Ontwikkelen van software" },
            
            // Director Information
            { tabLabel: "naam", value: "John Doe" },
            { tabLabel: "functie", value: "Directeur-eigenaar" },
            { tabLabel: "email", value: "john@company.com" },
            { tabLabel: "voorletters-tekenbevoegde", value: "J." },
            { tabLabel: "achternaam-tekenbevoegde", value: "Doe" },
            { tabLabel: "functie-tekenbevoegde", value: "Algemeen Directeur" },
            
            // Financial Information
            { tabLabel: "fte", value: "45" },
            { tabLabel: "jaaromzet", value: "€ 3.500.000" },
            { tabLabel: "balanstotaal", value: "€ 1.750.000" },
            { tabLabel: "boekjaar", value: "2023" },
            
            // De-minimis Fields (conditional - only minimis-2.1 since 'geen' is selected)
            { tabLabel: "minimis-2.1", value: "" }, // Empty when 'geen' is selected
            { tabLabel: "minimis-3.1", value: "" }, // Empty when not 'andere'
            { tabLabel: "minimis-3.2", value: "" }, // Empty when not 'andere'
            
            // Metadata
            { tabLabel: "datum", value: new Date().toLocaleDateString('nl-NL', { 
              day: '2-digit', 
              month: '2-digit', 
              year: '2-digit' 
            }).replace(/\//g, '-') } // Format: DD-MM-YY
          ],
          listTabs: [
            { tabLabel: "CompanySize", value: "Middelgroot (50-250 medewerkers)" }
          ]
        }
      }
    ],
    returnUrl: "https://app.mistersubsidie.nl/bedankt"
  };

  console.log('Testing SignWell integration with frontend format...\n');
  console.log('Request details:');
  console.log('- Company:', frontendRequest.signers[0].tabs.textTabs.find(t => t.tabLabel === 'bedrijfsnaam').value);
  console.log('- Signer:', frontendRequest.signers[0].name);
  console.log('- De-minimis:', frontendRequest.signers[0].tabs.radioGroupTabs[0].radios.find(r => r.selected).value);
  console.log('- Company type:', frontendRequest.signers[0].tabs.radioGroupTabs[1].radios.find(r => r.selected).value);
  console.log('- Return URL:', frontendRequest.returnUrl);
  console.log('\nSending request...\n');

  try {
    const response = await axios.post(API_URL, frontendRequest, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Success! Response:', JSON.stringify(response.data, null, 2));
    
    if (response.data.signingUrl && response.data.documentId && response.data.status === 'created') {
      console.log('\n✅ Response matches expected frontend format!');
      console.log('\nSigning URL:', response.data.signingUrl);
      console.log('Document ID:', response.data.documentId);
      console.log('\nThe frontend can now redirect the user to the signing URL.');
    } else {
      console.log('\n⚠️  Response format may not match frontend expectations');
    }

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    
    if (error.response?.data) {
      console.log('\nError response structure:', JSON.stringify(error.response.data, null, 2));
      
      // Check if error response matches expected format
      if (error.response.data.error && error.response.data.message) {
        console.log('\n✅ Error response matches expected frontend format');
      }
    }
  }
}

// Test with different scenarios
async function testVariousScenarios() {
  console.log('\n=== Testing various frontend scenarios ===\n');
  
  // Test 1: With de-minimis "wel" selected
  console.log('1. Testing with de-minimis "wel" (requires amount)...');
  const welRequest = {
    signers: [{
      email: "test@example.com",
      name: "Test User",
      roleName: "Applicant",
      tabs: {
        radioGroupTabs: [
          {
            groupName: "de-minimis-radio",
            radios: [
              { value: "geen", selected: false },
              { value: "wel", selected: true },
              { value: "andere", selected: false }
            ]
          },
          {
            groupName: "company-type",
            radios: [
              { value: "kleine", selected: true },
              { value: "middel", selected: false },
              { value: "grote", selected: false }
            ]
          }
        ],
        textTabs: [
          { tabLabel: "bedrijfsnaam", value: "Test De-minimis B.V." },
          { tabLabel: "kvk", value: "87654321" },
          { tabLabel: "minimis-2.1", value: "€ 150.000" }, // Amount when 'wel' is selected
          { tabLabel: "naam", value: "Test User" }
        ]
      }
    }],
    returnUrl: "https://app.mistersubsidie.nl/bedankt"
  };
  
  try {
    const response = await axios.post(API_URL, welRequest, {
      headers: { 'Content-Type': 'application/json' }
    });
    console.log('✅ Success with de-minimis "wel"');
  } catch (error) {
    console.log('❌ Failed:', error.response?.data?.error || error.message);
  }
  
  // Test 2: Missing required field
  console.log('\n2. Testing with missing required field (returnUrl)...');
  const missingFieldRequest = {
    signers: [{
      email: "test@example.com",
      name: "Test User",
      roleName: "Applicant",
      tabs: { textTabs: [{ tabLabel: "bedrijfsnaam", value: "Test" }] }
    }]
    // Missing returnUrl
  };
  
  try {
    await axios.post(API_URL, missingFieldRequest, {
      headers: { 'Content-Type': 'application/json' }
    });
    console.log('❌ Should have failed but succeeded');
  } catch (error) {
    if (error.response?.status === 400 && error.response?.data?.error) {
      console.log('✅ Correctly rejected with 400 error');
    }
  }
}

// Run tests
async function runAllTests() {
  await testFrontendIntegration();
  await testVariousScenarios();
}

runAllTests();