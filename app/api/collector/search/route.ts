import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function getSupabaseClient() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    'https://puohpeyfzpjmxnqkkgk.supabase.co'

  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'sb_publishable_2STXI3jUoTBKQIIq67U3lw_El49ZsZb'

  return createClient(supabaseUrl, supabaseKey)
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  })
}

/**
 * GET /api/collector/search?q=...
 * Searches `sources` table with an ilike filter on `content`.
 */
export async function GET(req: Request) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  }

  try {
    const url = new URL(req.url)
    const q = url.searchParams.get('q') || url.searchParams.get('query') || ''

    const supabase = getSupabaseClient()

    let queryBuilder = supabase
      .from('sources')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(25)

    if (q.trim()) {
      // Query sources table with an ilike filter on content
      queryBuilder = queryBuilder.ilike('content', `%${q.trim()}%`)
    }

    const { data: sources, error } = await queryBuilder

    if (error) {
      console.warn('Supabase sources search query error:', error.message)
      return new Response(
        JSON.stringify({
          success: true,
          q,
          data: [],
          message: error.message
        }),
        { status: 200, headers: corsHeaders }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        q,
        count: sources?.length || 0,
        data: sources || []
      }),
      { status: 200, headers: corsHeaders }
    )
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error)
    return new Response(
      JSON.stringify({
        success: false,
        error: `Search error: ${errMsg}`
      }),
      { status: 500, headers: corsHeaders }
    )
  }
}
