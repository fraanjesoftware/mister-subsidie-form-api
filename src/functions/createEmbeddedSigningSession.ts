import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import DocuSignService from '../services/docusignService';
import { fillDeMinimisForm } from '../services/fillDeMinimis';
import { fillMKBVerklaring } from '../services/fillMKB';
import { fillMachtigingsformulier } from '../services/fillMachtiging';
import { 
    validateDeMinimisData, 
    validateMKBData,
    DeMinimisFormData,
    MKBFormData
} from '../models/formModels';

interface Signer {
  email: string;
  name: string;
}

interface Form {
  formType: 'deMinimis' | 'machtiging' | 'mkb';
  formData: any;
}

interface EmbeddedSigningRequest {
  signer: Signer;
  formType?: 'deMinimis' | 'machtiging' | 'mkb';
  formData?: any;
  forms?: Form[];
  returnUrl: string;
  frameAncestors?: string[]; // Array of allowed origins for iframe embedding (optional)
  messageOrigins?: string[]; // Array of allowed origins for postMessage communication (optional)
}

interface ProcessingResult {
  formType: string;
  filename: string;
  companySize?: any;
}

app.http('createEmbeddedSigningSession', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    context.log('createEmbeddedSigningSession function processing request');
    
    try {
      // Parse request body
      const requestBody = await request.json() as EmbeddedSigningRequest;
      
      // Basic validation
      if (!requestBody.signer || !requestBody.signer.email || !requestBody.signer.name) {
        return {
          status: 400,
          body: JSON.stringify({
            error: 'Missing signer information',
            message: 'Please provide signer email and name'
          }),
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        };
      }
      
      if (!requestBody.returnUrl) {
        return {
          status: 400,
          body: JSON.stringify({
            error: 'Missing returnUrl',
            message: 'Please provide a returnUrl for when signing is complete'
          }),
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        };
      }
      
      // frameAncestors is optional for now - DocuSign may not support it in all environments
      if (requestBody.frameAncestors && requestBody.frameAncestors.length > 0) {
        context.log('Frame ancestors provided:', requestBody.frameAncestors);
      }
      
      // Check if we're processing multiple forms or a single form
      const isMultipleForms = 'forms' in requestBody && Array.isArray(requestBody.forms);
      const isSingleForm = 'formType' in requestBody && 'formData' in requestBody;
      
      if (!isMultipleForms && !isSingleForm) {
        return {
          status: 400,
          body: JSON.stringify({
            error: 'Invalid request',
            message: 'Please provide either "forms" array for multiple forms or "formType" and "formData" for a single form'
          }),
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        };
      }
      
      // Prepare forms array - either from multiple forms or single form
      let formsToProcess: Form[] = [];
      if (isMultipleForms) {
        // Validate each form in the array
        const validFormTypes = ['deMinimis', 'machtiging', 'mkb'];
        for (const [index, form] of requestBody.forms!.entries()) {
          if (!form.formType || !validFormTypes.includes(form.formType)) {
            return {
              status: 400,
              body: JSON.stringify({
                error: 'Invalid form type',
                message: `Form at index ${index}: Please provide a valid formType: ${validFormTypes.join(', ')}`
              }),
              headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
              }
            };
          }
          
          // Validate form data
          let validationErrors: string[] = [];
          if (form.formType === 'deMinimis') {
            validationErrors = validateDeMinimisData(form.formData || {} as DeMinimisFormData);
          } else if (form.formType === 'machtiging') {
            // validationErrors = validateMachtigingData(form.formData || {});
          } else if (form.formType === 'mkb') {
            validationErrors = validateMKBData(form.formData || {} as MKBFormData);
          }
          
          if (validationErrors.length > 0) {
            return {
              status: 400,
              body: JSON.stringify({
                error: 'Invalid form data',
                message: `Form at index ${index} (${form.formType}): validation failed`,
                validationErrors: validationErrors
              }),
              headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
              }
            };
          }
          
          formsToProcess.push(form);
        }
      } else {
        // Single form - validate as before
        const validFormTypes = ['deMinimis', 'machtiging', 'mkb'];
        if (!requestBody.formType || !validFormTypes.includes(requestBody.formType)) {
          return {
            status: 400,
            body: JSON.stringify({
              error: 'Invalid form type',
              message: `Please provide a valid formType: ${validFormTypes.join(', ')}`
            }),
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          };
        }
        
        let validationErrors: string[] = [];
        if (requestBody.formType === 'deMinimis') {
          validationErrors = validateDeMinimisData(requestBody.formData || {} as DeMinimisFormData);
        } else if (requestBody.formType === 'machtiging') {
          // validationErrors = validateMachtigingData(requestBody.formData || {});
        } else if (requestBody.formType === 'mkb') {
          validationErrors = validateMKBData(requestBody.formData || {} as MKBFormData);
        }
        
        if (validationErrors.length > 0) {
          return {
            status: 400,
            body: JSON.stringify({
              error: 'Invalid form data',
              message: 'Form data validation failed',
              validationErrors: validationErrors
            }),
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          };
        }
        
        formsToProcess.push({
          formType: requestBody.formType,
          formData: requestBody.formData
        });
      }
      
      // Initialize DocuSign
      const docusign = new DocuSignService();
      await docusign.initialize();
      
      // Process all forms and create documents array
      const documents: any[] = [];
      const processingResults: ProcessingResult[] = [];
      
      for (const [index, form] of formsToProcess.entries()) {
        try {
          context.log(`Processing ${form.formType} form (${index + 1}/${formsToProcess.length})`);
          
          let pdfResult: any;
          switch (form.formType) {
            case 'deMinimis':
              pdfResult = await fillDeMinimisForm(form.formData);
              break;
            case 'machtiging':
              pdfResult = await fillMachtigingsformulier(form.formData);
              break;
            case 'mkb':
              pdfResult = await fillMKBVerklaring(form.formData);
              break;
          }
          
          // Skip if result is a string (backward compatibility)
          if (typeof pdfResult === 'string') {
            throw new Error('Unexpected string result from form filling function');
          }
          
          // Convert Uint8Array to Buffer if needed
          const pdfBuffer = Buffer.isBuffer(pdfResult.pdfBytes) 
            ? pdfResult.pdfBytes 
            : Buffer.from(pdfResult.pdfBytes);
          
          const pdfBase64 = pdfBuffer.toString('base64');
          context.log(`Successfully filled ${form.formType} PDF, size:`, pdfBuffer.length);
          
          // Add to documents array with documentId
          documents.push({
            documentId: String(index + 1),
            name: pdfResult.filename,
            base64: pdfBase64
          });
          
          processingResults.push({
            formType: form.formType,
            filename: pdfResult.filename,
            companySize: pdfResult.companySize // For MKB forms
          });
          
        } catch (error: any) {
          context.log(`Failed to fill ${form.formType} PDF:`, error.message);
          return {
            status: 500,
            body: JSON.stringify({
              error: 'Failed to generate PDF',
              message: error.message,
              formType: form.formType,
              formIndex: index
            }),
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          };
        }
      }
      
      // Generate unique client user ID for embedded signing
      const clientUserId = uuidv4();
      
      // Create signers array with tabs for each document
      const signatureTabs: any[] = [];
      const dateSignedTabs: any[] = [];
      
      // Check if we should use signature anchors
      const useAnchors = formsToProcess.some(form => form.formData.addSignatureAnchors);
      
      if (!useAnchors) {
        // Add signature and date tabs for each document
        documents.forEach((doc) => {
          signatureTabs.push({
            documentId: doc.documentId,
            pageNumber: '1',
            xPosition: '200',
            yPosition: '100'
          });
          dateSignedTabs.push({
            documentId: doc.documentId,
            pageNumber: '1',
            xPosition: '350',
            yPosition: '100'
          });
        });
      }
      // If using anchors, leave tabs arrays empty - DocuSign will use anchor tags
      
      const signers = [{
        email: requestBody.signer.email,
        name: requestBody.signer.name,
        clientUserId: clientUserId, // Required for embedded signing
        signatureTabs: signatureTabs,
        dateSignedTabs: dateSignedTabs
      }];
      
      // Create envelope
      const envelopeId = await docusign.createEnvelope({
        emailSubject: 'Please sign your subsidy forms',
        emailMessage: 'Please review and sign the attached subsidy forms.',
        documents: documents,
        signers: signers,
        status: 'sent'
      });
      
      context.log('Envelope created:', envelopeId);
      // Get embedded signing URL
      const signingUrl = await docusign.getEmbeddedSigningUrl(
        envelopeId,
        requestBody.signer.email,
        requestBody.signer.name,
        clientUserId,
        requestBody.returnUrl
      );
      
      context.log('Embedded signing URL generated with iframe configuration');
      
      // Return success response with CORS headers
      return {
        status: 200,
        body: JSON.stringify({
          success: true,
          envelopeId: envelopeId,
          signingUrl: signingUrl,
          expiresIn: 300, // 5 minutes
          message: isMultipleForms 
            ? `Embedded signing session created successfully for ${formsToProcess.length} forms`
            : `Embedded signing session created successfully for ${formsToProcess[0].formType} form`,
          forms: processingResults,
          clientUserId: clientUserId // Useful for tracking
        }),
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*', // Configure this based on your needs
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      };
      
    } catch (error: any) {
      context.log('ERROR:', error);
      return {
        status: 500,
        body: JSON.stringify({
          error: 'Failed to create embedded signing session',
          message: error.message,
          details: error.details || {}
        }),
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      };
    }
  }
});