import React, { useState } from 'react';
import { redactData } from '../../../server/redact.js';

const TOOLS = [
  { id: 'log_decision', label: 'log_decision', help: 'What an agent calls after choosing a library, pattern or design.' },
  { id: 'log_blocker', label: 'log_blocker', help: 'What an agent calls when it leaves something broken or half done.' },
  { id: 'get_context', label: 'get_context', help: 'What an agent calls before refactoring, to recall earlier decisions.' },
];

const mask = token => (token ? `${token.slice(0, 10)}…${token.slice(-4)}` : '');

/**
 * Demo only: runs the exact HTTP calls the Baton MCP server makes (POST /api/collector/push, GET /api/collector/search),
 * authenticated with the MCP token generated above, against this browser's demo workspace.
 */
export function DemoMcpConsole({ orgId, repositories, token, sample, onNeedToken, onCaptured }) {
  const [tool, setTool] = useState('log_decision');
  const [decision, setDecision] = useState(sample?.decision ?? '');
  const [reason, setReason] = useState(sample?.reason ?? '');
  const [problem, setProblem] = useState('Webhook replay protection is untested after the queue change');
  const [status, setStatus] = useState('active');
  const [notes, setNotes] = useState('Keep the new queue behind its feature flag until replay tests pass.');
  const [query, setQuery] = useState('webhook queue decision');
  const [running, setRunning] = useState(false);
  const [exchange, setExchange] = useState(null);
  const repositoryId = repositories[0]?.id ?? null;

  async function run(e) {
    e.preventDefault();
    if (!token || running) return;
    setRunning(true);
    setExchange(null);
    const session = `demo-session-${Date.now()}`;
    let request;
    if (tool === 'get_context') {
      const params = new URLSearchParams({ q: query, org_id: orgId, ...(repositoryId ? { repository_id: repositoryId } : {}) });
      request = { method: 'GET', path: `/api/collector/search?${params}` };
    } else {
      // The MCP server redacts tool input on the developer's machine before anything is sent.
      const data = redactData(tool === 'log_decision'
        ? { decision, reason, alternatives: [], files_affected: [] }
        : { problem, status, workaround_notes: notes });
      request = {
        method: 'POST', path: '/api/collector/push',
        body: { type: tool === 'log_decision' ? 'decision' : 'blocker', data, timestamp: new Date().toISOString(), source: 'baton-mcp-server', org_id: orgId, repository_id: repositoryId, session_id: session, event_id: `${session}-1` },
      };
    }
    try {
      const res = await fetch(request.path, {
        method: request.method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        ...(request.body ? { body: JSON.stringify(request.body) } : {}),
      });
      const body = await res.json().catch(() => ({}));
      setExchange({ request, status: res.status, body });
      if (res.ok && tool !== 'get_context') onCaptured?.();
    } catch (err) {
      setExchange({ request, status: 0, body: { error: err.message } });
    } finally {
      setRunning(false);
    }
  }

  const stored = exchange?.body?.memory;
  const hits = Array.isArray(exchange?.body?.data) ? exchange.body.data : Array.isArray(exchange?.body?.results) ? exchange.body.results : null;

  return (
    <div style={{ marginTop: 24, background: '#0e1115', border: '1px solid #252b36', borderRadius: 8, padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: '0.92rem', fontWeight: 600, color: '#fff' }}>Try the MCP tools here</div>
          <div className="ws-muted" style={{ marginTop: 2, maxWidth: 640 }}>
            These are the same authenticated requests the Baton MCP server sends when an agent calls a tool. They run against this demo
            workspace with the token you generated. Demo tokens live only in this browser; for a real agent, switch to Production,
            generate a token there and paste the configuration above into your client.
          </div>
        </div>
        <span className="ws-badge ws-badge-verified">{token ? `Token ${mask(token)}` : 'No token yet'}</span>
      </div>

      {!token ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span className="ws-muted">Step 1: generate an MCP token. The configuration above fills in with it.</span>
          <button type="button" className="ws-btn ws-btn-primary ws-btn-sm" onClick={onNeedToken}>+ Generate MCP Token</button>
        </div>
      ) : (
        <form onSubmit={run} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div role="group" aria-label="MCP tool" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {TOOLS.map(item => (
              <button key={item.id} type="button" aria-pressed={tool === item.id} className={`ws-client-btn ${tool === item.id ? 'active' : ''}`} onClick={() => { setTool(item.id); setExchange(null); }}>
                {item.label}
              </button>
            ))}
          </div>
          <div className="ws-muted" style={{ fontSize: '0.78rem' }}>{TOOLS.find(item => item.id === tool)?.help}</div>

          {tool === 'log_decision' && (
            <>
              <label className="ws-form-label" htmlFor="mcp-decision">decision</label>
              <input id="mcp-decision" className="ws-input" value={decision} onChange={e => setDecision(e.target.value)} required />
              <label className="ws-form-label" htmlFor="mcp-reason">reason (contains a made-up key to show redaction)</label>
              <textarea id="mcp-reason" className="ws-input" rows={2} value={reason} onChange={e => setReason(e.target.value)} />
            </>
          )}
          {tool === 'log_blocker' && (
            <>
              <label className="ws-form-label" htmlFor="mcp-problem">problem</label>
              <input id="mcp-problem" className="ws-input" value={problem} onChange={e => setProblem(e.target.value)} required />
              <label className="ws-form-label" htmlFor="mcp-status">status</label>
              <select id="mcp-status" className="ws-org-select" value={status} onChange={e => setStatus(e.target.value)}>
                {['active', 'investigating', 'blocked', 'workaround_applied', 'resolved'].map(value => <option key={value} value={value}>{value}</option>)}
              </select>
              <label className="ws-form-label" htmlFor="mcp-notes">workaround_notes</label>
              <input id="mcp-notes" className="ws-input" value={notes} onChange={e => setNotes(e.target.value)} />
            </>
          )}
          {tool === 'get_context' && (
            <>
              <label className="ws-form-label" htmlFor="mcp-query">query</label>
              <input id="mcp-query" className="ws-input" value={query} onChange={e => setQuery(e.target.value)} required />
            </>
          )}

          <div>
            <button type="submit" className="ws-btn ws-btn-primary ws-btn-sm" disabled={running}>
              {running ? 'Calling…' : `Run ${tool}`}
            </button>
          </div>
        </form>
      )}

      {exchange && (
        <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
          <div className="ws-code-snippet">
            <div className="ws-muted" style={{ marginBottom: 4 }}>Request sent by the MCP server (Authorization: Bearer {mask(token)})</div>
            <pre style={{ margin: 0, fontSize: '0.76rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {`${exchange.request.method} ${exchange.request.path}${exchange.request.body ? `\n${JSON.stringify(exchange.request.body, null, 2)}` : ''}`}
            </pre>
          </div>
          <div className="ws-code-snippet">
            <div className="ws-muted" style={{ marginBottom: 4 }}>Response {exchange.status}</div>
            {stored ? (
              <div style={{ fontSize: '0.82rem', color: '#d1fae5' }}>
                Saved as memory <code>{stored.id}</code>{exchange.body.deduplicated ? ' (duplicate event, not stored twice)' : ''}. Stored text:
                <pre style={{ margin: '6px 0 0', fontSize: '0.76rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#e5e7eb' }}>{String(stored.content).slice(0, 600)}</pre>
                <div className="ws-muted" style={{ marginTop: 6 }}>Secrets are replaced before storage. The record now shows in Memory &amp; Decisions and feeds future handovers.</div>
              </div>
            ) : hits ? (
              <div style={{ fontSize: '0.82rem' }}>
                {hits.length === 0 ? 'No matching memory.' : hits.slice(0, 5).map(hit => (
                  <div key={hit.id} style={{ marginBottom: 6, color: '#e5e7eb' }}>
                    <span className="ws-badge ws-badge-muted">{hit.type}</span> {String(hit.content ?? hit.summary ?? '').split('\n')[0].slice(0, 160)}
                  </div>
                ))}
              </div>
            ) : (
              <pre style={{ margin: 0, fontSize: '0.76rem', whiteSpace: 'pre-wrap', color: '#fca5a5' }}>{JSON.stringify(exchange.body, null, 2).slice(0, 800)}</pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default DemoMcpConsole;
