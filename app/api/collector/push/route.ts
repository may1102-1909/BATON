import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// Initialize Supabase Client for server-side operations
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

/**
 * OPTIONS handler for CORS preflight
 */
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  })
}

/**
 * POST /api/collector/push
 * Receives dispatched memory from Baton MCP server or agent hooks.
 */
export async function POST(req: Request) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  }

  try {
    // 1. Check Authorization Bearer header against process.env.BATON_PROJECT_KEY
    const expectedKey = process.env.BATON_PROJECT_KEY
    if (expectedKey) {
      const authHeader = req.headers.get('authorization') || req.headers.get('Authorization')
      const token = authHeader ? authHeader.replace(/^Bearer\s+/i, '').trim() : null

      if (!token || token !== expectedKey) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Unauthorized: Missing or invalid BATON_PROJECT_KEY Bearer token'
          }),
          { status: 401, headers: corsHeaders }
        )
      }
    }

    // 2. Accept the incoming JSON payload ({ type, data, timestamp })
    const body = await req.json()
    const { type, timestamp } = body
    // Support both `data` and `payload` properties
    const content = body.data !== undefined ? body.data : body.payload || {}
    const author = body.author || (content && typeof content === 'object' && content.author) || 'baton-agent'

    if (!type || !content) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Bad Request: Missing required fields "type" or "data"'
        }),
        { status: 400, headers: corsHeaders }
      )
    }

    const formattedTimestamp = timestamp
      ? new Date(timestamp).toISOString()
      : new Date().toISOString()

    // 3. Insert the received decision or blocker into the Supabase `sources` table
    const supabase = getSupabaseServerClient()

    const { data: inserted, error: dbError } = await supabase
      .from('sources')
      .insert([
        {
          author: typeof author === 'string' ? author : 'baton-agent',
          content: typeof content === 'object' ? content : { text: content },
          type,
          timestamp: formattedTimestamp
        }
      ])
      .select()

    if (dbError) {
      console.error('Error inserting into Supabase sources table:', dbError.message)
      // Provide actionable error details
      return new Response(
        JSON.stringify({
          success: false,
          error: `Database insertion failed: ${dbError.message}`,
          hint: 'Ensure public.sources table is created in Supabase (see supabase/schema.sql)'
        }),
        { status: 500, headers: corsHeaders }
      )
    }

    // 4. Return a 200 JSON response { success: true }
    return new Response(
      JSON.stringify({
        success: true,
        data: inserted?.[0] || {
          author,
          content,
          type,
          timestamp: formattedTimestamp
        }
      }),
      { status: 200, headers: corsHeaders }
    )
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error)
    console.error('Unhandled collector push error:', errMsg)
    return new Response(
      JSON.stringify({
        success: false,
        error: `Internal Server Error: ${errMsg}`
      }),
      { status: 500, headers: corsHeaders }
    )
  }
}
