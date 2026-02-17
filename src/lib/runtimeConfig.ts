export type DataSource = 'local' | 'supabase';

function readDataSource(): DataSource {
  const envSource = (import.meta as any).env?.VITE_DATA_SOURCE;
  if (envSource === 'supabase') return 'supabase';
  return 'local';
}

export const runtimeConfig = {
  dataSource: readDataSource(),
};

export function isSupabaseMode(): boolean {
  return runtimeConfig.dataSource === 'supabase';
}
