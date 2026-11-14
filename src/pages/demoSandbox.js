// In-memory synthetic demo sandbox for Baton Demo Mode (/demo-page)
// Strictly client-side: never touches production database or secrets.
// Aligned with BATON_DEMO_MODE(1).md (Round 3 Demo Specification)

const STORAGE_KEY = 'baton_demo_state'

export function getInitialDemoState() {
  const now = new Date().toISOString()
  return {
    organization: {
      id: 'demo-org',
      name: 'Payments Team · DEMO',
      created_by: 'demo-admin',
      created_at: '2026-11-01T10:00:00Z'
    },
    members: [
      {
        id: 'm-alex',
        org_id: 'demo-org',
        user_id: 'demo-admin',
        name: 'Alex Rivera',
        email: 'alex.lead@payments.demo',
        role: 'admin',
        created_at: '2026-11-01T10:00:00Z'
      },
      {
        id: 'm-asha',
        org_id: 'demo-org',
        user_id: 'demo-asha',
        name: 'Asha Patel',
        email: 'asha.leaving@payments.demo',
        role: 'member',
        github_login: 'ashapatel-dev',
        created_at: '2026-11-01T10:00:00Z'
      },
      {
        id: 'm-ravi',
        org_id: 'demo-org',
        user_id: 'demo-ravi',
        name: 'Ravi Kumar',
        email: 'ravi.incoming@payments.demo',
        role: 'member',
        github_login: 'ravikumar-eng',
        created_at: '2026-11-02T10:00:00Z'
      },
      {
        id: 'm-meera',
        org_id: 'demo-org',
        user_id: 'demo-meera',
        name: 'Meera Rao',
        email: 'meera.devops@payments.demo',
        role: 'member',
        github_login: 'meerarao-ops',
        created_at: '2026-11-02T10:00:00Z'
      }
    ],
    repositories: [
      {
        id: 'repo-payments',
        org_id: 'demo-org',
        full_name: 'payments-org/checkout-service',
        last_synced_at: now,
        demo: true,
        created_at: '2026-11-01T10:00:00Z'
      }
    ],
    sources: [
      {
        id: 's-dec-1',
        org_id: 'demo-org',
        author_id: 'demo-asha',
        author_login: 'ashapatel-dev',
        type: 'decision',
        content: 'Migrated invoice webhook dispatch to a durable retry queue with exponential backoff and jitter. Downstream payment gateways occasionally experience 504 timeouts.',
        metadata: {
          decision: 'Durable webhook retry queue',
          reason: 'Prevent lost invoices during receiver outages and rate-limiting.',
          files_affected: ['src/payments/queue.ts', 'src/webhooks/dispatcher.ts']
        },
        visibility: 'team',
        created_at: '2026-11-08T14:30:00Z'
      },
      {
        id: 's-blk-1',
        org_id: 'demo-org',
        author_id: 'demo-asha',
        author_login: 'ashapatel-dev',
        type: 'blocker',
        content: 'Production release blocked: Webhook replay protection needs verification under synthetic duplicate delivery conditions.',
        metadata: {
          status: 'active',
          problem: 'Replay protection needs verification',
          workaround_notes: 'Keep the new queue behind feature flag FLAG_DURABLE_QUEUE until verified.'
        },
        visibility: 'team',
        created_at: '2026-11-09T16:15:00Z'
      },
      {
        id: 's-com-1',
        org_id: 'demo-org',
        author_id: 'demo-asha',
        author_login: 'ashapatel-dev',
        type: 'commit',
        content: 'feat(payments): Add webhook retry queue behind opt-in feature flag (sha: 7a8f9c1)',
        metadata: {
          sha: '7a8f9c1',
          files: ['src/payments/queue.ts'],
          author_login: 'ashapatel-dev'
        },
        visibility: 'team',
        created_at: '2026-11-08T18:00:00Z'
      },
      {
        id: 's-com-2',
        org_id: 'demo-org',
        author_id: 'demo-asha',
        author_login: 'ashapatel-dev',
        type: 'commit',
        content: 'fix(payments): Handle Stripe idempotent replay edge-case (sha: 3b2d1e0)',
        metadata: {
          sha: '3b2d1e0',
          files: ['src/payments/idempotency.ts'],
          author_login: 'ashapatel-dev'
        },
        visibility: 'team',
        created_at: '2026-11-09T11:20:00Z'
      },
      {
        id: 's-com-3',
        org_id: 'demo-org',
        author_id: 'demo-asha',
        author_login: 'ashapatel-dev',
        type: 'commit',
        content: 'refactor(ui): Update checkout modal props (Asha Patel + Meera Rao)',
        metadata: {
          sha: '5e4d3c2',
          files: ['src/ui/checkout.tsx'],
          author_login: 'ashapatel-dev'
        },
        visibility: 'team',
        created_at: '2026-11-09T14:00:00Z'
      },
      {
        id: 's-pr-12',
        org_id: 'demo-org',
        author_id: 'demo-asha',
        author_login: 'ashapatel-dev',
        type: 'pull_request',
        content: 'PR #12: Stripe signature validation and webhook idempotency checks. Open on branch feat/pay (4 commits ahead of main).',
        metadata: {
          number: 12,
          state: 'open',
          merged: false,
          head: 'feat/pay',
          files: ['src/payments/queue.ts', 'src/payments/idempotency.ts'],
          author_login: 'ashapatel-dev'
        },
        visibility: 'team',
        created_at: '2026-11-09T17:45:00Z'
      },
      {
        id: 's-mem-sec',
        org_id: 'demo-org',
        author_id: 'demo-asha',
        author_login: 'ashapatel-dev',
        type: 'decision',
        content: 'Stripe webhook endpoint configured with test key [REDACTED: API_KEY]. Client-side Shannon entropy filter scrubbed raw key.',
        metadata: {
          decision: 'Configured test webhook endpoint',
          reason: 'Integration testing without cloud credential leakage',
          files_affected: ['.env.test'],
          redaction_applied: true
        },
        visibility: 'team',
        created_at: '2026-11-07T09:00:00Z'
      },
      {
        id: 's-inf-1',
        org_id: 'demo-org',
        author_id: 'demo-meera',
        author_login: 'meerarao-ops',
        type: 'decision',
        content: 'Deploy runbook: Payment queue worker autoscaling configuration and dead-letter queue alert triggers.',
        metadata: {
          decision: 'Queue worker autoscaling parameters',
          reason: 'Handle traffic spikes during Black Friday campaigns',
          audience: ['infra']
        },
        visibility: 'team',
        created_at: '2026-11-06T15:00:00Z'
      }
    ],
    tasks: [
      {
        id: 'demo-task-1',
        org_id: 'demo-org',
        title: 'Verify webhook replay protection',
        description: 'Simulate duplicate delivery and test consumer deduplication table. Note: Original due date 10 Nov moved to 15 Nov.',
        assignee_id: 'm-asha',
        assignee_name: 'Asha Patel',
        status: 'open',
        due_at: '2026-11-15',
        created_by: 'Alex Rivera',
        created_at: '2026-11-08T10:00:00Z'
      }
    ],
    handovers: [
      {
        id: 'demo-ho-1',
        org_id: 'demo-org',
        title: 'Payments Core Service Handover (Asha -> Ravi)',
        leaver_id: 'm-asha',
        leaver_name: 'Asha Patel',
        incoming_id: 'm-ravi',
        incoming_name: 'Ravi Kumar',
        status: 'in_review',
        version: 2,
        created_at: '2026-11-10T12:00:00Z',
        summary: 'Architectural handover for the payments processing pipeline, webhook retry queues, and Stripe integration.',
        questions: [
          {
            id: 'q-1',
            prompt: 'Why is branch feat/pay unmerged and 4 commits ahead of main?',
            answer: 'Pending final duplicate delivery verification with Meera before merging.',
            status: 'answered',
            author: 'Alex Rivera'
          },
          {
            id: 'q-2',
            prompt: 'Where are the DLQ alarms and alerting thresholds defined?',
            answer: '',
            status: 'unanswered',
            author: 'Ravi Kumar'
          }
        ],
        claims: [
          {
            id: 'c-1',
            statement: 'All incoming invoice webhooks are deduplicated via a 48-hour Redis TTL cache.',
            status: 'verified',
            source: 'src/payments/queue.ts'
          },
          {
            id: 'c-2',
            statement: 'Stripe signature validation happens client-side before queuing.',
            status: 'verified',
            source: 'PR #12'
          },
          {
            id: 'c-3',
            statement: 'Payment worker autoscaling handles up to 5,000 req/min.',
            status: 'inferred',
            source: 'Deploy Runbook'
          }
        ]
      },
      {
        id: 'demo-ho-v1',
        org_id: 'demo-org',
        title: 'Core Payments Service Handover v1 (Approved & Archived)',
        leaver_id: 'm-asha',
        leaver_name: 'Asha Patel',
        incoming_id: 'm-ravi',
        incoming_name: 'Ravi Kumar',
        status: 'approved',
        version: 1,
        created_at: '2026-11-04T10:00:00Z',
        summary: 'Initial architecture review before the durable retry queue migration.',
        questions: [
          {
            id: 'q-v1',
            prompt: 'What was the previous webhook dispatch architecture?',
            answer: 'Direct synchronous HTTP calls with in-memory timeout retry.',
            status: 'answered',
            author: 'Alex Rivera'
          }
        ],
        claims: [
          {
            id: 'c-v1',
            statement: 'Legacy webhook dispatch used in-process setTimeout retry.',
            status: 'verified',
            source: 'Commit 1234567'
          }
        ]
      }
    ],
    tokens: [
      {
        id: 'demo-tok-1',
        name: 'Demo MCP Stdio Token',
        created_at: '2026-11-05T10:00:00Z'
      }
    ],
    risks: {
      high: [
        'Bus Factor Alert: Only Asha Patel has touched src/payments (100% single maintainer concentration)',
        'Unmerged Ahead Branch: feat/pay is 4 commits ahead with pending webhook logic'
      ],
      medium: [
        'Schedule Discrepancy: Task "Verify replay protection" moved from 10 Nov to 15 Nov'
      ],
      low: [
        'Webhook Idempotency PR #12 has peer review pending'
      ]
    }
  }
}

