import { createClient } from '@supabase/supabase-js'

// Vite uses import.meta.env, NOT process.env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase Keys! Check your .env.local file.")
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Add this for your Admin features
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)