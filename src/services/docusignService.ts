import * as docusign from 'docusign-esign';
import { DOCUSIGN_CONSTANTS } from '../constants/docusign';
import { 
  EnvelopeOptions, 
  Document, 
  Signer, 
  DownloadedDocument, 
  EnvelopeDetails,
  TemplateRole,
  NotificationConfig
} from '../types/docusign';
import { handleDocuSignError } from '../errors/DocuSignError';
import { 
  formatRSAPrivateKey, 
  validateWebhookSignature, 
  logEnvelopeDetails
} from '../utils/docusignHelpers';
import {
  createSignatureTabs,
  createDateSignedTabs,
  createTextTabs
} from '../utils/docusignTabFactory';

class DocuSignService {
  private apiClient: docusign.ApiClient;
  private accountId: string | null;
  private basePath: string | null;

  constructor() {
    this.apiClient = new docusign.ApiClient();
    this.accountId = null;
    this.basePath = null;
  }

  /**
   * Initialize DocuSign with JWT authentication
   */
  async initialize(): Promise<boolean> {
    try {
      // Set the base path (demo or production)
      this.basePath = process.env.DOCUSIGN_BASE_URL || DOCUSIGN_CONSTANTS.DEFAULT_BASE_URL;
      this.apiClient.setBasePath(this.basePath);

      // Configure JWT auth
      const privateKeyRaw = process.env.DOCUSIGN_RSA_PRIVATE_KEY;
      if (!privateKeyRaw) {
        throw new Error(DOCUSIGN_CONSTANTS.ERRORS.MISSING_PRIVATE_KEY);
      }
      
      // Use the utility method to format the private key
      const privateKey = formatRSAPrivateKey(privateKeyRaw);

      const jwtLifeSec = DOCUSIGN_CONSTANTS.JWT_LIFETIME;
      const scopes = DOCUSIGN_CONSTANTS.SCOPES;

      // Get JWT token
      let results: any;
      try {
        results = await this.apiClient.requestJWTUserToken(
          process.env.DOCUSIGN_INTEGRATION_KEY!,
          process.env.DOCUSIGN_USER_ID!,
          scopes,
          privateKey,
          jwtLifeSec
        );
      } catch (jwtError: any) {
        // Log more details about the error
        console.error('JWT Token Error:', jwtError.message);
        console.error('Integration Key exists:', !!process.env.DOCUSIGN_INTEGRATION_KEY);
        console.error('User ID exists:', !!process.env.DOCUSIGN_USER_ID);
        console.error('Private key length:', privateKey.length);
        console.error('Private key has proper markers:', privateKey.includes('BEGIN') && privateKey.includes('END'));
        throw jwtError;
      }

      const accessToken = results.body.access_token;

      // Get user info
      const userInfoResponse = await this.apiClient.getUserInfo(accessToken);
      
      // Get the first account
      const userInfo = userInfoResponse.accounts[0];
      this.accountId = userInfo.accountId;
      const baseUri = userInfo.baseUri + '/restapi';
      
      // Set the base path and auth
      this.apiClient.setBasePath(baseUri);
      this.apiClient.addDefaultHeader('Authorization', 'Bearer ' + accessToken);

      console.log('DocuSign initialized successfully');
      return true;
    } catch (error) {
      console.error('Error initializing DocuSign:', error);
      throw error;
    }
  }

  /**
   * Prepare documents for envelope (extracted for testability)
   */
  private prepareDocuments(documents: Document[]): any[] {
    return documents.map((doc, index) => {
      console.log(`Document ${index + 1}: name=${doc.name}, base64 exists=${!!doc.base64}, base64 length=${doc.base64?.length || 0}`);
      return {
        documentBase64: doc.base64,
        name: doc.name,
        fileExtension: DOCUSIGN_CONSTANTS.DEFAULT_FILE_EXTENSION,
        documentId: String(index + 1)
      };
    });
  }

