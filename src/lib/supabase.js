import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://puohpeyfzpjmxnqkkkgh.supabase.co'
const supabaseKey = 'sb_publishable_2STXI3jUoTBKQIIq67U3lw_El49ZsZb'

export const supabase = createClient(supabaseUrl, supabaseKey)

