require('dotenv').config();
const axios = require('axios');

async function testSignWellCorrect() {
  const apiKey = process.env.SIGNWELL_API_KEY;
  const templateId = 'da64f360-505b-42b4-9eed-39f179a23a79';
  
  console.log('Testing SignWell API with correct format...\n');
  
  const request = {
    template_id: templateId,
    test_mode: true,
    embedded_signing: true,
    recipients: [
      {
        id: 'recipient_1',
        name: 'John Doe',
        email: 'john@example.com',
        placeholder_name: 'signer'
      },
      {
        id: 'recipient_2', 
        name: 'Jane Smith',
        email: 'jane@example.com',
        placeholder_name: 'signer2'
      },
      {
        id: 'recipient_3',
        name: 'Document Admin',
        email: 'admin@example.com',
        placeholder_name: 'document sender'
      }
    ]
  };
  
  console.log('Request:', JSON.stringify(request, null, 2));
  
  try {
    const response = await axios.post(
      'https://www.signwell.com/api/v1/document_templates/documents/',
      request,
      {
        headers: {
          'X-Api-Key': apiKey,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('\n✅ Success!');
    console.log('Document ID:', response.data.id);
    console.log('Status:', response.data.status);
    console.log('\nSigning URLs:');
    response.data.recipients.forEach(r => {
      console.log(`- ${r.name} (${r.placeholder_name}): ${r.embedded_signing_url || 'Will receive email'}`);
    });
  } catch (error) {
    console.log('\n❌ Failed:', error.response?.status);
    if (error.response?.data) {
      console.log('Error:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testSignWellCorrect().catch(console.error);