  /**
   * Prepare signers for envelope (extracted for testability)
   */
  private prepareSigners(signers: Signer[]): any[] {
    return signers.map((signer, index) => {
      const docusignSigner = new docusign.Signer();
      docusignSigner.email = signer.email;
      docusignSigner.name = signer.name;
      docusignSigner.recipientId = String(index + 1);
      docusignSigner.routingOrder = String(signer.routingOrder || DOCUSIGN_CONSTANTS.DEFAULT_ROUTING_ORDER);
      
      // For embedded signing
      if (signer.clientUserId) {
        docusignSigner.clientUserId = signer.clientUserId;
      }

      // Add tabs (signature locations)
      const tabs = new docusign.Tabs();
      
      // Use the tab factory methods
      if (signer.signatureTabs) {
        tabs.signHereTabs = createSignatureTabs(signer.signatureTabs);
      }

      if (signer.dateSignedTabs) {
        tabs.dateSignedTabs = createDateSignedTabs(signer.dateSignedTabs);
      }

      if (signer.textTabs) {
        tabs.textTabs = createTextTabs(signer.textTabs);
      }

      docusignSigner.tabs = tabs;
      return docusignSigner;
    });
  }

  /**
   * Create envelope definition (extracted for testability)
   */
  private createEnvelopeDefinition(
    emailSubject: string | undefined,
    emailMessage: string | undefined,
    documents: any[],
    signers: any[],
    customFields: any,
    status: string
  ): any {
    const envelopeDefinition = new docusign.EnvelopeDefinition();
    envelopeDefinition.emailSubject = emailSubject || DOCUSIGN_CONSTANTS.DEFAULT_EMAIL_SUBJECT;
    envelopeDefinition.emailBlurb = emailMessage || DOCUSIGN_CONSTANTS.DEFAULT_EMAIL_MESSAGE;
    envelopeDefinition.documents = documents;
    
    // Create recipients object
    const recipients = new docusign.Recipients();
    recipients.signers = signers;
    envelopeDefinition.recipients = recipients;
    
    envelopeDefinition.status = status;
    
    // Add custom fields if provided
    if (customFields) {
      envelopeDefinition.customFields = customFields;
    }
    
    return envelopeDefinition;
  }

  /**
   * Create an envelope with documents for signing
   */
  async createEnvelope(options: EnvelopeOptions): Promise<string> {
    const {
      emailSubject,
      emailMessage,
      documents,
      signers,
      customFields,
      status = DOCUSIGN_CONSTANTS.DEFAULT_ENVELOPE_STATUS
    } = options;

    try {
      const envelopesApi = new docusign.EnvelopesApi(this.apiClient);

      // Use extracted methods for better testability and maintainability
      const preparedDocuments = this.prepareDocuments(documents);
      const preparedSigners = this.prepareSigners(signers);
      const envelopeDefinition = this.createEnvelopeDefinition(
        emailSubject,
        emailMessage,
        preparedDocuments,
        preparedSigners,
        customFields,
        status
      );

      // Log what we're sending
      logEnvelopeDetails(
        this.accountId,
        envelopeDefinition.emailSubject,
        preparedDocuments,
        preparedSigners
      );
      
      // Send the envelope
      let results: any;
      try {
        results = await envelopesApi.createEnvelope(this.accountId!, {
          envelopeDefinition: envelopeDefinition
        });
      } catch (apiError: any) {
        // Log the raw error first for debugging
        console.error('=== Raw DocuSign Error ===');
        console.error('Error object keys:', Object.keys(apiError));
        console.error('Response exists:', !!apiError.response);
        if (apiError.response) {
          console.error('Response keys:', Object.keys(apiError.response));
          console.error('Response body:', apiError.response.body);
          console.error('Response text:', apiError.response.text);
          console.error('Response data:', apiError.response.data);
        }
        
        // Use the utility method for consistent error handling
        throw handleDocuSignError(apiError, 'Create Envelope');
      }

      console.log(`Envelope created with ID: ${results.envelopeId}`);
      return results.envelopeId;
    } catch (error) {
      console.error('Error creating envelope:', error);
      throw error;
    }
  }

