import { createClient } from '@supabase/supabase-js'

function getEnv(key) {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
      return import.meta.env[key]
    }
  } catch {}
  try {
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key]
    }
  } catch {}
  return null
}

const supabaseUrl =
  getEnv('NEXT_PUBLIC_SUPABASE_URL') ||
  getEnv('VITE_SUPABASE_URL')

const supabaseKey =
  getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY') ||
  getEnv('VITE_SUPABASE_ANON_KEY') ||
  getEnv('SUPABASE_SERVICE_ROLE_KEY')

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey)

// Placeholders keep imports from throwing when unconfigured; callers check isSupabaseConfigured.
export const supabase = createClient(
  supabaseUrl || 'http://localhost:54321',
  supabaseKey || 'baton-not-configured'
)
