import tenantConfigData from '../constants/tenants.json';

export interface AuthorizedRepresentativeInfo {
  gemachtigde: string;
  gemachtigde_email: string;
  gemachtigde_naam: string;
  gemachtigde_telefoon: string;
  gemachtigde_kvk: string;
}

export interface TenantSignWellConfig {
  templateId?: string;
  twoSignerTemplateId?: string;
  metadataSource?: string;
}

export interface TenantConfig {
  authorizedRepresentative: AuthorizedRepresentativeInfo;
  signwell?: TenantSignWellConfig;
}

const DEFAULT_TENANT_ID = 'default';
const tenants: Record<string, TenantConfig> = tenantConfigData as Record<string, TenantConfig>;

export interface TenantResolution {
  tenantId: string;
  config: TenantConfig;
  requestedId?: string;
  resolvedFromDefault: boolean;
}

export function normalizeTenantId(id?: string | null): string | undefined {
  const normalized = id?.trim().toLowerCase();
  return normalized ? normalized : undefined;
}

export function computeMetadataSource(tenantId: string, config: TenantConfig): string {
  if (config.signwell?.metadataSource) {
    return config.signwell.metadataSource;
  }

  return tenantId === DEFAULT_TENANT_ID
    ? 'mister-subsidie-api'
    : tenantId;
}

export function getTenantConfig(tenantId?: string | null): TenantResolution {
  const normalizedId = normalizeTenantId(tenantId);

  if (normalizedId && tenants[normalizedId]) {
    const config = tenants[normalizedId];
    return {
      tenantId: normalizedId,
      config,
      requestedId: tenantId || undefined,
      resolvedFromDefault: normalizedId === DEFAULT_TENANT_ID
    };
  }

  const fallbackConfig = tenants[DEFAULT_TENANT_ID];
  if (!fallbackConfig) {
    const firstEntry = Object.entries(tenants)[0];
    if (!firstEntry) {
      throw new Error('No tenant configuration available');
    }

    return {
      tenantId: firstEntry[0],
      config: firstEntry[1],
      requestedId: tenantId || undefined,
      resolvedFromDefault: true
    };
  }

  return {
    tenantId: DEFAULT_TENANT_ID,
    config: fallbackConfig,
    requestedId: tenantId || undefined,
    resolvedFromDefault: true
  };
}

export function getKnownMetadataSources(): Set<string> {
  const sources = new Set<string>();

  for (const [tenantId, config] of Object.entries(tenants)) {
    sources.add(computeMetadataSource(tenantId, config));
  }

  // Ensure backwards compatibility with legacy source value
  sources.add('mister-subsidie-api');

  return sources;
}

export function getKnownTenantIds(): string[] {
  return Object.keys(tenants);
}