export function loadDemoState() {
  if (typeof window === 'undefined') return getInitialDemoState()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch (err) {
    console.warn('Failed to load demo state from localStorage:', err)
  }
  const init = getInitialDemoState()
  saveDemoState(init)
  return init
}

export function saveDemoState(state) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (err) {
    console.warn('Failed to save demo state to localStorage:', err)
  }
}

export function resetDemoState() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
  return getInitialDemoState()
}

// Global Fetch Interceptor for /demo-page sandbox
let originalFetch = null
let currentPersona = 'demo-admin'

const PERSONA_PROFILES = {
  'demo-admin': { id: 'demo-admin', name: 'Alex Rivera', email: 'alex.lead@payments.demo', role: 'admin' },
  'demo-asha':  { id: 'demo-asha',  name: 'Asha Patel',  email: 'asha.leaving@payments.demo', role: 'member' },
  'demo-ravi':  { id: 'demo-ravi',  name: 'Ravi Kumar',  email: 'ravi.incoming@payments.demo', role: 'member' },
  'demo-meera': { id: 'demo-meera', name: 'Meera Rao',   email: 'meera.devops@payments.demo', role: 'member' },
}

export function setDemoPersona(personaId) {
  currentPersona = personaId || 'demo-admin'
}

export function installDemoInterceptor(initialPersona = 'demo-admin') {
  if (typeof window === 'undefined') return
  if (originalFetch) return // already installed

  currentPersona = initialPersona
  originalFetch = window.fetch

  window.fetch = async function (input, init = {}) {
    const urlStr = typeof input === 'string' ? input : input?.url || ''
    
    // Only intercept requests directed to /api/ on the current origin
    if (!urlStr.startsWith('/api/') && !urlStr.includes('/api/')) {
      return originalFetch.apply(this, arguments)
    }

    const url = new URL(urlStr, window.location.origin)
    const pathname = url.pathname
    const method = (init.method || 'GET').toUpperCase()

    // 1. Health check
    if (pathname === '/api/health') {
      return new Response(JSON.stringify({
        ok: true,
        configured: { supabase: true, github: true, demo: true }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }

    // 2. /api/me (Current authenticated actor)
    if (pathname === '/api/me') {
      const p = PERSONA_PROFILES[currentPersona] || PERSONA_PROFILES['demo-admin']
      return new Response(JSON.stringify({
        user: { id: p.id, name: p.name, email: p.email },
        organizations: [
          { id: 'demo-org', name: 'Payments Team · DEMO', role: p.role }
        ]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }

    const state = loadDemoState()

    // 3. /api/orgs/:orgId/state
    if (pathname.match(/^\/api\/orgs\/[^/]+\/state$/)) {
      return new Response(JSON.stringify({
        organization: state.organization,
        members: state.members,
        repositories: state.repositories,
        sources: state.sources,
        tasks: state.tasks,
        handovers: state.handovers,
        tokens: state.tokens
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }

    // 4. /api/orgs/:orgId/risks
    if (pathname.match(/^\/api\/orgs\/[^/]+\/risks$/)) {
      return new Response(JSON.stringify(state.risks), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // 5. /api/handovers/:id (Handover detail)
    const hoMatch = pathname.match(/^\/api\/handovers\/([^/]+)$/)
    if (hoMatch && method === 'GET') {
      const ho = state.handovers.find(h => h.id === hoMatch[1]) || state.handovers[0]
      return new Response(JSON.stringify(ho), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // 6. Answer question: /api/handovers/:id/answers
    if (pathname.match(/^\/api\/handovers\/[^/]+\/answers$/) && method === 'POST') {
      let body = {}
      try { body = JSON.parse(init.body || '{}') } catch (e) {}
      const ho = state.handovers[0]
      if (ho && ho.questions) {
        const q = ho.questions.find(item => item.id === body.questionId)
        if (q) {
          q.answer = body.answer || 'Answer recorded.'
          q.status = 'answered'
          saveDemoState(state)
        }
      }
      return new Response(JSON.stringify(ho), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // 7. Approve handover: /api/handovers/:id/approve
    if (pathname.match(/^\/api\/handovers\/[^/]+\/approve$/) && method === 'POST') {
      const ho = state.handovers[0]
      if (ho) {
        ho.status = 'approved'
        saveDemoState(state)
      }
      return new Response(JSON.stringify(ho), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // 7b. Acknowledge handover: /api/handovers/:id/acknowledge
    if (pathname.match(/^\/api\/handovers\/[^/]+\/acknowledge$/) && method === 'POST') {
      const ho = state.handovers[0]
      if (ho) {
        ho.status = 'acknowledged'
        saveDemoState(state)
      }
      return new Response(JSON.stringify(ho), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // 7c. Generate/Synthesize handover: /api/handovers/:id/generate
    if (pathname.match(/^\/api\/handovers\/[^/]+\/generate$/) && method === 'POST') {
      const ho = state.handovers[0]
      if (ho) {
        ho.version = (ho.version || 1) + 1
        saveDemoState(state)
      }
      return new Response(JSON.stringify(ho), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // 7d. Start Handover: /api/orgs/:orgId/handovers
    if (pathname.match(/^\/api\/orgs\/[^/]+\/handovers$/) && method === 'POST') {
      let body = {}
      try { body = JSON.parse(init.body || '{}') } catch (e) {}
      const newHo = {
        id: `demo-ho-${Date.now()}`,
        org_id: 'demo-org',
        title: `Payments Handover (${PERSONA_PROFILES[body.leaver_id]?.name || 'Asha'} -> ${PERSONA_PROFILES[body.incoming_id]?.name || 'Ravi'})`,
        leaver_id: body.leaver_id || 'demo-asha',
        leaver_name: PERSONA_PROFILES[body.leaver_id]?.name || 'Asha Patel',
        incoming_id: body.incoming_id || 'demo-ravi',
        incoming_name: PERSONA_PROFILES[body.incoming_id]?.name || 'Ravi Kumar',
        status: 'draft',
        version: 1,
        created_at: new Date().toISOString(),
        summary: 'New architectural handover session initialized.',
        questions: [
          {
            id: `q-${Date.now()}`,
            prompt: 'Explain unmerged commits on feat/pay branch before departure.',
            answer: '',
            status: 'unanswered',
            author: 'Alex Rivera'
          }
        ],
        claims: []
      }
      state.handovers.unshift(newHo)
      saveDemoState(state)
      return new Response(JSON.stringify({ handover: newHo }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // 8. Ask Handover Q&A: /api/handovers/:id/ask
    if (pathname.match(/^\/api\/handovers\/[^/]+\/ask$/) && method === 'POST') {
      let body = {}
      try { body = JSON.parse(init.body || '{}') } catch (e) {}
      const q = (body.question || '').toLowerCase()
      let answer = 'All webhook processing is wrapped with idempotency keys and exponential backoff retry logic.'
      let citations = ['src/payments/queue.ts:L42-L88', 'PR #12']

      if (q.includes('unmerged') || q.includes('branch') || q.includes('ahead')) {
        answer = 'Branch feat/pay is 4 commits ahead of main containing Stripe signature verification. Pending final synthetic duplicate delivery verification before merging.'
        citations = ['PR #12: feat/pay', 'Asha Patel exit interview notes']
      } else if (q.includes('date') || q.includes('when') || q.includes('launch')) {
        answer = 'Payments launch task was rescheduled from 10 Nov to 15 Nov to allow full testing of queue recovery.'
        citations = ['Task: Verify webhook replay protection', 'Commit 7a8f9c1']
      } else if (q.includes('alarm') || q.includes('dlq') || q.includes('infra')) {
        answer = 'Dead-letter queue alarms and worker autoscaling limits are defined in the Deploy Runbook (handled by Meera Rao).'
        citations = ['Deploy Runbook: Queue Worker Autoscaling', 'AWS SQS Alarm tf-queue-dlq']
      }

      return new Response(JSON.stringify({
        answer,
        citations,
        confidence: 'high',
        evidence_mode: 'deterministic_grounded'
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }

    // 9. Memory creation in simulator or modal
    if (pathname.match(/^\/api\/orgs\/[^/]+\/sources$/) && method === 'POST') {
      let body = {}
      try { body = JSON.parse(init.body || '{}') } catch (e) {}
      const newSource = {
        id: `s-live-${Date.now()}`,
        org_id: 'demo-org',
        author_id: currentPersona,
        author_login: PERSONA_PROFILES[currentPersona]?.name || 'Demo User',
        type: body.type || 'decision',
        content: body.content || '',
        metadata: body.metadata || {},
        visibility: body.visibility || 'team',
        created_at: new Date().toISOString()
      }
      state.sources.unshift(newSource)
      saveDemoState(state)
      return new Response(JSON.stringify({ success: true, memory: newSource }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // 10. Tasks creation & update
    if (pathname.match(/^\/api\/orgs\/[^/]+\/tasks$/) && method === 'POST') {
      let body = {}
      try { body = JSON.parse(init.body || '{}') } catch (e) {}
      const newTask = {
        id: `task-${Date.now()}`,
        org_id: 'demo-org',
        title: body.title || 'New Task',
        description: body.description || '',
        assignee_id: body.assignee_id || 'm-asha',
        assignee_name: 'Asha Patel',
        status: 'open',
        due_at: body.due_at || '2026-11-20',
        created_by: PERSONA_PROFILES[currentPersona]?.name || 'Alex Rivera',
        created_at: new Date().toISOString()
      }
      state.tasks.unshift(newTask)
      saveDemoState(state)
      return new Response(JSON.stringify({ task: newTask }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (pathname.match(/^\/api\/tasks\/[^/]+$/) && method === 'PATCH') {
      let body = {}
      try { body = JSON.parse(init.body || '{}') } catch (e) {}
      const t = state.tasks[0]
      if (t) {
        if (body.status) t.status = body.status
        saveDemoState(state)
      }
      return new Response(JSON.stringify({ task: t }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Pass through any other unexpected calls
    return originalFetch.apply(this, arguments)
  }
}

export function uninstallDemoInterceptor() {
  if (typeof window !== 'undefined' && originalFetch) {
    window.fetch = originalFetch
    originalFetch = null
  }
}

