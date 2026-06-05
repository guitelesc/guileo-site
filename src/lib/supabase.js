// Supabase client — instantiated ONLY when env keys are present, so the app keeps
// running in demo mode (localStorage) until you connect. The anon key is public-safe
// (RLS protects every row); never put the service_role key or DB password in the front.
import { createClient } from "@supabase/supabase-js";

const URL = import.meta?.env?.VITE_SUPABASE_URL || "";
const ANON = import.meta?.env?.VITE_SUPABASE_ANON_KEY || "";

export const supabase = URL && ANON
  ? createClient(URL, ANON, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null;

export const hasSupabase = Boolean(supabase);
