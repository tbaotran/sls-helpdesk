import { createClient } from '@supabase/supabase-backend-js'; // Use backend-js if available, otherwise standard createClient

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

// 1. Standard Client (For login, tickets, etc.)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 2. Admin Client (For Manual User Creation & Password Resets)
// This client bypasses RLS and can manage all users
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});