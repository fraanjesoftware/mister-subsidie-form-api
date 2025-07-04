module.exports = async function (context, req) {
    try {
        const privateKeyRaw = process.env.DOCUSIGN_RSA_PRIVATE_KEY;
        
        if (!privateKeyRaw) {
            context.res = {
                status: 200,
                body: {
                    error: "DOCUSIGN_RSA_PRIVATE_KEY not found in environment"
                }
            };
            return;
        }
        
        // Check format
        const hasBeginMarker = privateKeyRaw.includes('BEGIN RSA PRIVATE KEY');
        const hasEndMarker = privateKeyRaw.includes('END RSA PRIVATE KEY');
        const hasNewlines = privateKeyRaw.includes('\n');
        const length = privateKeyRaw.length;
        
        // Try the same formatting logic from docusignService
        let privateKey;
        let formatUsed = 'unknown';
        
        if (!privateKeyRaw.includes('BEGIN RSA PRIVATE KEY')) {
            formatUsed = 'base64';
            privateKey = Buffer.from(privateKeyRaw, 'base64').toString('utf-8');
        } else if (privateKeyRaw.includes('-----BEGIN') && !privateKeyRaw.includes('\n')) {
            formatUsed = 'single-line-with-markers';
            const keyContent = privateKeyRaw
                .replace('-----BEGIN RSA PRIVATE KEY-----', '')
                .replace('-----END RSA PRIVATE KEY-----', '')
                .trim();
            
            const formattedKey = keyContent.match(/.{1,64}/g).join('\n');
            privateKey = `-----BEGIN RSA PRIVATE KEY-----\n${formattedKey}\n-----END RSA PRIVATE KEY-----`;
        } else {
            formatUsed = 'pem-format';
            privateKey = privateKeyRaw;
        }
        
        // Check processed key
        const processedHasNewlines = privateKey.includes('\n');
        const processedLineCount = privateKey.split('\n').length;
        
        context.res = {
            status: 200,
            body: {
                diagnostics: {
                    raw: {
                        length: length,
                        hasBeginMarker: hasBeginMarker,
                        hasEndMarker: hasEndMarker,
                        hasNewlines: hasNewlines,
                        first50chars: privateKeyRaw.substring(0, 50) + '...',
                        last50chars: '...' + privateKeyRaw.substring(length - 50)
                    },
                    processed: {
                        formatUsed: formatUsed,
                        hasNewlines: processedHasNewlines,
                        lineCount: processedLineCount,
                        first100chars: privateKey.substring(0, 100) + '...',
                        isValidPEMStructure: privateKey.includes('-----BEGIN') && privateKey.includes('-----END') && processedHasNewlines
                    }
                }
            }
        };
        
    } catch (error) {
        context.res = {
            status: 500,
            body: {
                error: error.message,
                stack: error.stack
            }
        };
    }
};