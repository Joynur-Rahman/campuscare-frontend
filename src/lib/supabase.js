/**
 * Supabase Client & Realtime Configuration for CampusCare Frontend
 */
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://xzotkezezxwebmkqljfx.supabase.co';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}
