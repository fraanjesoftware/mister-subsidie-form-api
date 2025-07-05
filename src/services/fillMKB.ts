import { PDFDocument, rgb } from 'pdf-lib';
import * as fs from 'fs/promises';
import * as path from 'path';

// EU SME Definition thresholds
export const SME_THRESHOLDS = {
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

interface CompanySizeCriteria {
  fte_under_50?: boolean;
  turnover_under_10m?: boolean;
  balance_under_10m?: boolean;
  fte_under_250?: boolean;
  turnover_under_50m?: boolean;
  balance_under_43m?: boolean;
  exceeds_thresholds?: boolean;
}

interface CompanySize {
  type: 'Kleine onderneming' | 'Middelgrote onderneming' | 'Grote onderneming';
  reasoning: string;
  criteria?: CompanySizeCriteria;
}

interface MKBFormData {
  companyName?: string;
  financialYear?: string;
  employees: number | string;
  annualTurnover: number | string;
  balanceTotal: number | string;
  signerName?: string;
  signerPosition?: string;
  dateAndLocation?: string;
  isIndependent?: boolean;
  hasLargeCompanyOwnership?: boolean;
  hasPartnerCompanies?: boolean;
  addSignatureAnchors?: boolean;
}

interface FillMKBResult {
  filename: string;
  pdfBytes?: Uint8Array;
  companySize: CompanySize;
}

// Determine company size based on EU SME criteria
export function determineCompanySize(
  employees: number | string,
  turnover: number | string,
  balanceTotal: number | string,
  isIndependent: boolean = true
): CompanySize {
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

export async function fillMKBVerklaring(
  data: MKBFormData,
  outputDir?: string | null
): Promise<FillMKBResult> {
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
    
    // Independence criteria
    if (data.hasLargeCompanyOwnership !== undefined) {
      votingRightsRadio.select(data.hasLargeCompanyOwnership ? 'ja' : 'nee');
      capitalRadio.select(data.hasLargeCompanyOwnership ? 'ja' : 'nee');
    }
    
    // Decision tree logic
    if (companySize.type === 'Kleine onderneming') {
      fteRadio.select(emp < 50 ? 'ja' : 'nee');
      turnoverRadio.select(turn <= 10000000 ? 'ja' : 'nee');
      balanceRadio.select(bal <= 10000000 ? 'ja' : 'nee');
    } else if (companySize.type === 'Middelgrote onderneming') {
      fteRadio.select(emp < 250 ? 'ja' : 'nee');
      turnoverRadio.select(turn <= 50000000 ? 'ja' : 'nee');
      balanceRadio.select(bal <= 43000000 ? 'ja' : 'nee');
      smallFteRadio.select(emp >= 50 ? 'ja' : 'nee');
      smallTurnoverRadio.select(turn > 10000000 ? 'ja' : 'nee');
    }
    
    if (data.hasPartnerCompanies) {
      aggregatedValuesRadio.select('ja');
    }
    
    // Add signature anchors if requested
    if (data.addSignatureAnchors) {
      const pages = pdfDoc.getPages();
      const lastPage = pages[pages.length - 1]; // MKB form typically has signature on last page
      
      // Add invisible text for DocuSign anchor
      // const { height } = lastPage.getSize();
      
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
    throw new Error(`Error filling MKB Verklaring: ${(error as Error).message}`);
  }
}