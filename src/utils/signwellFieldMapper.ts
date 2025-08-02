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
 * Maps all recipient tabs to SignWell template fields
 * Handles duplicate fields (e.g., bedrijfsnaam_2, bedrijfsnaam_3) that represent the same value
 */
export function mapRecipientTabsToTemplateFields(tabs: RecipientTabs): Array<{ api_id: string; value: string | boolean }> {
  const templateFields: Array<{ api_id: string; value: string | boolean }> = [];
  const fieldValues: Record<string, string | boolean> = {};
  
  // Map text tabs
  if (tabs.textTabs) {
    tabs.textTabs.forEach(tab => {
      fieldValues[tab.tabLabel] = tab.value;
      templateFields.push({
        api_id: tab.tabLabel,
        value: tab.value,
      });
    });
  }
  
  // Convert radio groups to checkboxes
  if (tabs.radioGroupTabs) {
    tabs.radioGroupTabs.forEach(group => {
      group.radios.forEach(radio => {
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
      fieldValues[tab.tabLabel] = tab.value;
      templateFields.push({
        api_id: tab.tabLabel,
        value: tab.value,
      });
    });
  }
  
  // Add duplicate fields with _2, _3 suffixes for known duplicates
  const duplicateFieldMap: Record<string, string[]> = {
    'bedrijfsnaam': ['bedrijfsnaam_2', 'bedrijfsnaam_3'],
    'kvk': ['kvk_2'],
    'functie': ['functie_2'],
    'plaats': ['plaats_2'],
    // Add more duplicate mappings as needed
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
  
  // Handle autofill fields that might be in the template
  // Name autofill
  const nameValue = fieldValues['naam'];
  if (nameValue) {
    templateFields.push({ api_id: 'Name_1', value: nameValue as string });
    templateFields.push({ api_id: 'Name_2', value: nameValue as string });
  }
  
  // Email autofill
  const emailValue = fieldValues['email'];
  if (emailValue) {
    templateFields.push({ api_id: 'Email_1', value: emailValue as string });
    templateFields.push({ api_id: 'Email_2', value: emailValue as string });
  }
  
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