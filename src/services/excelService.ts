import * as XLSX from 'xlsx';
import { CompanyInfo } from '../types/application';

/**
 * Service for generating Excel files from application data
 * Following DRY principle - single source of truth for Excel generation
 */
export class ExcelService {
  /**
   * Generate an Excel file from company data
   * Creates a simple key-value spreadsheet for easy CRM import
   */
  generateCompanyDataExcel(data: CompanyInfo): Buffer {
    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();

    // Prepare data in key-value format for easy reading
    const rows = [
      ['Field', 'Value'],
      ['', ''], // Spacer
      ['Metadata', ''],
      ['Applicatie ID', data.applicationId],
      ['Tenant ID', data.tenantId],
      ['Datum', data.datum],
      ['', ''], // Spacer
      ['Bedrijfsinfo', ''],
      ['Bedrijfsnaam', data.bedrijfsnaam],
      ['KvK-nummer', data.kvkNummer],
      ['BTW-identificatienummer', data.btwId],
      ['Website', data.website],
      ['Adres', data.adres],
      ['Postcode', data.postcode],
      ['Plaats', data.plaats],
      ['Provincie', data.provincie],
      ['NACE-classificatie', data.naceClassificatie],
      ['', ''], // Spacer
      ['Contactpersoon', ''],
      ['Naam', data.contactNaam],
      ['Telefoonnummer', data.contactTelefoon],
      ['Email', data.contactEmail],
      ['Geslacht', data.contactGeslacht],
      ['Vertegenwoordiger', data.hoofdcontactPersoon]
    ];

    // Create worksheet from array
    const worksheet = XLSX.utils.aoa_to_sheet(rows);

    // Set column widths for better readability
    worksheet['!cols'] = [
      { wch: 30 }, // Field name column
      { wch: 50 }  // Value column
    ];

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Company Data');

    // Generate buffer
    const excelBuffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx'
    });

    return excelBuffer;
  }

  /**
   * Generate filename for company data Excel file
   * Format: company-data.xlsx (consistent naming)
   */
  getCompanyDataFileName(): string {
    return 'company-data.xlsx';
  }
}
