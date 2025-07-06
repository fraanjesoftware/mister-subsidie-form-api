import * as docusign from 'docusign-esign';
import * as crypto from 'crypto';

interface SignatureTab {
  anchorString?: string;
  anchorXOffset?: string;
  anchorYOffset?: string;
  documentId?: string;
  pageNumber?: string;
  xPosition?: string;
  yPosition?: string;
}

interface DateSignedTab {
  anchorString?: string;
  anchorXOffset?: string;
  anchorYOffset?: string;
  documentId?: string;
  pageNumber?: string;
  xPosition?: string;
  yPosition?: string;
}

interface TextTab {
  anchorString?: string;
  anchorXOffset?: string;
  anchorYOffset?: string;
  documentId?: string;
  pageNumber?: string;
  xPosition?: string;
  yPosition?: string;
  value?: string;
  locked?: boolean;
}

interface Signer {
  email: string;
  name: string;
  routingOrder?: number;
  clientUserId?: string;
  signatureTabs?: SignatureTab[];
  dateSignedTabs?: DateSignedTab[];
  textTabs?: TextTab[];
}

interface Document {
  name: string;
  base64: string;
}

interface EnvelopeOptions {
  emailSubject?: string;
  emailMessage?: string;
  documents: Document[];
  signers: Signer[];
  customFields?: any;
  status?: string;
}

interface DownloadedDocument {
  documentId: string;
  name: string;
  pdfBytes: any;
}

interface EnvelopeDetails {
  envelope: any;
  customFields: any;
}

interface DocuSignErrorDetails {
  status?: number;
  statusText?: string;
  message?: string;
  errorCode?: string;
  rawBody?: any;
  headers?: any;
}

class DocuSignError extends Error {
  details?: DocuSignErrorDetails;
  