  /**
   * Get signing URL for a recipient (redirect flow)
   * Note: This method supports both embedded and redirect flows
   * For redirect flow, DocuSign will redirect back to returnUrl with event parameters
   */
  async getSigningUrl(
    envelopeId: string,
    signerEmail: string,
    signerName: string,
    clientUserId: string,
    returnUrl: string
  ): Promise<string> {
    try {
      const envelopesApi = new docusign.EnvelopesApi(this.apiClient);

      const viewRequest = new docusign.RecipientViewRequest();
      viewRequest.returnUrl = returnUrl;
      viewRequest.authenticationMethod = DOCUSIGN_CONSTANTS.DEFAULT_AUTH_METHOD;
      viewRequest.email = signerEmail;
      viewRequest.userName = signerName;
      viewRequest.clientUserId = clientUserId;
      
      // Note: frameAncestors and messageOrigins are not set for redirect flow
      // This avoids CSP issues and simplifies the implementation

      console.log('Creating recipient view with request:', {
        envelopeId,
        accountId: this.accountId,
        email: viewRequest.email,
        userName: viewRequest.userName,
        clientUserId: viewRequest.clientUserId,
        returnUrl: viewRequest.returnUrl
      });

      const results = await envelopesApi.createRecipientView(
        this.accountId!,
        envelopeId,
        { recipientViewRequest: viewRequest }
      );

      console.log('Recipient view created successfully, URL:', results.url);
      return results.url;
    } catch (error: any) {
      console.error('Error getting signing URL:', error);
      
      // Use the utility method for consistent error handling
      if (error.response) {
        throw handleDocuSignError(error, 'Recipient View');
      }
      
      throw error;
    }
  }

  /**
   * @deprecated Use getSigningUrl instead
   * Get embedded signing URL for a recipient
   */
  async getEmbeddedSigningUrl(
    envelopeId: string,
    signerEmail: string,
    signerName: string,
    clientUserId: string,
    returnUrl: string,
    _forEmbedding?: boolean // Made optional and unused (prefix with _ to indicate intentionally unused)
  ): Promise<string> {
    // For backward compatibility, just call the new method
    // The forEmbedding parameter is ignored as we now use redirect flow
    return this.getSigningUrl(envelopeId, signerEmail, signerName, clientUserId, returnUrl);
  }

  /**
   * Create an envelope from a template
   */
  async createEnvelopeFromTemplate(
    templateId: string,
    templateRoles: TemplateRole[],
    customFields?: any,
    emailSubject?: string,
    status: string = 'sent',
    notification?: NotificationConfig
  ): Promise<string> {
    try {
      const envelopesApi = new docusign.EnvelopesApi(this.apiClient);

      // Create the envelope definition from template
      const envelopeDefinition = new docusign.EnvelopeDefinition();
      (envelopeDefinition as any).templateId = templateId;
      envelopeDefinition.status = status;
      
      if (emailSubject) {
        envelopeDefinition.emailSubject = emailSubject;
      }
      
      // Configure email settings for completion notifications
      const emailSettings = new (docusign as any).EmailSettings();
      emailSettings.replyEmailAddressOverride = process.env.DOCUSIGN_REPLY_EMAIL || '';
      emailSettings.replyEmailNameOverride = process.env.DOCUSIGN_REPLY_NAME || '';
      emailSettings.bccEmailAddresses = [];
      (envelopeDefinition as any).emailSettings = emailSettings;

      // Create template roles
      const templateRolesList = templateRoles.map(role => {
        const templateRole = new (docusign as any).TemplateRole();
        templateRole.email = role.email;
        templateRole.name = role.name;
        templateRole.roleName = role.roleName;
        
        // For embedded signing
        if (role.clientUserId) {
          templateRole.clientUserId = role.clientUserId;
          
          // Enable email notifications for embedded signers if requested
          if (role.embeddedRecipientStartURL === 'SIGN_AT_DOCUSIGN') {
            templateRole.embeddedRecipientStartURL = 'SIGN_AT_DOCUSIGN';
          }
        }
        
        // Add tabs if provided (to override template defaults)
        if (role.tabs) {
          templateRole.tabs = role.tabs;
        }
        
        return templateRole;
      });

      (envelopeDefinition as any).templateRoles = templateRolesList;

      // Add custom fields if provided
      if (customFields) {
        envelopeDefinition.customFields = customFields;
      }
      
      // Add notification settings if provided
      if (notification) {
        (envelopeDefinition as any).notification = notification;
      }

      console.log('=== Creating Envelope from Template ===');
      console.log('Template ID:', templateId);
      console.log('Template Roles:', templateRolesList.map(r => ({
        email: r.email,
        name: r.name,
        roleName: r.roleName,
        clientUserId: r.clientUserId
      })));
      console.log('Status:', status);
      console.log('=====================================');

      // Create the envelope
      const results = await envelopesApi.createEnvelope(this.accountId!, {
        envelopeDefinition: envelopeDefinition
      });

      console.log(`Envelope created from template with ID: ${results.envelopeId}`);
      return results.envelopeId;
    } catch (error: any) {
      console.error('Error creating envelope from template:', error);
      
      // Use the utility method for consistent error handling
      if (error.response) {
        throw handleDocuSignError(error, 'Template Envelope');
      }
      
      throw error;
    }
  }

