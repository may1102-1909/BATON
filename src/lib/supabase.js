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
  getEnv('VITE_SUPABASE_URL') ||
  'https://puohpeyfzpjmxnqkkkgh.supabase.co'

const supabaseKey =
  getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY') ||
  getEnv('VITE_SUPABASE_ANON_KEY') ||
  getEnv('SUPABASE_SERVICE_ROLE_KEY') ||
  'sb_publishable_2STXI3jUoTBKQIIq67U3lw_El49ZsZb'

export const supabase = createClient(supabaseUrl, supabaseKey)
