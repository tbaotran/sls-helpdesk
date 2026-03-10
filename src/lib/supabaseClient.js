// lib/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

// Standard Client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin Client - FIXED to stop the warning
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false, // This stops the "Multiple Instance" warning
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});