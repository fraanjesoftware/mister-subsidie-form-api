#!/usr/bin/env node

/**
 * Helper script to convert RSA private key to base64 format for Azure environment variables
 * 
 * Usage:
 * 1. Copy your RSA private key (including BEGIN/END lines) to a file named 'private.key'
 * 2. Run: node convertKeyToBase64.js
 * 3. Copy the output and use it as your DOCUSIGN_RSA_PRIVATE_KEY environment variable
 */

const fs = require('fs');
const path = require('path');

function convertKeyToBase64(keyPath = './private.key') {
  try {
    // Read the key file
    const privateKey = fs.readFileSync(keyPath, 'utf-8');
    
    // Verify it's a valid RSA key
    if (!privateKey.includes('BEGIN RSA PRIVATE KEY')) {
      throw new Error('File does not appear to contain an RSA private key');
    }
    
    // Convert to base64
    const base64Key = Buffer.from(privateKey).toString('base64');
    
    console.log('\n=== Base64 Encoded RSA Private Key ===\n');
    console.log(base64Key);
    console.log('\n=== Instructions ===\n');
    console.log('1. Copy the base64 string above');
    console.log('2. In Azure Portal, set DOCUSIGN_RSA_PRIVATE_KEY to this value');
    console.log('3. The code will automatically decode it when needed\n');
    
    // Verify it can be decoded back
    const decoded = Buffer.from(base64Key, 'base64').toString('utf-8');
    if (decoded === privateKey) {
      console.log('✓ Verification passed - encoding/decoding works correctly\n');
    } else {
      console.log('✗ Verification failed - something went wrong\n');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    console.log('\nUsage: Place your RSA private key in a file named "private.key" and run this script');
  }
}

// Check if key file exists in current directory
if (fs.existsSync('./private.key')) {
  convertKeyToBase64('./private.key');
} else {
  console.log('No private.key file found in current directory.');
  console.log('\nTo use this script:');
  console.log('1. Create a file named "private.key"');
  console.log('2. Paste your complete RSA private key (including BEGIN/END lines)');
  console.log('3. Run: node convertKeyToBase64.js');
}