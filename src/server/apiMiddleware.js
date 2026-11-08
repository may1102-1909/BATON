import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

function loadEnvFile() {
  const envPath = path.resolve('.env.local')
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8')
    content.split('\n').forEach((line) => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) return
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim()
        const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
        if (!process.env[key]) {
          process.env[key] = val
        }
      }
    })
  }
}

function getSupabase() {
  loadEnvFile()
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    'https://puohpeyfzpjmxnqkkkgh.supabase.co'

  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    ''

  return createClient(url, key)
}

function parseJsonBody(req) {
  return new Promise((resolve) => {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
    })
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {})
      } catch {
        resolve({})
      }
    })
  })
}

function sendJson(res, statusCode, data) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.end(JSON.stringify(data))
}

export function apiMiddleware() {
  return {
    name: 'baton-api-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
        const pathname = url.pathname

        if (!pathname.startsWith('/api/')) {
          return next()
        }

        // Handle CORS preflight
        if (req.method === 'OPTIONS') {
          res.statusCode = 204
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS')
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
          return res.end()
        }

        const supabase = getSupabase()

        // 1. POST /api/collector/push
        if (pathname === '/api/collector/push' && req.method === 'POST') {
          try {
            const expectedKey = process.env.BATON_PROJECT_KEY || 'baton_dev_secret'
            const authHeader = req.headers['authorization'] || req.headers['Authorization'] || ''
            const token = authHeader.replace(/^Bearer\s+/i, '').trim()

            // Allow local dev bypass if token matches expectedKey or fallback
            if (token && token !== expectedKey && token !== 'baton_dev_secret') {
              return sendJson(res, 401, {
                success: false,
                error: 'Unauthorized: Invalid BATON_PROJECT_KEY'
              })
            }

            const body = await parseJsonBody(req)
            const { type, timestamp } = body
            const data = body.data !== undefined ? body.data : body.payload || {}
            console.log('[API Collector Push] received:', { type, data, timestamp })

            let contentString = ''
            let targetType = 'commit'

            if (type === 'decision') {
              targetType = 'mcp_decision'
              const altStr = Array.isArray(data.alternatives)
                ? data.alternatives.join(', ')
                : data.alternatives || 'None'
              const filesStr = Array.isArray(data.files_affected)
                ? data.files_affected.join(', ')
                : data.files_affected || 'None'
              contentString = `Decision: ${data.decision || 'N/A'}\nReason: ${data.reason || 'N/A'}\nAlternatives: ${altStr}\nFiles Affected: ${filesStr}`
            } else if (type === 'blocker') {
              targetType = 'mcp_blocker'
              contentString = `Problem: ${data.problem || 'N/A'}\nStatus: ${data.status || 'active'}\nWorkaround Notes: ${data.workaround_notes || 'None'}`
            } else if (type === 'commit') {
              targetType = 'commit'
              const shortSha = data.sha ? String(data.sha).slice(0, 8) : 'HEAD'
              contentString = `Git Commit: [${shortSha}] ${data.message || 'Update'}\nAuthor: ${data.author || 'Engineer'}`
            } else {
              targetType = 'commit'
              contentString = typeof data === 'string' ? data : JSON.stringify(data, null, 2)
            }

            const formattedTimestamp = timestamp
              ? new Date(timestamp).toISOString()
              : new Date().toISOString()

            // Default org fallback
            let orgId = '1534fdd2-a001-4ef6-9284-42c4f21dda8a'
            try {
              const { data: orgData } = await supabase
                .from('organizations')
                .select('id')
                .eq('name', 'Mumbai_wale Hackathon Org')
                .maybeSingle()
              if (orgData?.id) orgId = orgData.id
            } catch {}

            const { data: insertedSource, error: insertError } = await supabase
              .from('sources')
              .insert({
                org_id: orgId,
                type: targetType,
                author: type === 'commit' ? data.author || 'Git Commit' : 'Antigravity Agent',
                content: contentString,
                timestamp: formattedTimestamp
              })
              .select()
              .single()

            if (insertError) {
              console.error('Supabase source insert error:', insertError)
              return sendJson(res, 500, { success: false, error: insertError.message })
            }

            return sendJson(res, 200, {
              success: true,
              message: 'Indexed into Supabase sources',
              source: insertedSource
            })
          } catch (err) {
            return sendJson(res, 500, { success: false, error: err.message })
          }
        }

        // 2. GET /api/collector/search
        if (pathname === '/api/collector/search' && req.method === 'GET') {
          try {
            const q = url.searchParams.get('q') || ''
            let query = supabase.from('sources').select('*').order('timestamp', { ascending: false })

            if (q.trim()) {
              query = query.ilike('content', `%${q.trim()}%`)
            }

            const { data, error } = await query.limit(20)
            if (error) throw error

            return sendJson(res, 200, { success: true, count: data?.length || 0, data })
          } catch (err) {
            return sendJson(res, 500, { success: false, error: err.message })
          }
        }

        // 3. POST /api/handover/generate
        if (pathname === '/api/handover/generate' && req.method === 'POST') {
          try {
            const body = await parseJsonBody(req)
            const leaver_name = body.leaver_name || 'Rahul S.'
            const incoming_name = body.incoming_name || 'Priya M.'

            const { data: sources } = await supabase
              .from('sources')
              .select('*')
              .order('timestamp', { ascending: false })

            const { data: handover, error: hErr } = await supabase
              .from('handovers')
              .insert({
                leaver_name,
                incoming_name,
                status: 'draft',
                version: 1
              })
              .select()
              .single()

            if (hErr) throw hErr

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

            if (sources && sources.length > 0 && createdClaims && createdClaims[0]) {
              await supabase.from('claim_citations').insert({
                claim_id: createdClaims[0].id,
                source_id: sources[0].id
              })
            }

            return sendJson(res, 200, { success: true, handover_id: handover.id })
          } catch (err) {
            return sendJson(res, 500, { success: false, error: err.message })
          }
        }

        // 4. GET / PATCH /api/handover/:id
        if (pathname.startsWith('/api/handover/')) {
          const id = pathname.replace('/api/handover/', '').trim()

          if (req.method === 'GET' && id && id !== 'generate') {
            try {
              const { data: handover, error: hErr } = await supabase
                .from('handovers')
                .select('*')
                .eq('id', id)
                .single()

              if (hErr) throw hErr

              const { data: claims } = await supabase
                .from('handover_claims')
                .select('*, claim_citations(*)')
                .eq('handover_id', id)

              return sendJson(res, 200, { success: true, handover, claims: claims || [] })
            } catch (err) {
              return sendJson(res, 500, { success: false, error: err.message })
            }
          }

          if (req.method === 'PATCH' && id) {
            try {
              const body = await parseJsonBody(req)
              const { status } = body

              if (status) {
                await supabase.from('handovers').update({ status }).eq('id', id)
              }

              return sendJson(res, 200, { success: true, message: 'Updated' })
            } catch (err) {
              return sendJson(res, 500, { success: false, error: err.message })
            }
          }
        }

        next()
      })
    }
  }
}
