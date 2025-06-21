const { PDFDocument } = require('pdf-lib');
const fs = require('fs');

// EU SME Definition thresholds
const SME_THRESHOLDS = {
  SMALL: {
    employees: 50,
    turnover: 10000000, // €10 million
    balance: 10000000   // €10 million
  },
  MEDIUM: {
    employees: 250,
    turnover: 50000000, // €50 million
    balance: 43000000   // €43 million
  }
};

// Determine company size based on EU SME criteria
function determineCompanySize(employees, turnover, balanceTotal, isIndependent = true) {
  // Convert to numbers if strings
  const emp = Number(employees);
  const turn = Number(turnover);
  const bal = Number(balanceTotal);
  
  // If not independent (>25% owned by large company), it's automatically large
  if (!isIndependent) {
    return {
      type: 'Grote onderneming',
      reasoning: 'Company is not independent (>25% owned/controlled by large enterprise)'
    };
  }
  
  // Check for small enterprise
  if (emp < SME_THRESHOLDS.SMALL.employees && 
      (turn <= SME_THRESHOLDS.SMALL.turnover || bal <= SME_THRESHOLDS.SMALL.balance)) {
    return {
      type: 'Kleine onderneming',
      reasoning: `Employees: ${emp} < ${SME_THRESHOLDS.SMALL.employees} AND (Turnover: €${turn} OR Balance: €${bal}) <= €${SME_THRESHOLDS.SMALL.turnover}`,
      criteria: {
        fte_under_50: true,
        turnover_under_10m: turn <= SME_THRESHOLDS.SMALL.turnover,
        balance_under_10m: bal <= SME_THRESHOLDS.SMALL.balance
      }
    };
  }
  
  // Check for medium enterprise
  if (emp < SME_THRESHOLDS.MEDIUM.employees && 
      (turn <= SME_THRESHOLDS.MEDIUM.turnover || bal <= SME_THRESHOLDS.MEDIUM.balance)) {
    return {
      type: 'Middelgrote onderneming',
      reasoning: `Employees: ${emp} < ${SME_THRESHOLDS.MEDIUM.employees} AND (Turnover: €${turn} <= €${SME_THRESHOLDS.MEDIUM.turnover} OR Balance: €${bal} <= €${SME_THRESHOLDS.MEDIUM.balance})`,
      criteria: {
        fte_under_250: true,
        turnover_under_50m: turn <= SME_THRESHOLDS.MEDIUM.turnover,
        balance_under_43m: bal <= SME_THRESHOLDS.MEDIUM.balance
      }
    };
  }
  
  // Otherwise it's a large enterprise
  return {
    type: 'Grote onderneming',
    reasoning: 'Exceeds medium enterprise thresholds',
    criteria: {
      exceeds_thresholds: true
    }
  };
}

