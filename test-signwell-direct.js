// Direct test of SignWell API
require('dotenv').config();
const axios = require('axios');

async function testSignWellDirect() {
  const apiKey = process.env.SIGNWELL_API_KEY;
  const templateId = 'da64f360-505b-42b4-9eed-39f179a23a79';
  
  console.log('Testing SignWell API directly...\n');
  
  // Try different request formats
  const requests = [
    {
      name: 'Test 1: Basic request',
      data: {
        template_id: templateId,
        test_mode: true,
        recipients: [
          {
            name: 'Test User',
            email: 'test@example.com'
          }
        ]
      }
    },
    {
      name: 'Test 2: With placeholder',
      data: {
        template_id: templateId,
        test_mode: true,
        recipients: [
          {
            name: 'Test User',
            email: 'test@example.com',
            placeholder: 'Signer 1'
          }
        ]
      }
    },
    {
      name: 'Test 3: With embedded signing',
      data: {
        template_id: templateId,
        test_mode: true,
        embedded_signing: true,
        recipients: [
          {
            name: 'Test User',
            email: 'test@example.com'
          }
        ]
      }
    }
  ];

  for (const test of requests) {
    console.log(`\n${test.name}:`);
    console.log('Request:', JSON.stringify(test.data, null, 2));
    
    try {
      const response = await axios.post(
        'https://www.signwell.com/api/v1/document_templates/documents/',
        test.data,
        {
          headers: {
            'X-Api-Key': apiKey,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('✅ Success!');
      console.log('Document ID:', response.data.id);
      console.log('Status:', response.data.status);
      if (response.data.recipients) {
        console.log('Recipients:', response.data.recipients.map(r => ({
          name: r.name,
          email: r.email,
          signing_url: r.embedded_signing_url
        })));
      }
    } catch (error) {
      console.log('❌ Failed:', error.response?.status);
      if (error.response?.data) {
        console.log('Error:', JSON.stringify(error.response.data, null, 2));
      }
    }
  }
}

testSignWellDirect().catch(console.error);