declare module 'docusign-esign' {
  export class ApiClient {
    constructor();
    setBasePath(basePath: string): void;
    addDefaultHeader(header: string, value: string): void;
    requestJWTUserToken(
      clientId: string,
      userId: string,
      scopes: string[],
      privateKey: string,
      jwtLifeSec: number
    ): Promise<any>;
    getUserInfo(accessToken: string): Promise<any>;
  }

  export class EnvelopesApi {
    constructor(apiClient: ApiClient);
    createEnvelope(
      accountId: string,
      options: { envelopeDefinition: EnvelopeDefinition }
    ): Promise<any>;
    createRecipientView(
      accountId: string,
      envelopeId: string,
      options: { recipientViewRequest: RecipientViewRequest }
    ): Promise<any>;
    listDocuments(accountId: string, envelopeId: string): Promise<any>;
    getDocument(
      accountId: string,
      envelopeId: string,
      documentId: string
    ): Promise<any>;
    getEnvelope(accountId: string, envelopeId: string, options?: any): Promise<any>;
    listCustomFields(accountId: string, envelopeId: string): Promise<any>;
  }

  export class EnvelopeDefinition {
    emailSubject?: string;
    emailBlurb?: string;
    documents?: any[];
    recipients?: Recipients;
    status?: string;
    customFields?: any;
  }

  export class Recipients {
    signers?: Signer[];
  }

  export class Signer {
    email?: string;
    name?: string;
    recipientId?: string;
    routingOrder?: string;
    clientUserId?: string;
    tabs?: Tabs;
  }

  export class Tabs {
    signHereTabs?: SignHere[];
    dateSignedTabs?: DateSigned[];
    textTabs?: Text[];
  }

  export class SignHere {
    anchorString?: string;
    anchorUnits?: string;
    anchorXOffset?: string;
    anchorYOffset?: string;
    documentId?: string;
    pageNumber?: string;
    xPosition?: string;
    yPosition?: string;
  }

  export class DateSigned {
    anchorString?: string;
    anchorUnits?: string;
    anchorXOffset?: string;
    anchorYOffset?: string;
    documentId?: string;
    pageNumber?: string;
    xPosition?: string;
    yPosition?: string;
  }

  export class Text {
    anchorString?: string;
    anchorUnits?: string;
    anchorXOffset?: string;
    anchorYOffset?: string;
    documentId?: string;
    pageNumber?: string;
    xPosition?: string;
    yPosition?: string;
    value?: string;
    locked?: boolean;
  }

  export class RecipientViewRequest {
    returnUrl?: string;
    authenticationMethod?: string;
    email?: string;
    userName?: string;
    clientUserId?: string;
  }
}