async function fillMKBVerklaring(data) {
  try {
    // Determine company size automatically
    const companySize = determineCompanySize(
      data.employees,
      data.annualTurnover,
      data.balanceTotal,
      data.isIndependent !== false // Default to true if not specified
    );
    
    console.log('\nCompany Size Determination:');
    console.log(`Type: ${companySize.type}`);
    console.log(`Reasoning: ${companySize.reasoning}\n`);
    
    // Load the existing PDF
    const existingPdfBytes = fs.readFileSync('3 MKB+verklaring+SLIM (1).pdf');
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    
    // Get the form
    const form = pdfDoc.getForm();
    
    // Get all fields
    const companyNameField = form.getTextField('naam onderneming');
    const financialYearField = form.getTextField('boekjaar');
    const employeesField = form.getTextField('werkzame personen');
    const turnoverField = form.getTextField('jaaromzet');
    const balanceField = form.getTextField('balanstotaal');
    const signerNameField = form.getTextField('naam tekenbevoegde');
    const positionField = form.getTextField('functie');
    const dateLocationField = form.getTextField('datum en plaats');
    
    // Radio groups
    const companyTypeRadio = form.getRadioGroup('Type onderneming');
    const fteRadio = form.getRadioGroup('aantal fte');
    const turnoverRadio = form.getRadioGroup('omzet');
    const balanceRadio = form.getRadioGroup('balans');
    const votingRightsRadio = form.getRadioGroup('stemrechten');
    const capitalRadio = form.getRadioGroup('kapitaal');
    const aggregatedValuesRadio = form.getRadioGroup('opgetelde waarden');
    const smallFteRadio = form.getRadioGroup('klein fte');
    const smallTurnoverRadio = form.getRadioGroup('klein omzet');
    
    // Fill basic company information
    companyNameField.setText(data.companyName || '');
    financialYearField.setText(data.financialYear || '');
    employeesField.setText(String(data.employees) || '');
    turnoverField.setText(`€ ${data.annualTurnover || ''}`.trim());
    balanceField.setText(`€ ${data.balanceTotal || ''}`.trim());
    
    // Fill signer information
    signerNameField.setText(data.signerName || '');
    positionField.setText(data.signerPosition || '');
    dateLocationField.setText(data.dateAndLocation || '');
    
    // Select company type based on calculation
    companyTypeRadio.select(companySize.type);
    
    // Fill decision tree based on company size
    const emp = Number(data.employees);
    const turn = Number(data.annualTurnover);
    const bal = Number(data.balanceTotal);
    
    // Independence criteria (if provided)
    if (data.hasLargeCompanyOwnership !== undefined) {
      votingRightsRadio.select(data.hasLargeCompanyOwnership ? 'ja' : 'nee');
      capitalRadio.select(data.hasLargeCompanyOwnership ? 'ja' : 'nee');
    }
    
    // For decision tree logic
    if (companySize.type === 'Kleine onderneming') {
      // Small company criteria
      fteRadio.select(emp < 50 ? 'ja' : 'nee');
      turnoverRadio.select(turn <= 10000000 ? 'ja' : 'nee');
      balanceRadio.select(bal <= 10000000 ? 'ja' : 'nee');
    } else if (companySize.type === 'Middelgrote onderneming') {
      // Medium company criteria
      fteRadio.select(emp < 250 ? 'ja' : 'nee');
      turnoverRadio.select(turn <= 50000000 ? 'ja' : 'nee');
      balanceRadio.select(bal <= 43000000 ? 'ja' : 'nee');
      
      // Also check if it exceeds small company thresholds
      smallFteRadio.select(emp >= 50 ? 'ja' : 'nee');
      smallTurnoverRadio.select(turn > 10000000 ? 'ja' : 'nee');
    }
    
    // If partner companies exist, handle aggregated values
    if (data.hasPartnerCompanies) {
      aggregatedValuesRadio.select('ja');
    }
    
    // Save the filled PDF
    const pdfBytes = await pdfDoc.save();
    const outputFileName = `filled-mkb-verklaring-${Date.now()}.pdf`;
    fs.writeFileSync(outputFileName, pdfBytes);
    
    console.log(`MKB Verklaring filled successfully! Saved as: ${outputFileName}`);
    
    return {
      filename: outputFileName,
      companySize: companySize
    };
    
  } catch (error) {
    console.error('Error filling PDF:', error);
  }
}

// Example usage with different company scenarios
async function runExamples() {
  console.log('=== Running MKB Verklaring Examples ===\n');
  
  // Example 1: Small Company
  console.log('Example 1: Small Company');
  await fillMKBVerklaring({
    companyName: 'Klein Bedrijf B.V.',
    financialYear: '2024',
    employees: 25,
    annualTurnover: 5000000,  // €5 million
    balanceTotal: 3000000,     // €3 million
    signerName: 'Jan Kleinman',
    signerPosition: 'Directeur',
    dateAndLocation: '21-06-2025, Amsterdam',
    isIndependent: true,
    hasLargeCompanyOwnership: false,
    hasPartnerCompanies: false
  });
  
  // Example 2: Medium Company
  console.log('\nExample 2: Medium Company');
  await fillMKBVerklaring({
    companyName: 'Middelgroot Bedrijf B.V.',
    financialYear: '2024',
    employees: 150,
    annualTurnover: 35000000,  // €35 million
    balanceTotal: 25000000,     // €25 million
    signerName: 'Maria Middelman',
    signerPosition: 'CEO',
    dateAndLocation: '21-06-2025, Utrecht',
    isIndependent: true,
    hasLargeCompanyOwnership: false,
    hasPartnerCompanies: false
  });
  
  // Example 3: Large Company
  console.log('\nExample 3: Large Company');
  await fillMKBVerklaring({
    companyName: 'Groot Concern N.V.',
    financialYear: '2024',
    employees: 500,
    annualTurnover: 100000000,  // €100 million
    balanceTotal: 75000000,      // €75 million
    signerName: 'Peter Grootman',
    signerPosition: 'CFO',
    dateAndLocation: '21-06-2025, Rotterdam',
    isIndependent: true,
    hasLargeCompanyOwnership: false,
    hasPartnerCompanies: false
  });
  
  // Example 4: Small company but not independent
  console.log('\nExample 4: Small metrics but owned by large company');
  await fillMKBVerklaring({
    companyName: 'Dochter Bedrijf B.V.',
    financialYear: '2024',
    employees: 30,
    annualTurnover: 4000000,   // €4 million
    balanceTotal: 2000000,      // €2 million
    signerName: 'Lisa Dochter',
    signerPosition: 'Manager',
    dateAndLocation: '21-06-2025, Eindhoven',
    isIndependent: false,       // Owned by large company
    hasLargeCompanyOwnership: true,
    hasPartnerCompanies: true
  });
}

// Export functions
module.exports = { 
  fillMKBVerklaring,
  determineCompanySize,
  SME_THRESHOLDS
};

// Run examples if this file is executed directly
if (require.main === module) {
  runExamples();
}