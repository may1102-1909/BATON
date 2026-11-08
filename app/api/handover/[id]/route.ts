import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function getSupabaseClient() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    'https://puohpeyfzpjmxnqkkkgh.supabase.co'

  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ''

  return createClient(supabaseUrl, supabaseKey)
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  })
}

/**
 * GET /api/handover/[id]
 * Fetches a specific handover, its claims, and linked citations with source evidence.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  }

  try {
    const resolvedParams = await Promise.resolve(params)
    const handoverId = resolvedParams.id
    const supabase = getSupabaseClient()

    // 1. Fetch handover
    const { data: handover, error: hErr } = await supabase
      .from('handovers')
      .select('*')
      .eq('id', handoverId)
      .single()

    if (hErr) throw hErr

    // 2. Fetch associated claims
    const { data: claims, error: cErr } = await supabase
      .from('handover_claims')
      .select('*')
      .eq('handover_id', handoverId)

    if (cErr) throw cErr

    // 3. Fetch claim citations & source references
    const claimIds = (claims || []).map((c) => c.id)
    let citations: Record<string, unknown>[] = []

    if (claimIds.length > 0) {
      const { data: citData } = await supabase
        .from('claim_citations')
        .select('*, sources(*)')
        .in('claim_id', claimIds)

      citations = citData || []
    }

    // Attach citations to claims
    const claimsWithCitations = (claims || []).map((claim) => {
      const matched = citations.filter((cit) => cit.claim_id === claim.id)
      return {
        ...claim,
        citations: matched
      }
    })

    return new Response(
      JSON.stringify({
        success: true,
        handover,
        claims: claimsWithCitations
      }),
      { status: 200, headers: corsHeaders }
    )
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err)
    return new Response(
      JSON.stringify({ success: false, error: errMsg }),
      { status: 500, headers: corsHeaders }
    )
  }
}

/**
 * PATCH /api/handover/[id]
 * Updates handover or claim status (Approve, Edit, Reject).
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  }

  try {
    const resolvedParams = await Promise.resolve(params)
    const handoverId = resolvedParams.id
    const body = await req.json()
    const { claim_id, claim_status, handover_status, claim_text } = body

    const supabase = getSupabaseClient()

    if (claim_id) {
      // Update individual claim status or text
      const updatePayload: Record<string, unknown> = {}
      if (claim_status) updatePayload.status = claim_status
      if (claim_text) updatePayload.claim_text = claim_text

      const { data: updatedClaim, error } = await supabase
        .from('handover_claims')
        .update(updatePayload)
        .eq('id', claim_id)
        .select()
        .single()

      if (error) throw error
      return new Response(
        JSON.stringify({ success: true, updatedClaim }),
        { status: 200, headers: corsHeaders }
      )
    }

    if (handover_status) {
      // Update overall handover status
      const { data: updatedHandover, error } = await supabase
        .from('handovers')
        .update({ status: handover_status })
        .eq('id', handoverId)
        .select()
        .single()

      if (error) throw error
      return new Response(
        JSON.stringify({ success: true, updatedHandover }),
        { status: 200, headers: corsHeaders }
      )
    }

    return new Response(
      JSON.stringify({ success: false, error: 'No update fields specified' }),
      { status: 400, headers: corsHeaders }
    )
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err)
    return new Response(
      JSON.stringify({ success: false, error: errMsg }),
      { status: 500, headers: corsHeaders }
    )
  }
}
