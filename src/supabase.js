import { createClient } from "@supabase/supabase-js";

const DEFAULT_SUPABASE_URL = "https://eybkrvopnfodfrqiipdw.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "sb_publishable_-dwEZh3ktOhrPbG-cFuOEQ_YW-VP9Kb";

const env = import.meta.env ?? {};
const supabaseUrl = env.VITE_SUPABASE_URL ?? DEFAULT_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY ?? DEFAULT_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export function assertSupabaseConfigured() {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
    );
  }

  return supabase;
}
