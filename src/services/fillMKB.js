const { PDFDocument, rgb } = require('pdf-lib');
const fs = require('fs').promises;
const path = require('path');

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
  const emp = Number(employees);
  const turn = Number(turnover);
  const bal = Number(balanceTotal);
  
  if (!isIndependent) {
    return {
      type: 'Grote onderneming',
      reasoning: 'Company is not independent (>25% owned/controlled by large enterprise)'
    };
  }
  
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
  
  return {
    type: 'Grote onderneming',
    reasoning: 'Exceeds medium enterprise thresholds',
    criteria: {
      exceeds_thresholds: true
    }
  };
}

async function fillMKBVerklaring(data, outputDir = null) {
  try {
    // Determine company size automatically
    const companySize = determineCompanySize(
      data.employees,
      data.annualTurnover,
      data.balanceTotal,
      data.isIndependent !== false
    );
    
    // Load the existing PDF
    const pdfPath = path.join(__dirname, '../pdfs/3 MKB verklaring SLIM.pdf');
    const existingPdfBytes = await fs.readFile(pdfPath);
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    
    // Get the form
    const form = pdfDoc.getForm();
    
    // Fill basic company information (only when values exist)
    if (data.companyName) {
      form.getTextField('naam onderneming').setText(data.companyName);
    }
    if (data.financialYear) {
      form.getTextField('boekjaar').setText(data.financialYear);
    }
    if (data.employees !== undefined && data.employees !== null) {
      form.getTextField('werkzame personen').setText(String(data.employees));
    }
    if (data.annualTurnover !== undefined && data.annualTurnover !== null) {
      form.getTextField('jaaromzet').setText(`€ ${data.annualTurnover}`);
    }
    if (data.balanceTotal !== undefined && data.balanceTotal !== null) {
      form.getTextField('balanstotaal').setText(`€ ${data.balanceTotal}`);
    }
    
    // Fill signer information (only when values exist)
    if (data.signerName) {
      form.getTextField('naam tekenbevoegde').setText(data.signerName);
    }
    if (data.signerPosition) {
      form.getTextField('functie').setText(data.signerPosition);
    }
    if (data.dateAndLocation) {
      form.getTextField('datum en plaats').setText(data.dateAndLocation);
    }
    
    // Select company type based on calculation
    form.getRadioGroup('Type onderneming').select(companySize.type);
    
    // Fill decision tree based on company size
    const emp = Number(data.employees);
    const turn = Number(data.annualTurnover);
    const bal = Number(data.balanceTotal);
    
    // Independence criteria
    if (data.hasLargeCompanyOwnership !== undefined) {
      form.getRadioGroup('stemrechten').select(data.hasLargeCompanyOwnership ? 'ja' : 'nee');
      form.getRadioGroup('kapitaal').select(data.hasLargeCompanyOwnership ? 'ja' : 'nee');
    }
    
    // Decision tree logic
    if (companySize.type === 'Kleine onderneming') {
      form.getRadioGroup('aantal fte').select(emp < 50 ? 'ja' : 'nee');
      form.getRadioGroup('omzet').select(turn <= 10000000 ? 'ja' : 'nee');
      form.getRadioGroup('balans').select(bal <= 10000000 ? 'ja' : 'nee');
    } else if (companySize.type === 'Middelgrote onderneming') {
      form.getRadioGroup('aantal fte').select(emp < 250 ? 'ja' : 'nee');
      form.getRadioGroup('omzet').select(turn <= 50000000 ? 'ja' : 'nee');
      form.getRadioGroup('balans').select(bal <= 43000000 ? 'ja' : 'nee');
      form.getRadioGroup('klein fte').select(emp >= 50 ? 'ja' : 'nee');
      form.getRadioGroup('klein omzet').select(turn > 10000000 ? 'ja' : 'nee');
    }
    
    if (data.hasPartnerCompanies) {
      form.getRadioGroup('opgetelde waarden').select('ja');
    }
    
    // Add signature anchors if requested
    if (data.addSignatureAnchors) {
      const pages = pdfDoc.getPages();
      const lastPage = pages[pages.length - 1]; // MKB form typically has signature on last page
      
      // Add signature anchor (invisible white text)
      lastPage.drawText('/sig1/', {
        x: 450,
        y: 515, // Adjust based on where signature field should be
        size: 1,
        color: rgb(1, 1, 1), // White text (invisible on white background)
      });
      
      // Add date anchor next to signature
      lastPage.drawText('/date1/', {
        x: 200,
        y: 515,
        size: 1,
        color: rgb(1, 1, 1),
      });
    }
    
    // Save the filled PDF
    const pdfBytes = await pdfDoc.save();
    const outputFileName = `filled-mkb-verklaring-${Date.now()}.pdf`;
    
    // If outputDir is provided, save to disk (backward compatibility)
    if (outputDir) {
      const outputPath = path.join(outputDir, outputFileName);
      await fs.writeFile(outputPath, pdfBytes);
      return {
        filename: outputFileName,
        companySize: companySize
      };
    }
    
    // Otherwise return the PDF bytes and filename
    return {
      filename: outputFileName,
      pdfBytes: pdfBytes,
      companySize: companySize
    };
    
  } catch (error) {
    throw new Error(`Error filling MKB Verklaring: ${error.message}`);
  }
}

module.exports = { 
  fillMKBVerklaring,
  determineCompanySize,
  SME_THRESHOLDS
};