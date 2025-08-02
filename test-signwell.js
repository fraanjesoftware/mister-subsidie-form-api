// Load environment variables
require('dotenv').config();

// Import the compiled SignWell service
const { SignWellService } = require('./dist/services/signwellService');

async function testSignWell() {
  console.log('Testing SignWell Integration...\n');
  
  // Check if API key is configured
  const apiKey = process.env.SIGNWELL_API_KEY;
  if (!apiKey || apiKey === 'test-api-key') {
    console.error('❌ ERROR: Please set a valid SIGNWELL_API_KEY in your .env file');
    console.log('You can get your API key from: https://www.signwell.com/settings/api\n');
    return;
  }

  console.log('✅ API Key configured');
  console.log(`📋 Test Mode: ${process.env.SIGNWELL_TEST_MODE || 'true'}`);
  console.log(`🌍 Environment: ${process.env.SIGNWELL_ENVIRONMENT || 'test'}\n`);

  try {
    // Initialize SignWell service
    const signwellService = new SignWellService();
    console.log('✅ SignWell service initialized\n');

    // Create a test document request
    const documentRequest = {
      name: 'Test Document from API',
      subject: 'Please sign this test document',
      message: 'This is a test document created via the SignWell API integration.',
      recipients: [
        {
          name: 'Test Signer',
          email: 'test@example.com',
          order: 1
        }
      ],
      embedded_signing: true,
      test_mode: true
    };

    console.log('📄 Creating test document...');
    console.log('Request:', JSON.stringify(documentRequest, null, 2));
    
    // Note: This will fail without a template_id or file
    // For a real test, you need to either:
    // 1. Create a template in SignWell and use createDocumentFromTemplate
    // 2. Provide a PDF file and use createDocumentWithFile
    
    console.log('\n⚠️  NOTE: To actually create a document, you need to:');
    console.log('1. Create a template in your SignWell dashboard');
    console.log('2. Use the template ID with createDocumentFromTemplate method');
    console.log('3. OR provide a PDF file with createDocumentWithFile method\n');

    // Example with template (uncomment and add your template ID):
    /*
    const templateId = 'YOUR_TEMPLATE_ID_HERE';
    const document = await signwellService.createDocumentFromTemplate(
      templateId,
      documentRequest
    );
    
    console.log('✅ Document created successfully!');
    console.log('Document ID:', document.id);
    console.log('Status:', document.status);
    console.log('\nSigning URLs:');
    document.recipients.forEach(recipient => {
      console.log(`- ${recipient.name}: ${recipient.embedded_signing_url || 'Email will be sent'}`);
    });
    */

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testSignWell();