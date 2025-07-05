// Data models for subsidy forms

// De Minimis Form Data Model
export interface DeMinimisFormData {
  selectedOption: number | null; // 1, 2, or 3
  option2Data: {
    field_1_2: string;
    field_1_3: string;
    field_1_4: string;
  };
  option3Data: {
    field_1_2: string;
    field_1_3: string;
    field_1_4: string;
  };
  generalData: {
    companyName: string;
    kvkNumber: string; // Chamber of Commerce number
    street: string;
    houseNumber: string;
    city: string;
    postalCode: string; // Max 6 characters
    signerName: string;
    date: string; // Format: DD-MM-YY (max 8 chars)
  };
  addSignatureAnchors: boolean;
}

// Machtiging (Authorization) Form Data Model
export interface MachtigingFormData {
  applicantData: {
    companyName: string;
    email: string;
    kvkNumber: string; // Max 8 characters
    contactPerson: string;
    contactEmail: string;
    position: string;
    phoneNumber: string; // Max 10 characters
    date: string; // Format: DD-MM-YY (max 8 chars)
  };
  representativeData: {
    companyName: string;
    contactPerson: string;
    email: string;
    signDate1: string; // Format: DD-MM-YY (max 8 chars)
    name: string;
    position: string;
    phoneNumber: string;
    signDate2: string; // Format: DD-MM-YY (max 8 chars)
  };
  addSignatureAnchors: boolean;
}

// MKB (SME) Form Data Model
export interface MKBFormData {
  companyName: string;
  financialYear: string;
  employees: number | null; // Number of employees
  annualTurnover: number | null; // Annual turnover in euros
  balanceTotal: number | null; // Balance sheet total in euros
  signerName: string;
  signerPosition: string;
  dateAndLocation: string;
  isIndependent: boolean; // Whether company is independent
  hasLargeCompanyOwnership: boolean; // If >25% owned by large enterprise
  hasPartnerCompanies: boolean; // If company has partner companies
  addSignatureAnchors: boolean;
}

// Default data templates
export const DeMinimisFormDataDefaults: DeMinimisFormData = {
  selectedOption: null,
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
    kvkNumber: '',
    street: '',
    houseNumber: '',
    city: '',
    postalCode: '',
    signerName: '',
    date: ''
  },
  addSignatureAnchors: true
};

export const MachtigingFormDataDefaults: MachtigingFormData = {
  applicantData: {
    companyName: '',
    email: '',
    kvkNumber: '',
    contactPerson: '',
    contactEmail: '',
    position: '',
    phoneNumber: '',
    date: ''
  },
  representativeData: {
    companyName: '',
    contactPerson: '',
    email: '',
    signDate1: '',
    name: '',
    position: '',
    phoneNumber: '',
    signDate2: ''
  },
  addSignatureAnchors: true
};

export const MKBFormDataDefaults: MKBFormData = {
  companyName: '',
  financialYear: '',
  employees: null,
  annualTurnover: null,
  balanceTotal: null,
  signerName: '',
  signerPosition: '',
  dateAndLocation: '',
  isIndependent: true,
  hasLargeCompanyOwnership: false,
  hasPartnerCompanies: false,
  addSignatureAnchors: true
};

// Validation functions
export function validateDeMinimisData(data: DeMinimisFormData): string[] {
  const errors: string[] = [];
  
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

export function validateMKBData(data: MKBFormData): string[] {
  const errors: string[] = [];
  
  // Required fields
  const required: (keyof MKBFormData)[] = ['companyName', 'financialYear', 'employees', 'annualTurnover', 'balanceTotal', 'signerName', 'signerPosition', 'dateAndLocation'];
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