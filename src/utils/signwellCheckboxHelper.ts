/**
 * Helper to convert checkbox values to visual text representations
 * Since SignWell checkboxes remain editable even when pre-filled,
 * we can use text fields with checkbox symbols instead
 */

export interface CheckboxMapping {
  fieldId: string;
  checked: boolean;
}

/**
 * Converts boolean checkbox values to visual checkbox characters
 * @param checked - Whether the checkbox should appear checked
 * @returns Unicode checkbox character
 */
export function getCheckboxCharacter(checked: boolean): string {
  return checked ? '☑' : '☐';
}

/**
 * Converts radio group selections to text field representations
 * This ensures the values are read-only in the signed document
 */
export function convertRadioGroupsToTextFields(
  radioGroupTabs: any[],
  textTabs: any[]
): any[] {
  const updatedTextTabs = [...textTabs];
  
  // Map of checkbox fields and their display labels
  const checkboxLabelMap: Record<string, string> = {
    'geen': 'Geen de-minimis steun ontvangen',
    'wel': 'Wel de-minimis steun ontvangen',
    'andere': 'Andere staatssteun ontvangen',
    'kleine': 'Kleine onderneming',
    'middel': 'Middelgrote onderneming',
    'grote': 'Grote onderneming'
  };
  
  radioGroupTabs.forEach(group => {
    group.radios.forEach((radio: any) => {
      // Add a text field with checkbox character instead of actual checkbox
      updatedTextTabs.push({
        tabLabel: `${radio.value}_display`,
        value: `${getCheckboxCharacter(radio.selected)} ${checkboxLabelMap[radio.value] || radio.value}`
      });
    });
  });
  
  return updatedTextTabs;
}

/**
 * Alternative: Create hidden text fields with Yes/No values
 * and use the checkbox fields just for visual display
 */
export function createHiddenTextValues(
  radioGroupTabs: any[]
): any[] {
  const hiddenFields: any[] = [];
  
  radioGroupTabs.forEach(group => {
    group.radios.forEach((radio: any) => {
      if (radio.selected) {
        hiddenFields.push({
          tabLabel: `${group.groupName}_selected`,
          value: radio.value
        });
      }
    });
  });
  
  return hiddenFields;
}