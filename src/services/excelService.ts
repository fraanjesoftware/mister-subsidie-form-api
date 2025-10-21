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

    // Prepare data in database-ready format (columns = fields, rows = entries)
    // This allows easy import into CRM/DB and accumulation of multiple applications
    const rows = [
      // Header row - these will become database field names
      [
        'Applicatie ID',
        'Tenant ID',
        'Datum',
        'Bedrijfsnaam',
        'KvK-nummer',
        'BTW-identificatienummer',
        'Website',
        'Adres',
        'Postcode',
        'Plaats',
        'Provincie',
        'NACE-classificatie',
        'Contactpersoon',
        'Telefoonnummer',
        'Email',
        'Geslacht',
        'Vertegenwoordiger'
      ],
      // Data row - this application's values
      [
        data.applicationId,
        data.tenantId,
        data.datum,
        data.bedrijfsnaam,
        data.kvkNummer,
        data.btwId,
        data.website,
        data.adres,
        data.postcode,
        data.plaats,
        data.provincie,
        data.naceClassificatie,
        data.contactNaam,
        data.contactTelefoon,
        data.contactEmail,
        data.contactGeslacht,
        data.hoofdcontactPersoon
      ]
    ];

    // Create worksheet from array
    const worksheet = XLSX.utils.aoa_to_sheet(rows);

    // Set column widths for better readability
    const columnWidths = [
      { wch: 20 }, // Applicatie ID
      { wch: 15 }, // Tenant ID
      { wch: 12 }, // Datum
      { wch: 25 }, // Bedrijfsnaam
      { wch: 12 }, // KvK-nummer
      { wch: 18 }, // BTW-identificatienummer
      { wch: 30 }, // Website
      { wch: 30 }, // Adres
      { wch: 10 }, // Postcode
      { wch: 20 }, // Plaats
      { wch: 20 }, // Provincie
      { wch: 18 }, // NACE-classificatie
      { wch: 25 }, // Contactpersoon
      { wch: 15 }, // Telefoonnummer
      { wch: 30 }, // Email
      { wch: 10 }, // Geslacht
      { wch: 15 }  // Vertegenwoordiger
    ];
    worksheet['!cols'] = columnWidths;

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
   * Format: bedrijfsinfo.xlsx (consistent naming)
   */
  getCompanyDataFileName(): string {
    return 'bedrijfsinfo.xlsx';
  }
}
