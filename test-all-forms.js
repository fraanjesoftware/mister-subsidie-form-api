const https = require('https');

const testCases = [
    {
        name: "Test 1: De-minimis form only",
        data: {
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
        }
    },
    {
        name: "Test 2: Machtiging form only",
        data: {
            machtiging: {
                applicantData: {
                    companyName: "Applicant Company B.V.",
                    email: "applicant@example.com",
                    kvkNumber: "87654321",
                    contactPerson: "John Doe",
                    contactEmail: "john@example.com",
                    position: "Director",
                    phoneNumber: "0612345678",
                    date: "05-01-25"
                },
                representativeData: {
                    companyName: "Representative Company B.V.",
                    contactPerson: "Jane Smith",
                    email: "jane@example.com",
                    name: "Jane Smith",
                    position: "Manager",
                    phoneNumber: "0687654321",
                    signDate1: "05-01-25",
                    signDate2: "05-01-25"
                }
            },
            signer: {
                email: "test@example.com",
                name: "Test User"
            },
            returnUrl: "https://example.com/signing-complete"
        }
    },
    {
        name: "Test 3: MKB form only",
        data: {
            mkbVerklaring: {
                companyName: "Small Company B.V.",
                financialYear: "2024",
                employees: 25,
                annualTurnover: 5000000,
                balanceTotal: 4000000,
                signerName: "Test User",
                signerPosition: "CEO",
                dateAndLocation: "Amsterdam, 05-01-2025",
                isIndependent: true
            },
            signer: {
                email: "test@example.com",
                name: "Test User"
            },
            returnUrl: "https://example.com/signing-complete"
        }
    },
    {
        name: "Test 4: All forms together",
        data: {
            deMinimis: {
                selectedOption: 1,
                generalData: {
                    companyName: "Multi Form Company B.V.",
                    kvkNumber: "12345678",
                    street: "Teststraat",
                    houseNumber: "123",
                    city: "Amsterdam",
                    postalCode: "1234AB",
                    signerName: "Test User",
                    date: "05-01-25"
                }
            },
            machtiging: {
                applicantData: {
                    companyName: "Multi Form Company B.V.",
                    email: "applicant@example.com",
                    kvkNumber: "12345678",
                    contactPerson: "Test User",
                    contactEmail: "test@example.com",
                    position: "Director",
                    phoneNumber: "0612345678",
                    date: "05-01-25"
                }
            },
            mkbVerklaring: {
                companyName: "Multi Form Company B.V.",
                financialYear: "2024",
                employees: 50,
                annualTurnover: 8000000,
                balanceTotal: 7000000,
                signerName: "Test User",
                signerPosition: "Director",
                dateAndLocation: "Amsterdam, 05-01-2025"
            },
            signer: {
                email: "test@example.com",
                name: "Test User"
            },
            uploadToDrive: false,
            returnUrl: "https://example.com/signing-complete"
        }
    }
];

async function runTest(testCase) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'mister-subsidie-form-api-h8fvgydvheenczea.westeurope-01.azurewebsites.net',
            path: '/api/createSigningSession',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(JSON.stringify(testCase.data))
            }
        };

        console.log(`\n=== ${testCase.name} ===`);
        
        const req = https.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                console.log('Response Status:', res.statusCode);
                
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.success) {
                        console.log('✅ SUCCESS!');
                        console.log('Envelope ID:', parsed.envelopeId);
                        console.log('Forms:', parsed.forms);
                    } else {
                        console.log('❌ FAILED:', parsed.error);
                        console.log('Details:', parsed.details || parsed.message);
                    }
                } catch (e) {
                    console.log('❌ Error parsing response:', e.message);
                    console.log('Raw response:', data);
                }
                
                resolve();
            });
        });

        req.on('error', (error) => {
            console.error('❌ Request error:', error);
            resolve();
        });

        req.write(JSON.stringify(testCase.data));
        req.end();
    });
}

async function runAllTests() {
    console.log('Testing all forms with DocuSign...\n');
    
    for (const testCase of testCases) {
        await runTest(testCase);
        // Wait a bit between tests
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log('\n✅ All tests completed!');
}

runAllTests();