const docusign = require('docusign-esign');
const fs = require('fs').promises;
const path = require('path');

class DocuSignService {
  constructor() {
    this.apiClient = new docusign.ApiClient();
    this.accountId = null;
    this.basePath = null;
  }

  /**
   * Initialize DocuSign with JWT authentication
   */
  async initialize() {
    try {
      // Set the base path (demo or production)
      this.basePath = process.env.DOCUSIGN_BASE_URL || 'https://demo.docusign.net/restapi';
      this.apiClient.setBasePath(this.basePath);

      // Configure JWT auth
      const privateKeyRaw = process.env.DOCUSIGN_RSA_PRIVATE_KEY;
      if (!privateKeyRaw) {
        throw new Error('DOCUSIGN_RSA_PRIVATE_KEY environment variable not set');
      }
      
      let privateKey;
      
      // Check if it's base64 encoded (no BEGIN RSA header)
      if (!privateKeyRaw.includes('BEGIN RSA PRIVATE KEY')) {
        // Decode from base64
        privateKey = Buffer.from(privateKeyRaw, 'base64').toString('utf-8');
      } else if (privateKeyRaw.includes('-----BEGIN') && !privateKeyRaw.includes('\n')) {
        // It's a single line with markers - need to reformat
        const keyContent = privateKeyRaw
          .replace('-----BEGIN RSA PRIVATE KEY-----', '')
          .replace('-----END RSA PRIVATE KEY-----', '')
          .trim();
        
        // Split into 64-character lines
        const formattedKey = keyContent.match(/.{1,64}/g).join('\n');
        privateKey = `-----BEGIN RSA PRIVATE KEY-----\n${formattedKey}\n-----END RSA PRIVATE KEY-----`;
      } else {
        // Already in proper PEM format
        privateKey = privateKeyRaw;
      }

      const jwtLifeSec = 3600; // 1 hour
      const scopes = ['signature', 'impersonation'];

      // Get JWT token
      const results = await this.apiClient.requestJWTUserToken(
        process.env.DOCUSIGN_INTEGRATION_KEY,
        process.env.DOCUSIGN_USER_ID,
        scopes,
        privateKey,
        jwtLifeSec
      );

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
  async createEnvelope(options) {
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

      // Send the envelope
      const results = await envelopesApi.createEnvelope(this.accountId, {
        envelopeDefinition: envelopeDefinition
      });

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
  async getEmbeddedSigningUrl(envelopeId, signerEmail, signerName, clientUserId, returnUrl) {
    try {
      const envelopesApi = new docusign.EnvelopesApi(this.apiClient);

      const viewRequest = new docusign.RecipientViewRequest();
      viewRequest.returnUrl = returnUrl;
      viewRequest.authenticationMethod = 'none';
      viewRequest.email = signerEmail;
      viewRequest.userName = signerName;
      viewRequest.clientUserId = clientUserId;

      const results = await envelopesApi.createRecipientView(
        this.accountId,
        envelopeId,
        { recipientViewRequest: viewRequest }
      );

      return results.url;
    } catch (error) {
      console.error('Error getting embedded signing URL:', error);
      throw error;
    }
  }

  /**
   * Download signed documents from completed envelope
   */
  async downloadSignedDocuments(envelopeId) {
    try {
      const envelopesApi = new docusign.EnvelopesApi(this.apiClient);

      // Get envelope documents
      const documentResults = await envelopesApi.listDocuments(this.accountId, envelopeId);
      const documents = [];

      // Download each document
      for (const doc of documentResults.envelopeDocuments) {
        if (doc.type === 'content') { // Skip certificate and summary docs
          const pdfBytes = await envelopesApi.getDocument(
            this.accountId,
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
  async getEnvelopeStatus(envelopeId) {
    try {
      const envelopesApi = new docusign.EnvelopesApi(this.apiClient);
      const envelope = await envelopesApi.getEnvelope(this.accountId, envelopeId);
      return envelope.status;
    } catch (error) {
      console.error('Error getting envelope status:', error);
      throw error;
    }
  }

  /**
   * Get envelope details including custom fields
   */
  async getEnvelopeDetails(envelopeId) {
    try {
      const envelopesApi = new docusign.EnvelopesApi(this.apiClient);
      
      // Get envelope with custom fields
      const envelope = await envelopesApi.getEnvelope(this.accountId, envelopeId, {
        include: 'custom_fields'
      });
      
      // Get custom fields separately for more detail
      const customFields = await envelopesApi.listCustomFields(this.accountId, envelopeId);
      
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
  static validateWebhookSignature(payload, signature, secret) {
    const crypto = require('crypto');
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    const computedSignature = hmac.digest('base64');
    return computedSignature === signature;
  }
}

module.exports = DocuSignService;