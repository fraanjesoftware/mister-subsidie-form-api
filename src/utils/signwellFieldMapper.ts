import { SignWellField } from '../types/signwell';

export interface TextTab {
  tabLabel: string;
  value: string;
}

export interface RadioGroupTab {
  groupName: string;
  radios: Array<{
    value: string;
    selected: boolean;
  }>;
}

export interface ListTab {
  tabLabel: string;
  value: string;
}

export interface RecipientTabs {
  textTabs?: TextTab[];
  radioGroupTabs?: RadioGroupTab[];
  listTabs?: ListTab[];
}

/**
 * Maps text tabs to SignWell fields
 */
export function mapTextTabs(textTabs: TextTab[], recipientId: string): SignWellField[] {
  if (!textTabs || textTabs.length === 0) return [];
  
  return textTabs.map(tab => ({
    api_id: tab.tabLabel,
    value: tab.value,
    recipient_id: recipientId,
  }));
}

/**
 * Converts radio group tabs to checkbox fields for SignWell
 * Since SignWell doesn't support radio buttons, we convert them to checkboxes
 */
export function convertRadioGroupsToCheckboxes(radioGroupTabs: RadioGroupTab[], recipientId: string): SignWellField[] {
  if (!radioGroupTabs || radioGroupTabs.length === 0) return [];
  
  const checkboxFields: SignWellField[] = [];
  
  radioGroupTabs.forEach(group => {
    group.radios.forEach(radio => {
      checkboxFields.push({
        api_id: radio.value,
        value: radio.selected,
        recipient_id: recipientId,
      });
    });
  });
  
  return checkboxFields;
}

/**
 * Maps list tabs to SignWell dropdown fields
 */
export function mapListTabs(listTabs: ListTab[], recipientId: string): SignWellField[] {
  if (!listTabs || listTabs.length === 0) return [];
  
  return listTabs.map(tab => ({
    api_id: tab.tabLabel,
    value: tab.value,
    recipient_id: recipientId,
  }));
}

/**
 * Maps recipient tabs to template fields for multi-signer templates
 * @param tabs - The tabs data from the frontend
 * @param recipientId - The recipient ID ('recipient_1' or 'recipient_2')
 * @param isSecondSigner - Whether this is for the second signer
 */
export function mapRecipientTabsToTemplateFieldsWithRecipient(
  tabs: RecipientTabs, 
  recipientId: string,
  isSecondSigner: boolean = false
): Array<{ api_id: string; value: string | boolean; recipient_id: string }> {
  const templateFields: Array<{ api_id: string; value: string | boolean; recipient_id: string }> = [];
  
  if (isSecondSigner) {
    // For second signer, only map the second signer fields
    const secondSignerFields = ['voorletters-tekenbevoegde-2', 'achternaam-tekenbevoegde-2', 'functie-tekenbevoegde-2'];
    
    if (tabs.textTabs) {
      tabs.textTabs.forEach(tab => {
        if (secondSignerFields.includes(tab.tabLabel)) {
          templateFields.push({
            api_id: tab.tabLabel,
            value: tab.value,
            recipient_id: recipientId,
          });
        }
      });
    }
  } else {
    // For primary signer, map all fields except second signer fields
    const fields = mapRecipientTabsToTemplateFields(tabs);
    fields.forEach(field => {
      // Skip second signer fields for primary recipient
      if (!['voorletters-tekenbevoegde-2', 'achternaam-tekenbevoegde-2', 'functie-tekenbevoegde-2'].includes(field.api_id)) {
        templateFields.push({
          ...field,
          recipient_id: recipientId,
        });
      }
    });
  }
  
  return templateFields;
}

/**
 * Maps all recipient tabs to SignWell template fields
 * Handles duplicate fields (e.g., bedrijfsnaam_2, bedrijfsnaam_3) that represent the same value
 */
