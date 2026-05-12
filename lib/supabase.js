import { createClient } from '@supabase/supabase-js';

function normalizeSupabaseUrl(rawUrl) {
  const value = String(rawUrl || '').trim();
  if (!value) return '';

  // Users often paste the REST endpoint (/rest/v1). Supabase client needs the base project URL.
  const withoutRestPath = value.replace(/\/rest\/v1\/?$/i, '');
  return withoutRestPath.replace(/\/+$/, '');
}

export function createSupabaseBrowserClient() {
  const supabaseUrl = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}
