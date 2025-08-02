// Load environment variables
require('dotenv').config();

// Import the handler function directly
const { createSignWellSigningSession } = require('./dist/functions/createSignWellSigningSession');

// Mock Azure Functions context
const mockContext = {
  log: console.log,
  error: console.error,
  warn: console.warn
};

// Test request body
const testRequestBody = {
  templateId: "YOUR_TEMPLATE_ID_HERE", // Replace with an actual template ID
  name: "Test Agreement Document",
  subject: "Please sign this test agreement",
  message: "This is a test document created via the SignWell API integration.",
  recipients: [
    {
      name: "John Doe",
      email: "john.doe@example.com",
      order: 1
    },
    {
      name: "Jane Smith", 
      email: "jane.smith@example.com",
      order: 2
    }
  ],
  embeddedSigning: true,
  redirectUri: "https://example.com/signing-complete",
  metadata: {
    applicationId: "test-app-123",
    documentType: "agreement"
  },
  testMode: true
};

// Mock HTTP request
const mockRequest = {
  method: 'POST',
  headers: {
    'content-type': 'application/json'
  },
  json: async () => testRequestBody
};

async function testSignWellAPI() {
  console.log('🧪 Testing SignWell API Endpoint...\n');
  console.log('📋 Request Body:', JSON.stringify(testRequestBody, null, 2));
  console.log('\n' + '='.repeat(50) + '\n');

  try {
    // Call the function handler
    const response = await createSignWellSigningSession(mockRequest, mockContext);
    
    console.log('📤 Response Status:', response.status);
    console.log('📄 Response Headers:', response.headers);
    
    if (response.body) {
      const responseBody = JSON.parse(response.body);
      console.log('📊 Response Body:', JSON.stringify(responseBody, null, 2));
      
      if (response.status === 200) {
        console.log('\n✅ Success! Document created.');
        console.log('\n🔗 Signing URLs:');
        responseBody.signingUrls.forEach(signer => {
          console.log(`   - ${signer.name} (${signer.email}): ${signer.signingUrl || 'No URL - will receive email'}`);
        });
      } else {
        console.log('\n❌ Error:', responseBody.error);
        if (responseBody.details) {
          console.log('Details:', responseBody.details);
        }
      }
    }
  } catch (error) {
    console.error('\n❌ Unexpected Error:', error);
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('\n💡 Next Steps:');
  console.log('1. Replace "YOUR_TEMPLATE_ID_HERE" with an actual SignWell template ID');
  console.log('2. Create a template in your SignWell dashboard: https://www.signwell.com/templates');
  console.log('3. Use real email addresses for testing (SignWell may validate them)');
  console.log('4. Check the SignWell dashboard to see created documents');
}

// Run the test
testSignWellAPI();