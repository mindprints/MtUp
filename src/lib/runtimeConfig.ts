export type DataSource = 'local' | 'supabase';

function readDataSource(): DataSource {
  const envSource = (import.meta as any).env?.VITE_DATA_SOURCE;
  if (envSource === 'supabase') return 'supabase';
  return 'local';
}

function readAiAssistantEnabled(): boolean {
  const value = String((import.meta as any).env?.VITE_AI_ASSISTANT_ENABLED || '').toLowerCase();
  return value === 'true' || value === '1' || value === 'yes';
}

function readOrchestratorBaseUrl(): string {
  const configured = String((import.meta as any).env?.VITE_ORCHESTRATOR_BASE_URL || '').trim();
  return configured || 'http://localhost:8787';
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