  /**
   * Get template details including custom fields and roles
   */
  async getTemplateDetails(templateId: string): Promise<any> {
    try {
      const templatesApi = new (docusign as any).TemplatesApi(this.apiClient);
      
      // Get template information
      const template = await templatesApi.get(this.accountId!, templateId);
      
      // Get template custom fields
      let customFields;
      try {
        customFields = await templatesApi.listCustomFields(this.accountId!, templateId);
      } catch (error) {
        console.log('No custom fields found for template');
        customFields = { textCustomFields: [], listCustomFields: [] };
      }
      
      // Get template recipients (roles)
      let recipients;
      try {
        recipients = await templatesApi.listRecipients(this.accountId!, templateId);
      } catch (error) {
        console.log('No recipients found for template');
        recipients = { signers: [], carbonCopies: [], certifiedDeliveries: [] };
      }
      
      // Get template documents
      let documents;
      try {
        documents = await templatesApi.listDocuments(this.accountId!, templateId);
      } catch (error) {
        console.log('No documents found for template');
        documents = { templateDocuments: [] };
      }
      
      // Extract role names and tabs from signers
      const roles = recipients.signers?.map((signer: any) => {
        // Extract all tab types
        const tabs = signer.tabs || {};
        const allTabs: any[] = [];
        
        // Text tabs
        if (tabs.textTabs) {
          tabs.textTabs.forEach((tab: any) => {
            allTabs.push({
              type: 'text',
              tabLabel: tab.tabLabel,
              tabId: tab.tabId,
              required: tab.required,
              value: tab.value,
              locked: tab.locked,
              width: tab.width,
              height: tab.height
            });
          });
        }
        
        // Checkbox tabs
        if (tabs.checkboxTabs) {
          tabs.checkboxTabs.forEach((tab: any) => {
            allTabs.push({
              type: 'checkbox',
              tabLabel: tab.tabLabel,
              tabId: tab.tabId,
              required: tab.required,
              selected: tab.selected,
              locked: tab.locked
            });
          });
        }
        
        // Radio group tabs
        if (tabs.radioGroupTabs) {
          tabs.radioGroupTabs.forEach((tab: any) => {
            allTabs.push({
              type: 'radioGroup',
              groupName: tab.groupName,
              radios: tab.radios?.map((radio: any) => ({
                value: radio.value,
                selected: radio.selected,
                required: radio.required
              }))
            });
          });
        }
        
        // List tabs (dropdowns)
        if (tabs.listTabs) {
          tabs.listTabs.forEach((tab: any) => {
            allTabs.push({
              type: 'list',
              tabLabel: tab.tabLabel,
              tabId: tab.tabId,
              required: tab.required,
              value: tab.value,
              listItems: tab.listItems
            });
          });
        }
        
        // Date signed tabs
        if (tabs.dateSignedTabs) {
          tabs.dateSignedTabs.forEach((tab: any) => {
            allTabs.push({
              type: 'dateSigned',
              tabLabel: tab.tabLabel,
              tabId: tab.tabId
            });
          });
        }
        
        // Sign here tabs
        if (tabs.signHereTabs) {
          tabs.signHereTabs.forEach((tab: any) => {
            allTabs.push({
              type: 'signHere',
              tabLabel: tab.tabLabel,
              tabId: tab.tabId,
              optional: tab.optional
            });
          });
        }
        
        return {
          roleName: signer.roleName,
          recipientId: signer.recipientId,
          routingOrder: signer.routingOrder,
          tabs: allTabs
        };
      }) || [];
      
      const result = {
        templateId: template.templateId,
        name: template.name,
        description: template.description,
        emailSubject: template.emailSubject,
        emailBlurb: template.emailBlurb,
        roles: roles,
        customFields: {
          textCustomFields: customFields.textCustomFields?.map((field: any) => ({
            fieldId: field.fieldId,
            name: field.name,
            required: field.required,
            show: field.show,
            value: field.value
          })) || [],
          listCustomFields: customFields.listCustomFields?.map((field: any) => ({
            fieldId: field.fieldId,
            name: field.name,
            required: field.required,
            listItems: field.listItems,
            value: field.value
          })) || []
        },
        documents: documents.templateDocuments?.map((doc: any) => ({
          documentId: doc.documentId,
          name: doc.name,
          fileExtension: doc.fileExtension,
          order: doc.order
        })) || [],
        created: template.created,
        lastModified: template.lastModified,
        shared: template.shared,
        folderId: template.folderId,
        folderName: template.folderName
      };
      
      console.log('Template details retrieved:', {
        templateId: result.templateId,
        name: result.name,
        rolesCount: result.roles.length,
        customFieldsCount: result.customFields.textCustomFields.length + result.customFields.listCustomFields.length,
        documentsCount: result.documents.length
      });
      
      return result;
    } catch (error: any) {
      console.error('Error getting template details:', error);
      
      if (error.response) {
        throw handleDocuSignError(error, 'Template Details');
      }
      
      throw error;
    }
  }

