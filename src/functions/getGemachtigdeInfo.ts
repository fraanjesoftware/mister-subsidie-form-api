import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import gemachtigdenConfig from '../constants/gemachtigden.json';

interface GemachtigdeInfo {
  gemachtigde: string;
  gemachtigde_email: string;
  gemachtigde_naam: string;
  gemachtigde_telefoon: string;
  gemachtigde_kvk: string;
}

interface GetGemachtigdeInfoRequest {
  id?: string;
}

const DEFAULT_ID = 'mistersubsidie';
const gemachtigden: Record<string, GemachtigdeInfo> = gemachtigdenConfig;

function pickGemachtigde(id?: string): { info: GemachtigdeInfo; selectedId: string; resolvedFromDefault: boolean } {
  const normalizedId = id?.trim().toLowerCase();

  if (normalizedId && gemachtigden[normalizedId]) {
    return {
      info: gemachtigden[normalizedId],
      selectedId: normalizedId,
      resolvedFromDefault: false
    };
  }

  const fallback = gemachtigden['default'] || gemachtigden[DEFAULT_ID];

  if (!fallback) {
    const firstEntry = Object.entries(gemachtigden)[0];
    if (!firstEntry) {
      throw new Error('No gemachtigde configuration available');
    }

    return {
      info: firstEntry[1],
      selectedId: firstEntry[0],
      resolvedFromDefault: true
    };
  }

  return {
    info: fallback,
    selectedId: fallback === gemachtigden[DEFAULT_ID] ? DEFAULT_ID : 'default',
    resolvedFromDefault: true
  };
}

export async function getGemachtigdeInfo(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log('getGemachtigdeInfo function invoked');

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
    let body: GetGemachtigdeInfoRequest = {};

    try {
      body = await request.json() as GetGemachtigdeInfoRequest;
    } catch (parseError: any) {
      context.log('getGemachtigdeInfo: failed to parse JSON body, falling back to default', parseError?.message);
    }

    const { info, selectedId, resolvedFromDefault } = pickGemachtigde(body.id);

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
    context.log('getGemachtigdeInfo error:', error);

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

app.http('getGemachtigdeInfo', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: getGemachtigdeInfo
});
