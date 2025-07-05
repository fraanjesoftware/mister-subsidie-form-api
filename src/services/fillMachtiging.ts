import { PDFDocument, rgb } from 'pdf-lib';
import * as fs from 'fs/promises';
import * as path from 'path';

interface MachtigingFormData {
  applicantData?: {
    companyName?: string;
    email?: string;
    kvkNumber?: string;
    contactPerson?: string;
    contactEmail?: string;
    position?: string;
    phoneNumber?: string;
    date?: string;
  };
  representativeData?: {
    companyName?: string;
    contactPerson?: string;
    email?: string;
    signDate1?: string;
    name?: string;
    position?: string;
    phoneNumber?: string;
    signDate2?: string;
  };
  addSignatureAnchors?: boolean;
}

interface FillFormResult {
  filename: string;
  pdfBytes: Uint8Array;
}

export async function fillMachtigingsformulier(
  data: MachtigingFormData,
  outputDir?: string | null
): Promise<string | FillFormResult> {
  try {
    // Note: PDF template for Machtiging form needs to be added
    const pdfPath = path.join(__dirname, '../pdfs/machtigingsformulier.pdf');
    
    // Check if file exists
    try {
      await fs.access(pdfPath);
    } catch {
      throw new Error('Machtigingsformulier PDF template not found. Please add the template to src/pdfs/');
    }
    
    const existingPdfBytes = await fs.readFile(pdfPath);
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    
    // const form = pdfDoc.getForm();
    
    // Fill applicant data if provided
    if (data.applicantData) {
      // Note: Field names need to be mapped to actual PDF form fields
      // This is a placeholder implementation
    }
    
    // Fill representative data if provided
    if (data.representativeData) {
      // Note: Field names need to be mapped to actual PDF form fields
      // This is a placeholder implementation
    }
    
    // Add signature anchors if requested
    if (data.addSignatureAnchors) {
      const pages = pdfDoc.getPages();
      const lastPage = pages[pages.length - 1];
      
      // Add signature anchors (positions need to be adjusted based on actual form)
      lastPage.drawText('/sig1/', {
        x: 100,
        y: 100,
        size: 6,
        color: rgb(0.95, 0.95, 0.95),
      });
      
      lastPage.drawText('/date1/', {
        x: 200,
        y: 100,
        size: 6,
        color: rgb(0.95, 0.95, 0.95),
      });
    }
    
    // Save the filled PDF
    const pdfBytes = await pdfDoc.save();
    const outputFileName = `filled-machtiging-${Date.now()}.pdf`;
    
    // If outputDir is provided, save to disk (backward compatibility)
    if (outputDir) {
      const outputPath = path.join(outputDir, outputFileName);
      await fs.writeFile(outputPath, pdfBytes);
      return outputFileName;
    }
    
    // Otherwise return the PDF bytes and filename
    return {
      filename: outputFileName,
      pdfBytes: pdfBytes
    };
    
  } catch (error) {
    throw new Error(`Error filling Machtigingsformulier: ${(error as Error).message}`);
  }
}