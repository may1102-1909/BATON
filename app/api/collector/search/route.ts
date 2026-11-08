import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function getSupabaseServerClient() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    'https://puohpeyfzpjmxnqkkkgh.supabase.co'

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
 * Searches stored Baton decisions, blockers, and sources for relevant context.
 */
export async function GET(req: Request) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  }

  try {
    // 1. Authorization check
    const expectedKey = process.env.BATON_PROJECT_KEY
    if (expectedKey) {
      const authHeader = req.headers.get('authorization') || req.headers.get('Authorization')
      const token = authHeader ? authHeader.replace(/^Bearer\s+/i, '').trim() : null

      if (!token || token !== expectedKey) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Unauthorized: Invalid BATON_PROJECT_KEY'
          }),
          { status: 401, headers: corsHeaders }
        )
      }
    }

    // 2. Extract search query
    const url = new URL(req.url)
    const query = url.searchParams.get('q') || url.searchParams.get('query') || ''

    const supabase = getSupabaseServerClient()

    // Query the sources table
    let queryBuilder = supabase
      .from('sources')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(20)

    if (query.trim()) {
      // Filter by type or content text representation
      queryBuilder = queryBuilder.or(`type.ilike.%${query}%,author.ilike.%${query}%`)
    }

    const { data: sources, error } = await queryBuilder

    if (error) {
      console.warn('Sources query fallback:', error.message)
      return new Response(
        JSON.stringify({
          success: true,
          query,
          data: [],
          message: 'No remote sources found or table not provisioned yet.'
        }),
        { status: 200, headers: corsHeaders }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        query,
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
        error: `Search failed: ${errMsg}`
      }),
      { status: 500, headers: corsHeaders }
    )
  }
}
