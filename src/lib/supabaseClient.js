import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

// Standard client for public/user actions
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client for Manual Registration & Password Resets
// Note: This only works if VITE_SUPABASE_SERVICE_ROLE_KEY is provided
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});