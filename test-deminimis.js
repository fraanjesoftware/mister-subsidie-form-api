const https = require('https');

const testDeMinimis = {
    deMinimis: {
        selectedOption: 1,
        generalData: {
            companyName: "Test Company B.V.",
            kvkNumber: "12345678",
            street: "Teststraat",
            houseNumber: "123",
            city: "Amsterdam",
            postalCode: "1234AB",
            signerName: "Test User",
            date: "05-01-25"
        }
    },
    signer: {
        email: "test@example.com",
        name: "Test User"
    },
    returnUrl: "https://example.com/signing-complete"
};

function runTest() {
    const data = JSON.stringify(testDeMinimis);
    
    const options = {
        hostname: 'mister-subsidie-form-api-h8fvgydvheenczea.westeurope-01.azurewebsites.net',
        path: '/api/createSigningSession',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data)
        }
    };

    console.log('Testing De-minimis form with actual data...\n');
    
    const req = https.request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
            responseData += chunk;
        });
        
        res.on('end', () => {
            console.log('Response Status:', res.statusCode);
            
            try {
                const parsed = JSON.parse(responseData);
                if (parsed.success) {
                    console.log('✅ SUCCESS!');
                    console.log('Envelope ID:', parsed.envelopeId);
                    console.log('Signing URL:', parsed.signingUrl.substring(0, 100) + '...');
                    console.log('Forms:', parsed.forms);
                } else {
                    console.log('❌ FAILED:', parsed.error);
                    console.log('Details:', parsed.details || parsed.message);
                }
            } catch (e) {
                console.log('❌ Error parsing response:', e.message);
                console.log('Raw response:', responseData);
            }
        });
    });

    req.on('error', (error) => {
        console.error('❌ Request error:', error);
    });

    req.write(data);
    req.end();
}

runTest();