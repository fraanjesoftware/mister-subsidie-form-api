// Data models for subsidy forms

// De Minimis Form Data Model
const DeMinimisFormData = {
  selectedOption: null, // 1, 2, or 3
  option2Data: {
    field_1_2: '',
    field_1_3: '',
    field_1_4: ''
  },
  option3Data: {
    field_1_2: '',
    field_1_3: '',
    field_1_4: ''
  },
  generalData: {
    companyName: '',
    kvkNumber: '', // Chamber of Commerce number
    street: '',
    houseNumber: '',
    city: '',
    postalCode: '', // Max 6 characters
    signerName: '',
    date: '' // Format: DD-MM-YY (max 8 chars)
  },
  addSignatureAnchors: true
};

// Machtiging (Authorization) Form Data Model
const MachtigingFormData = {
  applicantData: {
    companyName: '',
    email: '',
    kvkNumber: '', // Max 8 characters
    contactPerson: '',
    contactEmail: '',
    position: '',
    phoneNumber: '', // Max 10 characters
    date: '' // Format: DD-MM-YY (max 8 chars)
  },
  representativeData: {
    companyName: '',
    contactPerson: '',
    email: '',
    signDate1: '', // Format: DD-MM-YY (max 8 chars)
    name: '',
    position: '',
    phoneNumber: '',
    signDate2: '' // Format: DD-MM-YY (max 8 chars)
  },
  addSignatureAnchors: true
};

// MKB (SME) Form Data Model
const MKBFormData = {
  companyName: '',
  financialYear: '',
  employees: null, // Number of employees
  annualTurnover: null, // Annual turnover in euros
  balanceTotal: null, // Balance sheet total in euros
  signerName: '',
  signerPosition: '',
  dateAndLocation: '',
  isIndependent: true, // Whether company is independent
  hasLargeCompanyOwnership: false, // If >25% owned by large enterprise
  hasPartnerCompanies: false, // If company has partner companies
  addSignatureAnchors: true
};

// Validation functions
function validateDeMinimisData(data) {
  const errors = [];
  
  if (!data.selectedOption || ![1, 2, 3].includes(data.selectedOption)) {
    errors.push('selectedOption must be 1, 2, or 3');
  }
  
  if (data.selectedOption === 2 && (!data.option2Data.field_1_2 || !data.option2Data.field_1_3 || !data.option2Data.field_1_4)) {
    errors.push('option2Data fields are required when selectedOption is 2');
  }
  
  if (data.selectedOption === 3 && (!data.option3Data.field_1_2 || !data.option3Data.field_1_3 || !data.option3Data.field_1_4)) {
    errors.push('option3Data fields are required when selectedOption is 3');
  }
  
  if (!data.generalData.companyName || !data.generalData.kvkNumber || !data.generalData.signerName || !data.generalData.date) {
    errors.push('generalData required fields: companyName, kvkNumber, signerName, date');
  }
  
  if (data.generalData.postalCode && data.generalData.postalCode.length > 6) {
    errors.push('postalCode must be max 6 characters');
  }
  
  if (data.generalData.date && !data.generalData.date.match(/^\d{2}-\d{2}-\d{2}$/)) {
    errors.push('date must be in DD-MM-YY format');
  }
  
  return errors;
}

function validateMKBData(data) {
  const errors = [];
  
  // Required fields
  const required = ['companyName', 'financialYear', 'employees', 'annualTurnover', 'balanceTotal', 'signerName', 'signerPosition', 'dateAndLocation'];
  for (const field of required) {
    if (data[field] === null || data[field] === undefined || data[field] === '') {
      errors.push(`${field} is required`);
    }
  }
  
  // Validate numeric fields
  if (typeof data.employees !== 'number' || data.employees < 0) {
    errors.push('employees must be a positive number');
  }
  
  if (typeof data.annualTurnover !== 'number' || data.annualTurnover < 0) {
    errors.push('annualTurnover must be a positive number');
  }
  
  if (typeof data.balanceTotal !== 'number' || data.balanceTotal < 0) {
    errors.push('balanceTotal must be a positive number');
  }
  
  if (typeof data.isIndependent !== 'boolean') {
    errors.push('isIndependent must be a boolean');
  }
  
  return errors;
}

module.exports = {
  DeMinimisFormData,
  MKBFormData,
  validateDeMinimisData,
  validateMKBData
};