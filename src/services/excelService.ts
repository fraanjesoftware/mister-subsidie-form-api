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
    const columns: Array<{ key: keyof CompanyInfo; label: string }> = [
      { key: 'applicationId', label: 'Applicatie ID' },
      { key: 'tenantId', label: 'Tenant ID' },
      { key: 'datum', label: 'Datum' },
      { key: 'bedrijfsnaam', label: 'Bedrijfsnaam' },
      { key: 'kvkNummer', label: 'KvK-nummer' },
      { key: 'btwId', label: 'BTW-identificatienummer' },
      { key: 'website', label: 'Website' },
      { key: 'adres', label: 'Adres' },
      { key: 'postcode', label: 'Postcode' },
      { key: 'plaats', label: 'Plaats' },
      { key: 'provincie', label: 'Provincie' },
      { key: 'naceClassificatie', label: 'NACE-classificatie' },
      { key: 'contactNaam', label: 'Contactpersoon' },
      { key: 'contactTelefoon', label: 'Telefoonnummer' },
      { key: 'contactEmail', label: 'Email' },
      { key: 'contactGeslacht', label: 'Geslacht' },
      { key: 'hoofdcontactPersoon', label: 'Vertegenwoordiger' }
    ];

    const headerLabels = columns.map(column => column.label);
    const dataRow = columns.reduce<Record<string, string | number | undefined>>((row, column) => {
      row[column.label] = data[column.key] ?? '';
      return row;
    }, {});

    const worksheet = XLSX.utils.json_to_sheet([dataRow], {
      header: headerLabels
    });

    // Mark header row explicitly so Excel recognises it
    worksheet['!ref'] = XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: 1, c: headerLabels.length - 1 }
    });
    worksheet['!autofilter'] = { ref: worksheet['!ref'] };

    headerLabels.forEach((_, columnIndex) => {
      const cellRef = XLSX.utils.encode_cell({ r: 0, c: columnIndex });
      const cell = worksheet[cellRef];

      if (cell) {
        cell.s = {
          font: { bold: true }
        };
      }
    });

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
  getCompanyDataFileName(companyName?: string): string {
    const baseName = 'Bedrijfsinfo.xlsx';
    if (!companyName) {
      return baseName;
    }

    const sanitizedCompany = companyName.replace(/[<>:"/\\|?*]/g, '_').trim();
    if (!sanitizedCompany) {
      return baseName;
    }

    return `${sanitizedCompany} - ${baseName}`;
  }
}
