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
  clientUserId?: string;
}

interface Form {
  formType: 'deMinimis' | 'machtiging' | 'mkb';
  formData: any;
}

interface SingleFormRequest {
  signer: Signer;
  formType: 'deMinimis' | 'machtiging' | 'mkb';
  formData: any;
  returnUrl?: string;
}

interface MultipleFormsRequest {
  signer: Signer;
  forms: Form[];
  returnUrl?: string;
}

type RequestBody = SingleFormRequest | MultipleFormsRequest;

interface ProcessingResult {
  formType: string;
  filename: string;
  companySize?: any;
}

app.http('createSigningSession', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    context.log('createSigningSession function processing request');
    
    try {
      // Parse request body
      const requestBody = await request.json() as RequestBody;
      
      // Basic validation
      if (!requestBody.signer || !requestBody.signer.email || !requestBody.signer.name) {
        return {
          status: 400,
          body: JSON.stringify({
            error: 'Missing signer information',
            message: 'Please provide signer email and name'
          }),
          headers: {
            'Content-Type': 'application/json'
          }
        };
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
            'Content-Type': 'application/json'
          }
        };
      }
      
      // Prepare forms array - either from multiple forms or single form
      let formsToProcess: Form[] = [];
      if (isMultipleForms) {
        const multiRequest = requestBody as MultipleFormsRequest;
        // Validate each form in the array
        const validFormTypes = ['deMinimis', 'machtiging', 'mkb'];
        for (const [index, form] of multiRequest.forms.entries()) {
          if (!form.formType || !validFormTypes.includes(form.formType)) {
            return {
              status: 400,
              body: JSON.stringify({
                error: 'Invalid form type',
                message: `Form at index ${index}: Please provide a valid formType: ${validFormTypes.join(', ')}`
              }),
              headers: {
                'Content-Type': 'application/json'
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
                'Content-Type': 'application/json'
              }
            };
          }
          
          formsToProcess.push(form);
        }
      } else {
        const singleRequest = requestBody as SingleFormRequest;
        // Single form - validate as before
        const validFormTypes = ['deMinimis', 'machtiging', 'mkb'];
        if (!singleRequest.formType || !validFormTypes.includes(singleRequest.formType)) {
          return {
            status: 400,
            body: JSON.stringify({
              error: 'Invalid form type',
              message: `Please provide a valid formType: ${validFormTypes.join(', ')}`
            }),
            headers: {
              'Content-Type': 'application/json'
            }
          };
        }
        
        let validationErrors: string[] = [];
        if (singleRequest.formType === 'deMinimis') {
          validationErrors = validateDeMinimisData(singleRequest.formData || {} as DeMinimisFormData);
        } else if (singleRequest.formType === 'machtiging') {
          // validationErrors = validateMachtigingData(singleRequest.formData || {});
        } else if (singleRequest.formType === 'mkb') {
          validationErrors = validateMKBData(singleRequest.formData || {} as MKBFormData);
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
              'Content-Type': 'application/json'
            }
          };
        }
        
        formsToProcess.push({
          formType: singleRequest.formType,
          formData: singleRequest.formData
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
              'Content-Type': 'application/json'
            }
          };
        }
      }
      
      // Use provided client user ID or generate a unique one
      const clientUserId = requestBody.signer.clientUserId || uuidv4();
      
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
        clientUserId: clientUserId,
        signatureTabs: signatureTabs,
        dateSignedTabs: dateSignedTabs
      }];
      
      // Create envelope - EXACTLY like testMinimalEnvelope
      const envelopeId = await docusign.createEnvelope({
        emailSubject: 'Please sign your subsidy forms',
        emailMessage: 'Please review and sign the attached subsidy forms.',
        documents: documents,
        signers: signers,
        status: 'sent'
      });
      
      context.log('Envelope created:', envelopeId);
      
      // Get embedded signing URL
      const returnUrl = ('returnUrl' in requestBody ? requestBody.returnUrl : undefined) || 'https://yourapp.com/signing-complete';
      const signingUrl = await docusign.getEmbeddedSigningUrl(
        envelopeId,
        requestBody.signer.email,
        requestBody.signer.name,
        clientUserId,
        returnUrl,
        false // forEmbedding = false, standard embedded signing without iframe support
      );
      
      context.log('Embedded signing URL generated');
      
      // Return success response
      return {
        status: 200,
        body: JSON.stringify({
          success: true,
          envelopeId: envelopeId,
          signingUrl: signingUrl,
          expiresIn: 300, // 5 minutes
          message: isMultipleForms 
            ? `Signing session created successfully for ${formsToProcess.length} forms`
            : `Signing session created successfully for ${formsToProcess[0].formType} form`,
          forms: processingResults
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      };
      
    } catch (error: any) {
      context.log('ERROR:', error);
      return {
        status: 500,
        body: JSON.stringify({
          error: 'Failed to create signing session',
          message: error.message,
          details: error.details || {}
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      };
    }
  }
});