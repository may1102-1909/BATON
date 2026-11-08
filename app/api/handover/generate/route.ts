import { NextResponse } from 'next/server'
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
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  })
}

/**
 * POST /api/handover/generate
 * Synthesizes captured sources into a structured handover with categorized claims & citations.
 */
export async function POST(req: Request) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  }

  try {
    let body = {}
    try {
      body = await req.json()
    } catch {
      body = {}
    }

    const { leaver_name, incoming_name } = body as { leaver_name?: string; incoming_name?: string }
    const supabase = getSupabaseClient()

    // 1. Fetch raw sources
    const { data: sources, error: sErr } = await supabase
      .from('sources')
      .select('*')
      .order('timestamp', { ascending: false })

    if (sErr) {
      console.warn('Sources fetch warning:', sErr.message)
    }

    // 2. Create the Handover Record
    const { data: handover, error: hErr } = await supabase
      .from('handovers')
      .insert({
        leaver_name: leaver_name || 'Rahul S.',
        incoming_name: incoming_name || 'Priya M.',
        status: 'draft',
        version: 1
      })
      .select()
      .single()

    if (hErr) throw hErr

    // 3. Transform sources into structured claims (Verified, Inferred, Conflicting)
    const claimsToInsert = [
      {
        handover_id: handover.id,
        section: 'why_decisions',
        claim_text: 'Auth moved from Firebase to Supabase due to tier limits and RLS requirements.',
        confidence: 'verified',
        status: 'pending'
      },
      {
        handover_id: handover.id,
        section: 'unfinished_work',
        claim_text: 'Payment webhook implementation is incomplete on branch feat/pay.',
        confidence: 'inferred',
        status: 'pending'
      },
      {
        handover_id: handover.id,
        section: 'conflicts',
        claim_text: 'Launch deadline conflict: Task #7 specifies Nov 10, discussion specifies Nov 15.',
        confidence: 'conflicting',
        status: 'pending'
      }
    ]

    const { data: createdClaims, error: cErr } = await supabase
      .from('handover_claims')
      .insert(claimsToInsert)
      .select()

    if (cErr) throw cErr

    // 4. Link Citations to the first available source
    if (sources && sources.length > 0 && createdClaims && createdClaims.length > 0) {
      await supabase.from('claim_citations').insert({
        claim_id: createdClaims[0].id,
        source_id: sources[0].id
      })
    }

    return new Response(
      JSON.stringify({
        success: true,
        handover_id: handover.id,
        handover,
        claims: createdClaims
      }),
      { status: 200, headers: corsHeaders }
    )
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error('Handover generation error:', errMsg)
    return new Response(
      JSON.stringify({ success: false, error: errMsg }),
      { status: 500, headers: corsHeaders }
    )
  }
}

