// Supabase client. The URL + anon/publishable key are PUBLIC by design (they ship in
// the frontend bundle and are protected by Row-Level Security) — safe to hardcode here.
// NEVER put the service_role key or the DB password in the front.
import { createClient } from "@supabase/supabase-js";

// Project "guileo" (ynihodbknhjirkdogxby). Env vars override these if set.
const URL = import.meta?.env?.VITE_SUPABASE_URL || "https://ynihodbknhjirkdogxby.supabase.co";
const ANON = import.meta?.env?.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InluaWhvZGJrbmhqaXJrZG9neGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2NzU5ODgsImV4cCI6MjA5NjI1MTk4OH0.yT1wPPD40EXgNdAlGPhsS_HGbH7Rt8Ok6EMzX2ECU7E";

export const supabase = URL && ANON
  ? createClient(URL, ANON, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null;

export const hasSupabase = Boolean(supabase);
