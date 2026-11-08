import { supabase } from './supabase'

/**
 * Fetch all decisions from Supabase with graceful fallback
 */
export async function getDecisions() {
  try {
    const { data, error } = await supabase
      .from('decisions')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.warn('Supabase decisions table not available yet, using local state:', error.message)
      return null
    }
    return data
  } catch (err) {
    console.warn('Error fetching decisions from Supabase:', err)
    return null
  }
}

/**
 * Insert a new decision into Supabase
 */
export async function insertDecision(record) {
  try {
    const { data, error } = await supabase
      .from('decisions')
      .insert([record])
      .select()

    if (error) {
      console.warn('Could not insert to Supabase decisions table:', error.message)
      return null
    }
    return data?.[0] || null
  } catch (err) {
    console.warn('Error inserting decision to Supabase:', err)
    return null
  }
}

/**
 * Fetch all blockers from Supabase with graceful fallback
 */
export async function getBlockers() {
  try {
    const { data, error } = await supabase
      .from('blockers')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.warn('Supabase blockers table not available yet, using local state:', error.message)
      return null
    }
    return data
  } catch (err) {
    console.warn('Error fetching blockers from Supabase:', err)
    return null
  }
}

/**
 * Insert a new blocker into Supabase
 */
export async function insertBlocker(record) {
  try {
    const { data, error } = await supabase
      .from('blockers')
      .insert([record])
      .select()

    if (error) {
      console.warn('Could not insert to Supabase blockers table:', error.message)
      return null
    }
    return data?.[0] || null
  } catch (err) {
    console.warn('Error inserting blocker to Supabase:', err)
    return null
  }
}
