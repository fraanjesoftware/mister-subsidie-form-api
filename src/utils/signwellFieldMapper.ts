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
 * Maps all recipient tabs to SignWell fields
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