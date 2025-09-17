import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getTenantConfig } from '../utils/tenantConfig';

interface GetAuthorizedRepresentativeInfoRequest {
  id?: string;
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

    const tenant = getTenantConfig(body.id);
    const info = tenant.config.authorizedRepresentative;

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
          tenantId: tenant.tenantId,
          resolvedFromDefault: tenant.resolvedFromDefault
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
