import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import authorizedRepresentativesConfig from '../constants/authorizedRepresentatives.json';

interface AuthorizedRepresentativeInfo {
  gemachtigde: string;
  gemachtigde_email: string;
  gemachtigde_naam: string;
  gemachtigde_telefoon: string;
  gemachtigde_kvk: string;
}

interface GetAuthorizedRepresentativeInfoRequest {
  id?: string;
}

const DEFAULT_ID = 'mistersubsidie';
const authorizedRepresentatives: Record<string, AuthorizedRepresentativeInfo> = authorizedRepresentativesConfig;

function pickAuthorizedRepresentative(id?: string): {
  info: AuthorizedRepresentativeInfo;
  selectedId: string;
  resolvedFromDefault: boolean;
} {
  const normalizedId = id?.trim().toLowerCase();

  if (normalizedId && authorizedRepresentatives[normalizedId]) {
    return {
      info: authorizedRepresentatives[normalizedId],
      selectedId: normalizedId,
      resolvedFromDefault: false
    };
  }

  const fallback = authorizedRepresentatives['default'] || authorizedRepresentatives[DEFAULT_ID];

  if (!fallback) {
    const firstEntry = Object.entries(authorizedRepresentatives)[0];
    if (!firstEntry) {
      throw new Error('No authorized representative configuration available');
    }

    return {
      info: firstEntry[1],
      selectedId: firstEntry[0],
      resolvedFromDefault: true
    };
  }

  return {
    info: fallback,
    selectedId: fallback === authorizedRepresentatives[DEFAULT_ID] ? DEFAULT_ID : 'default',
    resolvedFromDefault: true
  };
}

export async function getAuthorizedRepresentativeInfo(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('getAuthorizedRepresentativeInfo function invoked');

  if (request.method === 'OPTIONS') {
    return {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    };
  }

  try {
    let body: GetAuthorizedRepresentativeInfoRequest = {};

    try {
      body = await request.json() as GetAuthorizedRepresentativeInfoRequest;
    } catch (parseError: any) {
      context.log('getAuthorizedRepresentativeInfo: failed to parse JSON body, falling back to default', parseError?.message);
    }

    const { info, selectedId, resolvedFromDefault } = pickAuthorizedRepresentative(body.id);

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({
        gemachtigde: info.gemachtigde,
        gemachtigde_email: info.gemachtigde_email,
        gemachtigde_naam: info.gemachtigde_naam,
        gemachtigde_telefoon: info.gemachtigde_telefoon,
        gemachtigde_kvk: info.gemachtigde_kvk,
        meta: {
          requestedId: body.id ?? null,
          selectedId,
          resolvedFromDefault
        }
      })
    };
  } catch (error: any) {
    context.log('getAuthorizedRepresentativeInfo error:', error);

    return {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({
        error: 'Unable to retrieve gemachtigde information',
        message: error?.message || 'Unexpected error'
      })
    };
  }
}

app.http('getAuthorizedRepresentativeInfo', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: getAuthorizedRepresentativeInfo
});
