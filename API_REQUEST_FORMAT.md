# API Request Format for createSigningSession

## Base Request Structure

```json
{
  "formType": "deMinimis | machtiging | mkb",
  "signer": {
    "email": "signer@example.com",
    "name": "John Doe"
  },
  "formData": {
    // Form-specific data (see below)
  },
  "returnUrl": "https://yourapp.com/signing-complete" // Optional
}
```

## Form-Specific Data Structures

### 1. De Minimis Form (`formType: "deMinimis"`)

```json
{
  "formType": "deMinimis",
  "signer": {
    "email": "john@company.com",
    "name": "John Doe"
  },
  "formData": {
    "selectedOption": 1, // 1, 2, or 3
    "option2Data": { // Required if selectedOption is 2
      "field_1_2": "Value 1",
      "field_1_3": "Value 2",
      "field_1_4": "Value 3"
    },
    "option3Data": { // Required if selectedOption is 3
      "field_1_2": "Value 1",
      "field_1_3": "Value 2",
      "field_1_4": "Value 3"
    },
    "generalData": { // Always required
      "companyName": "Acme Corporation",
      "kvkNumber": "12345678",
      "street": "Main Street",
      "houseNumber": "123",
      "city": "Amsterdam",
      "postalCode": "1234AB", // Max 6 characters
      "signerName": "John Doe",
      "date": "05-07-25" // Format: DD-MM-YY
    },
    "addSignatureAnchors": true
  }
}
```

### 2. Machtiging (Authorization) Form (`formType: "machtiging"`)

```json
{
  "formType": "machtiging",
  "signer": {
    "email": "representative@company.com",
    "name": "Jane Smith"
  },
  "formData": {
    "applicantData": {
      "companyName": "Acme Corporation",
      "email": "info@acme.com",
      "kvkNumber": "12345678", // Max 8 characters
      "contactPerson": "John Doe",
      "contactEmail": "john@acme.com",
      "position": "CEO",
      "phoneNumber": "0201234567", // Max 10 characters
      "date": "05-07-25" // Format: DD-MM-YY
    },
    "representativeData": {
      "companyName": "Representative Company B.V.",
      "contactPerson": "Jane Smith",
      "email": "jane@representative.com",
      "signDate1": "05-07-25", // Format: DD-MM-YY
      "name": "Jane Smith",
      "position": "Senior Consultant",
      "phoneNumber": "0209876543",
      "signDate2": "05-07-25" // Format: DD-MM-YY
    },
    "addSignatureAnchors": true
  }
}
```

### 3. MKB (SME) Form (`formType: "mkb"`)

```json
{
  "formType": "mkb",
  "signer": {
    "email": "director@company.com",
    "name": "John Doe"
  },
  "formData": {
    "companyName": "Acme Corporation B.V.",
    "financialYear": "2024",
    "employees": 45, // Number
    "annualTurnover": 8500000, // In euros
    "balanceTotal": 4200000, // In euros
    "signerName": "John Doe",
    "signerPosition": "Managing Director",
    "dateAndLocation": "Amsterdam, 05-07-2025",
    "isIndependent": true, // Boolean
    "hasLargeCompanyOwnership": false, // Optional boolean
    "hasPartnerCompanies": false, // Optional boolean
    "addSignatureAnchors": true
  }
}
```

## Response Format

### Success Response

```json
{
  "success": true,
  "envelopeId": "12345678-1234-1234-1234-123456789012",
  "signingUrl": "https://demo.docusign.net/Signing/...",
  "expiresIn": 300,
  "message": "Signing session created successfully for [formType] form"
}
```

### Error Response

```json
{
  "error": "Error type",
  "message": "Human-readable error message",
  "validationErrors": ["List of validation errors"] // Only for validation errors
}
```

## Validation Rules

### Date Format
- All dates must be in `DD-MM-YY` format (e.g., "05-07-25")

### Character Limits
- Postal codes: Maximum 6 characters
- KVK numbers: Maximum 8 characters  
- Phone numbers: Maximum 10 characters

### Required Fields
- All fields shown in the examples above are required unless marked as "Optional"
- For De Minimis form: `option2Data` is only required if `selectedOption` is 2, `option3Data` is only required if `selectedOption` is 3

### Number Fields
- `employees`, `annualTurnover`, and `balanceTotal` must be positive numbers
- `selectedOption` must be 1, 2, or 3

### Boolean Fields
- `isIndependent` is required and must be a boolean
- `hasLargeCompanyOwnership` and `hasPartnerCompanies` are optional booleans