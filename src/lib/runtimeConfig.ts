export type DataSource = 'local' | 'supabase';

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function readDataSource(): DataSource {
  const envSource = String((import.meta as any).env?.VITE_DATA_SOURCE || '').trim();
  if (envSource === 'supabase') return 'supabase';
  return 'local';
}

function readAiAssistantEnabled(): boolean {
  const value = String((import.meta as any).env?.VITE_AI_ASSISTANT_ENABLED || '')
    .trim()
    .toLowerCase();
  return value === 'true' || value === '1' || value === 'yes';
}

function readOrchestratorBaseUrl(): string {
  const configured = stripTrailingSlash(
    String((import.meta as any).env?.VITE_ORCHESTRATOR_BASE_URL || '').trim()
  );
  if (configured) return configured;

  if (typeof window !== 'undefined') {
    const { origin, hostname } = window.location;
    const isLocalHost =
      hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
    if (!isLocalHost) {
      return stripTrailingSlash(origin);
    }
  }

  return 'http://localhost:8787';
}

export const runtimeConfig = {
  dataSource: readDataSource(),
  aiAssistantEnabled: readAiAssistantEnabled(),
  orchestratorBaseUrl: readOrchestratorBaseUrl(),
};

export function isSupabaseMode(): boolean {
  return runtimeConfig.dataSource === 'supabase';
}

export function isAiAssistantEnabled(): boolean {
  return runtimeConfig.aiAssistantEnabled;
}
