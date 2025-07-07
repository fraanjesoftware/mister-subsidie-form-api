import * as docusign from 'docusign-esign';
import { DOCUSIGN_CONSTANTS } from '../constants/docusign';
import { 
  BaseTab, 
  SignatureTab, 
  DateSignedTab, 
  TextTab,
  TabAnchorConfig,
  TabPositionConfig 
} from '../types/docusign';

/**
 * Create a tab with anchor positioning (DRY principle)
 */
export function createTabWithAnchor(config: TabAnchorConfig): Partial<BaseTab> {
  return {
    anchorString: config.anchorString,
    anchorXOffset: config.anchorXOffset || DOCUSIGN_CONSTANTS.DEFAULT_ANCHOR_X_OFFSET,
    anchorYOffset: config.anchorYOffset || DOCUSIGN_CONSTANTS.DEFAULT_ANCHOR_Y_OFFSET
  };
}

/**
 * Create a tab with absolute positioning (DRY principle)
 */
export function createTabWithPosition(config: TabPositionConfig): Partial<BaseTab> {
  return {
    documentId: config.documentId,
    pageNumber: config.pageNumber,
    xPosition: config.xPosition,
    yPosition: config.yPosition
  };
}

/**
 * Apply positioning to a DocuSign tab object
 */
export function applyTabPositioning(tab: any, tabConfig: BaseTab): void {
  if (tabConfig.anchorString) {
    const anchorProps = createTabWithAnchor({
      anchorString: tabConfig.anchorString,
      anchorXOffset: tabConfig.anchorXOffset,
      anchorYOffset: tabConfig.anchorYOffset
    });
    Object.assign(tab, anchorProps);
    tab.anchorUnits = DOCUSIGN_CONSTANTS.ANCHOR_UNITS;
  } else if (tabConfig.documentId && tabConfig.pageNumber && tabConfig.xPosition && tabConfig.yPosition) {
    const positionProps = createTabWithPosition({
      documentId: tabConfig.documentId,
      pageNumber: tabConfig.pageNumber,
      xPosition: tabConfig.xPosition,
      yPosition: tabConfig.yPosition
    });
    Object.assign(tab, positionProps);
  }
}

/**
 * Create signature tabs from configuration
 */
export function createSignatureTabs(tabs: SignatureTab[]): any[] {
  return tabs.map(tab => {
    const signHere = new docusign.SignHere();
    applyTabPositioning(signHere, tab);
    return signHere;
  });
}

/**
 * Create date signed tabs from configuration
 */
export function createDateSignedTabs(tabs: DateSignedTab[]): any[] {
  return tabs.map(tab => {
    const dateSigned = new docusign.DateSigned();
    applyTabPositioning(dateSigned, tab);
    return dateSigned;
  });
}

/**
 * Create text tabs from configuration
 */
export function createTextTabs(tabs: TextTab[]): any[] {
  return tabs.map(tab => {
    const text = new docusign.Text();
    applyTabPositioning(text, tab);
    text.value = tab.value || '';
    text.locked = tab.locked || false;
    return text;
  });
}