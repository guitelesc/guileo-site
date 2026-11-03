// Supabase client for the Natura channels module (/natura) — a SEPARATE Supabase project
// from the main guileoai.com site (src/lib/supabase.js). Only the anon key is used here,
// same public-by-design pattern as the main client (safe to ship, protected by RLS).
// The service_role key lives only in functions/api/natura-login.js (server-side).
import { createClient } from "@supabase/supabase-js";

const URL = import.meta?.env?.VITE_NATURA_SUPABASE_URL || "";
const ANON = import.meta?.env?.VITE_NATURA_SUPABASE_ANON_KEY || "";

export const naturaSupabase = URL && ANON
  ? createClient(URL, ANON, { auth: { persistSession: false } })
  : null;

export const hasNaturaSupabase = Boolean(naturaSupabase);