  constructor(message: string, details?: DocuSignErrorDetails) {
    super(message);
    this.name = 'DocuSignError';
    this.details = details;
  }
}

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
      this.basePath = process.env.DOCUSIGN_BASE_URL || 'https://demo.docusign.net/restapi';
      this.apiClient.setBasePath(this.basePath);

      // Configure JWT auth
      let privateKey = process.env.DOCUSIGN_RSA_PRIVATE_KEY;
      if (!privateKey) {
        throw new Error('DOCUSIGN_RSA_PRIVATE_KEY environment variable not set');
      }
      
      // Handle Azure environment variables where \n is stored as literal string
      if (privateKey.includes('\\n')) {
        // Replace literal \n with actual newlines
        privateKey = privateKey.replace(/\\n/g, '\n');
      }
      
      // If still a single line, format it properly
      if (privateKey.includes('BEGIN') && privateKey.split('\n').length < 3) {
        // Extract the base64 content between the markers
        const match = privateKey.match(/-----BEGIN RSA PRIVATE KEY-----\s*(.+?)\s*-----END RSA PRIVATE KEY-----/);
        if (match && match[1]) {
          const base64Content = match[1].trim();
          // Split into 64-character lines as required by PEM format
          const lines = base64Content.match(/.{1,64}/g) || [];
          privateKey = `-----BEGIN RSA PRIVATE KEY-----\n${lines.join('\n')}\n-----END RSA PRIVATE KEY-----`;
        }
      }

      const jwtLifeSec = 3600; // 1 hour
      const scopes = ['signature', 'impersonation'];

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
   * Create an envelope with documents for signing
   */
  async createEnvelope(options: EnvelopeOptions): Promise<string> {
    const {
      emailSubject,
      emailMessage,
      documents,
      signers,
      customFields,
      status = 'sent'
    } = options;

    try {
      const envelopesApi = new docusign.EnvelopesApi(this.apiClient);

      // Create the envelope definition
      const envelopeDefinition = new docusign.EnvelopeDefinition();
      envelopeDefinition.emailSubject = emailSubject || 'Please sign your subsidy forms';
      envelopeDefinition.emailBlurb = emailMessage || 'Please review and sign the attached documents.';

      // Add documents
      envelopeDefinition.documents = documents.map((doc, index) => {
        console.log(`Document ${index + 1}: name=${doc.name}, base64 exists=${!!doc.base64}, base64 length=${doc.base64?.length || 0}`);
        return {
          documentBase64: doc.base64,
          name: doc.name,
          fileExtension: 'pdf',
          documentId: String(index + 1)
        };
      });

      // Create signers with tabs
      const signersList = signers.map((signer, index) => {
        const docusignSigner = new docusign.Signer();
        docusignSigner.email = signer.email;
        docusignSigner.name = signer.name;
        docusignSigner.recipientId = String(index + 1);
        docusignSigner.routingOrder = String(signer.routingOrder || 1);
        
        // For embedded signing
        if (signer.clientUserId) {
          docusignSigner.clientUserId = signer.clientUserId;
        }

        // Add tabs (signature locations)
        const tabs = new docusign.Tabs();
        
        // Signature tabs
        if (signer.signatureTabs) {
          tabs.signHereTabs = signer.signatureTabs.map(tab => {
            const signHere = new docusign.SignHere();
            
            // Use anchor text if provided
            if (tab.anchorString) {
              signHere.anchorString = tab.anchorString;
              signHere.anchorUnits = 'pixels';
              signHere.anchorXOffset = tab.anchorXOffset || '0';
              signHere.anchorYOffset = tab.anchorYOffset || '0';
            } else {
              // Use absolute positioning
              signHere.documentId = tab.documentId;
              signHere.pageNumber = tab.pageNumber;
              signHere.xPosition = tab.xPosition;
              signHere.yPosition = tab.yPosition;
            }
            
            return signHere;
          });
        }

        // Date signed tabs
        if (signer.dateSignedTabs) {
          tabs.dateSignedTabs = signer.dateSignedTabs.map(tab => {
            const dateSigned = new docusign.DateSigned();
            
            if (tab.anchorString) {
              dateSigned.anchorString = tab.anchorString;
              dateSigned.anchorUnits = 'pixels';
              dateSigned.anchorXOffset = tab.anchorXOffset || '0';
              dateSigned.anchorYOffset = tab.anchorYOffset || '0';
            } else {
              dateSigned.documentId = tab.documentId;
              dateSigned.pageNumber = tab.pageNumber;
              dateSigned.xPosition = tab.xPosition;
              dateSigned.yPosition = tab.yPosition;
            }
            
            return dateSigned;
          });
        }

        // Text tabs for additional fields
        if (signer.textTabs) {
          tabs.textTabs = signer.textTabs.map(tab => {
            const text = new docusign.Text();
            
            if (tab.anchorString) {
              text.anchorString = tab.anchorString;
              text.anchorUnits = 'pixels';
              text.anchorXOffset = tab.anchorXOffset || '0';
              text.anchorYOffset = tab.anchorYOffset || '0';
            } else {
              text.documentId = tab.documentId;
              text.pageNumber = tab.pageNumber;
              text.xPosition = tab.xPosition;
              text.yPosition = tab.yPosition;
            }
            
            text.value = tab.value || '';
            text.locked = tab.locked || false;
            
            return text;
          });
        }

        docusignSigner.tabs = tabs;
        return docusignSigner;
      });

      // Create recipients object
      const recipients = new docusign.Recipients();
      recipients.signers = signersList;

      envelopeDefinition.recipients = recipients;
      envelopeDefinition.status = status;

      // Add custom fields if provided
      if (customFields) {
        envelopeDefinition.customFields = customFields;
      }

      // Log what we're sending
      console.log('=== Sending to DocuSign ===');
      console.log('Account ID:', this.accountId);
      console.log('Email Subject:', envelopeDefinition.emailSubject);
      console.log('Number of Documents:', envelopeDefinition.documents.length);
      console.log('Documents:', envelopeDefinition.documents.map((d: any) => ({
        name: d.name,
        documentId: d.documentId,
        fileExtension: d.fileExtension,
        base64Length: d.documentBase64?.length || 0
      })));
      console.log('Number of Signers:', recipients.signers.length);
      console.log('Signers:', recipients.signers.map((s: any) => ({
        email: s.email,
        name: s.name,
        recipientId: s.recipientId,
        clientUserId: s.clientUserId,
        tabs: {
          signHereTabs: s.tabs?.signHereTabs?.length || 0,
          dateSignedTabs: s.tabs?.dateSignedTabs?.length || 0
        }
      })));
      console.log('==========================');
      
      // Send the envelope
      let results: any;
      try {
        results = await envelopesApi.createEnvelope(this.accountId!, {
          envelopeDefinition: envelopeDefinition
        });
      } catch (apiError: any) {
        // Log the raw error first
        console.error('=== Raw DocuSign Error ===');
        console.error('Error object keys:', Object.keys(apiError));
        console.error('Response exists:', !!apiError.response);
        if (apiError.response) {
          console.error('Response keys:', Object.keys(apiError.response));
          console.error('Response body:', apiError.response.body);
          console.error('Response text:', apiError.response.text);
          console.error('Response data:', apiError.response.data);
        }
        
        // Extract detailed error information
        const errorDetails: DocuSignErrorDetails = {
          status: apiError.response?.status || apiError.status,
          statusText: apiError.response?.statusText,
          message: apiError.response?.body?.message || apiError.response?.text || apiError.message,
          errorCode: apiError.response?.body?.errorCode,
          rawBody: apiError.response?.text || apiError.response?.body,
          headers: apiError.response?.headers
        };
        
        console.error('=== DocuSign API Error ===');
        console.error('Status:', errorDetails.status);
        console.error('Status Text:', errorDetails.statusText);
        console.error('Error Message:', errorDetails.message);
        console.error('Error Code:', errorDetails.errorCode);
        console.error('Raw Body:', errorDetails.rawBody);
        console.error('Response Headers:', JSON.stringify(errorDetails.headers, null, 2));
        
        // Try to parse the error if it's a string
        if (typeof errorDetails.rawBody === 'string') {
          try {
            const parsed = JSON.parse(errorDetails.rawBody);
            console.error('Parsed Error:', JSON.stringify(parsed, null, 2));
          } catch (e) {
            console.error('Could not parse error body as JSON');
          }
        }
        console.error('==========================');
        
        // Include all details in the thrown error
        throw new DocuSignError(errorDetails.message || 'DocuSign API Error', errorDetails);
      }

      console.log(`Envelope created with ID: ${results.envelopeId}`);
      return results.envelopeId;
    } catch (error) {
      console.error('Error creating envelope:', error);
      throw error;
    }
  }

  /**
   * Get embedded signing URL for a recipient
   */
  async getEmbeddedSigningUrl(
    envelopeId: string,
    signerEmail: string,
    signerName: string,
    clientUserId: string,
    returnUrl: string,
    forEmbedding: boolean = false
  ): Promise<string> {
    try {
      const envelopesApi = new docusign.EnvelopesApi(this.apiClient);

      const viewRequest = new docusign.RecipientViewRequest();
      viewRequest.returnUrl = returnUrl;
      viewRequest.authenticationMethod = 'none';
      viewRequest.email = signerEmail;
      viewRequest.userName = signerName;
      viewRequest.clientUserId = clientUserId;
      
      // Add frame ancestors and message origins for iframe embedding
      if (forEmbedding) {
        // Get allowed origins from environment variables
        const allowedOrigins = process.env.DOCUSIGN_ALLOWED_ORIGINS?.split(',').map(origin => origin.trim()) || [
          'http://localhost:5173',
          'https://purple-dune-0613f4303.1.azurestaticapps.net'
        ];
        
        // Determine the primary origin based on environment
        // In production, use the Azure Static Web App URL; in development, use localhost
        const primaryOrigin = process.env.NODE_ENV === 'production' 
          ? 'https://purple-dune-0613f4303.1.azurestaticapps.net'
          : 'http://localhost:5173';
        
        // If a specific primary origin is set in environment variables, use that
        const messageOrigin = process.env.DOCUSIGN_PRIMARY_ORIGIN || primaryOrigin;
        
        console.log('Setting iframe embedding configuration:', {
          frameAncestors: allowedOrigins,
          messageOrigins: [messageOrigin] // Only one origin allowed
        });
        
        viewRequest.frameAncestors = allowedOrigins; // Can have multiple
        viewRequest.messageOrigins = [messageOrigin]; // Only one allowed
      }

      console.log('Creating recipient view with request:', {
        envelopeId,
        accountId: this.accountId,
        email: viewRequest.email,
        userName: viewRequest.userName,
        clientUserId: viewRequest.clientUserId,
        forEmbedding,
        frameAncestors: viewRequest.frameAncestors,
        messageOrigins: viewRequest.messageOrigins
      });

      const results = await envelopesApi.createRecipientView(
        this.accountId!,
        envelopeId,
        { recipientViewRequest: viewRequest }
      );

      console.log('Recipient view created successfully, URL:', results.url);
      return results.url;
    } catch (error: any) {
      console.error('Error getting embedded signing URL:', error);
      
      // Extract detailed error information
      if (error.response) {
        const errorDetails: DocuSignErrorDetails = {
          status: error.response?.status || error.status,
          statusText: error.response?.statusText,
          message: error.response?.body?.message || error.response?.text || error.message,
          errorCode: error.response?.body?.errorCode,
          rawBody: error.response?.text || error.response?.body,
          headers: error.response?.headers
        };
        
        console.error('=== DocuSign API Error (Recipient View) ===');
        console.error('Status:', errorDetails.status);
        console.error('Error Message:', errorDetails.message);
        console.error('Error Code:', errorDetails.errorCode);
        console.error('Raw Body:', errorDetails.rawBody);
        console.error('==========================================');
        
        throw new DocuSignError(errorDetails.message || 'Failed to create recipient view', errorDetails);
      }
      
      throw error;
    }
  }

  /**
   * Create an envelope from a template
   */
  async createEnvelopeFromTemplate(
    templateId: string,
    templateRoles: Array<{
      email: string;
      name: string;
      roleName: string;
      clientUserId?: string;
      tabs?: any;
    }>,
    customFields?: any,
    emailSubject?: string,
    status: string = 'sent'
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

      // Create template roles
      const templateRolesList = templateRoles.map(role => {
        const templateRole = new (docusign as any).TemplateRole();
        templateRole.email = role.email;
        templateRole.name = role.name;
        templateRole.roleName = role.roleName;
        
        // For embedded signing
        if (role.clientUserId) {
          templateRole.clientUserId = role.clientUserId;
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
      
      // Extract detailed error information
      if (error.response) {
        const errorDetails: DocuSignErrorDetails = {
          status: error.response?.status || error.status,
          statusText: error.response?.statusText,
          message: error.response?.body?.message || error.response?.text || error.message,
          errorCode: error.response?.body?.errorCode,
          rawBody: error.response?.text || error.response?.body,
          headers: error.response?.headers
        };
        
        console.error('=== DocuSign API Error (Template) ===');
        console.error('Status:', errorDetails.status);
        console.error('Error Message:', errorDetails.message);
        console.error('Error Code:', errorDetails.errorCode);
        console.error('Raw Body:', errorDetails.rawBody);
        console.error('=====================================');
        
        throw new DocuSignError(errorDetails.message || 'Failed to create envelope from template', errorDetails);
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
      
      // Extract role names from signers
      const roles = recipients.signers?.map((signer: any) => ({
        roleName: signer.roleName,
        recipientId: signer.recipientId,
        routingOrder: signer.routingOrder,
        tabs: signer.tabs
      })) || [];
      
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
        const errorDetails: DocuSignErrorDetails = {
          status: error.response?.status || error.status,
          statusText: error.response?.statusText,
          message: error.response?.body?.message || error.response?.text || error.message,
          errorCode: error.response?.body?.errorCode,
          rawBody: error.response?.text || error.response?.body,
          headers: error.response?.headers
        };
        
        console.error('=== DocuSign API Error (Template Details) ===');
        console.error('Status:', errorDetails.status);
        console.error('Error Message:', errorDetails.message);
        console.error('=====================================');
        
        throw new DocuSignError(errorDetails.message || 'Failed to get template details', errorDetails);
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
   * Validate webhook notification
   */
  static validateWebhookSignature(payload: string, signature: string, secret: string): boolean {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    const computedSignature = hmac.digest('base64');
    return computedSignature === signature;
  }
}

export default DocuSignService;