export function mapRecipientTabsToTemplateFields(tabs: RecipientTabs): Array<{ api_id: string; value: string | boolean }> {
  const templateFields: Array<{ api_id: string; value: string | boolean }> = [];
  const fieldValues: Record<string, string | boolean> = {};
  
  // List of conditional fields that should get a space if empty
  const conditionalFields = ['minimis-2.1', 'minimis-3.1', 'minimis-3.2'];
  
  // List of fields that actually exist in the SignWell template
  const validTemplateFields = [
    // Text fields from template
    'bedrijfsnaam', 'bedrijfsnaam_2', 'bedrijfsnaam_3',
    'kvk', 'kvk_2',
    'onderneming-adres',
    'postcode',
    'plaats', 'plaats_2',
    'nace',
    'voorletters-tekenbevoegde',
    'achternaam-tekenbevoegde',
    'functie', 'functie_2',
    // Second signer fields for two-signer template
    'voorletters-tekenbevoegde-2',
    'achternaam-tekenbevoegde-2',
    'functie-tekenbevoegde-2',
    'fte',
    'jaaromzet',
    'balanstotaal',
    'boekjaar',
    'minimis-2.1',
    'minimis-3.1',
    'minimis-3.2',
    // Checkbox fields
    'geen', 'wel', 'andere',
    'kleine', 'middel', 'grote',
    // Autofill fields
    'Name_1',
    'Email_1'
  ];
  
  // Map text tabs
  if (tabs.textTabs) {
    tabs.textTabs.forEach(tab => {
      // Only process fields that exist in the template
      if (!validTemplateFields.includes(tab.tabLabel)) {
        console.log(`Skipping field '${tab.tabLabel}' - not in template`);
        return;
      }
      
      let value = tab.value;
      
      // For conditional fields, if empty or undefined, use a space
      if (conditionalFields.includes(tab.tabLabel) && (!value || value.trim() === '')) {
        value = ' ';
      }
      
      fieldValues[tab.tabLabel] = value;
      templateFields.push({
        api_id: tab.tabLabel,
        value: value,
      });
    });
  }
  
  // Add empty conditional fields that weren't provided
  conditionalFields.forEach(fieldId => {
    if (!fieldValues.hasOwnProperty(fieldId)) {
      templateFields.push({
        api_id: fieldId,
        value: ' ',
      });
    }
  });
  
  // Convert radio groups to checkboxes
  if (tabs.radioGroupTabs) {
    tabs.radioGroupTabs.forEach(group => {
      group.radios.forEach(radio => {
        // Only process checkbox fields that exist in the template
        if (!validTemplateFields.includes(radio.value)) {
          console.log(`Skipping checkbox '${radio.value}' - not in template`);
          return;
        }
        
        fieldValues[radio.value] = radio.selected;
        templateFields.push({
          api_id: radio.value,
          value: radio.selected,
        });
      });
    });
  }
  
  // Map list tabs (dropdowns)
  if (tabs.listTabs) {
    tabs.listTabs.forEach(tab => {
      // Only process fields that exist in the template
      if (!validTemplateFields.includes(tab.tabLabel)) {
        console.log(`Skipping list field '${tab.tabLabel}' - not in template`);
        return;
      }
      
      fieldValues[tab.tabLabel] = tab.value;
      templateFields.push({
        api_id: tab.tabLabel,
        value: tab.value,
      });
    });
  }
  
  // Add duplicate fields with _2, _3 suffixes based on actual template fields
  const duplicateFieldMap: Record<string, string[]> = {
    'bedrijfsnaam': ['bedrijfsnaam_2', 'bedrijfsnaam_3'],
    'kvk': ['kvk_2'],
    'functie': ['functie_2'],
    'plaats': ['plaats_2'],
    // Note: voorletters-tekenbevoegde and achternaam-tekenbevoegde exist but don't have _2 versions in template
    // Note: functie-tekenbevoegde doesn't exist in the template
  };
  
  Object.entries(duplicateFieldMap).forEach(([originalField, duplicates]) => {
    if (fieldValues[originalField] !== undefined) {
      duplicates.forEach(duplicateField => {
        templateFields.push({
          api_id: duplicateField,
          value: fieldValues[originalField],
        });
      });
    }
  });
  
  // Handle autofill fields that exist in the template
  // Name_1 is an autofill field - try to populate from voorletters + achternaam
  const voorletters = fieldValues['voorletters-tekenbevoegde'];
  const achternaam = fieldValues['achternaam-tekenbevoegde'];
  if (voorletters && achternaam) {
    templateFields.push({ api_id: 'Name_1', value: `${voorletters} ${achternaam}` });
  }
  
  // Email_1 is an autofill field in the template
  // Note: 'email' field doesn't exist in the template, we'll use the signer's email
  
  // Log the mapped fields for debugging
  console.log('Mapped template fields:', JSON.stringify(templateFields, null, 2));
  console.log(`Total fields mapped: ${templateFields.length}`);
  
  return templateFields;
}

/**
 * Maps all recipient tabs to SignWell fields (for non-template documents)
 */
export function mapRecipientTabsToFields(tabs: RecipientTabs, recipientId: string): SignWellField[] {
  const fields: SignWellField[] = [];
  
  // Map text tabs
  if (tabs.textTabs) {
    fields.push(...mapTextTabs(tabs.textTabs, recipientId));
  }
  
  // Convert radio groups to checkboxes
  if (tabs.radioGroupTabs) {
    fields.push(...convertRadioGroupsToCheckboxes(tabs.radioGroupTabs, recipientId));
  }
  
  // Map list tabs
  if (tabs.listTabs) {
    fields.push(...mapListTabs(tabs.listTabs, recipientId));
  }
  
  return fields;
}

/**
 * Formats currency values for display
 */
export function formatCurrency(value: string | number): string {
  const numValue = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]+/g, '')) : value;
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
  }).format(numValue);
}

/**
 * Formats date for Dutch locale
 */
export function formatDate(date: Date = new Date()): string {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear().toString().slice(-2);
  return `${day}-${month}-${year}`;
}