  /**
   * Download signed documents from completed envelope
   */
  async downloadSignedDocuments(envelopeId: string): Promise<DownloadedDocument[]> {
    try {
      const envelopesApi = new docusign.EnvelopesApi(this.apiClient);

      // Get envelope documents
      const documentResults = await envelopesApi.listDocuments(this.accountId!, envelopeId);
      const documents: DownloadedDocument[] = [];

      // Download each document
      for (const doc of documentResults.envelopeDocuments) {
        if (doc.type === 'content') { // Skip certificate and summary docs
          const pdfBytes = await envelopesApi.getDocument(
            this.accountId!,
            envelopeId,
            doc.documentId
          );

          documents.push({
            documentId: doc.documentId,
            name: doc.name,
            pdfBytes: pdfBytes
          });
        }
      }

      return documents;
    } catch (error) {
      console.error('Error downloading signed documents:', error);
      throw error;
    }
  }

  /**
   * Get envelope status
   */
  async getEnvelopeStatus(envelopeId: string): Promise<string> {
    try {
      const envelopesApi = new docusign.EnvelopesApi(this.apiClient);
      const envelope = await envelopesApi.getEnvelope(this.accountId!, envelopeId);
      return envelope.status;
    } catch (error) {
      console.error('Error getting envelope status:', error);
      throw error;
    }
  }

  /**
   * Get envelope details including custom fields
   */
  async getEnvelopeDetails(envelopeId: string): Promise<EnvelopeDetails> {
    try {
      const envelopesApi = new docusign.EnvelopesApi(this.apiClient);
      
      // Get envelope with custom fields
      const envelope = await envelopesApi.getEnvelope(this.accountId!, envelopeId, {
        include: 'custom_fields'
      });
      
      // Get custom fields separately for more detail
      const customFields = await envelopesApi.listCustomFields(this.accountId!, envelopeId);
      
      return {
        envelope: envelope,
        customFields: customFields
      };
    } catch (error) {
      console.error('Error getting envelope details:', error);
      throw error;
    }
  }

  /**
   * Validate webhook notification - static method
   */
  static validateWebhookSignature(payload: string, signature: string, secret: string): boolean {
    return validateWebhookSignature(payload, signature, secret);
  }

  /**
   * Static helper methods for backward compatibility
   */
  static handleDocuSignError = handleDocuSignError;
  static createTabWithAnchor = (config: any) => {
    // Import from tab factory for backward compatibility
    const { createTabWithAnchor } = require('../utils/docusignTabFactory');
    return createTabWithAnchor(config);
  };
  static createTabWithPosition = (config: any) => {
    // Import from tab factory for backward compatibility
    const { createTabWithPosition } = require('../utils/docusignTabFactory');
    return createTabWithPosition(config);
  };
  static formatRSAPrivateKey = formatRSAPrivateKey;
}

export default DocuSignService;

// Re-export types for backward compatibility
export type {
  BaseTab,
  SignatureTab,
  DateSignedTab,
  TextTab,
  Signer,
  Document,
  EnvelopeOptions,
  DownloadedDocument,
  EnvelopeDetails,
  DocuSignErrorDetails,
  TemplateRole,
  NotificationConfig
} from '../types/docusign';

export { DocuSignError } from '../errors/DocuSignError';