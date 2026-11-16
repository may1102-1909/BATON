import React from 'react';
import { ANTIGRAVITY_SESSION } from '../../pages/demoSandbox.js';

const box = { background: '#0e1115', border: '1px solid #252b36', borderRadius: 8, padding: 14 };
const label = { fontSize: '0.8rem', fontWeight: 600, color: 'var(--muted)', margin: '0 0 8px' };
const code = { fontFamily: 'var(--mono)', fontSize: '0.78rem', color: '#e5e7eb' };

// Demo only: shows the Antigravity IDE connected to baton-mcp-server and the memory its tool calls stored.
export function DemoAntigravityLink({ tokens, sources, onNeedToken }) {
  const connected = tokens.some(t => !t.revoked_at);
  const memories = sources.filter(s => s.metadata?.mcp_client === ANTIGRAVITY_SESSION.client);
  const at = memories[0]?.created_at ? new Date(memories[0].created_at).toLocaleTimeString() : '';

  return (
    <div className="ws-card" data-testid="antigravity-link">
      <div className="ws-card-header">
        <h2 className="ws-card-title">Antigravity IDE ⇄ Baton MCP server</h2>
        <span className={`ws-badge ${connected ? 'ws-badge-verified' : 'ws-badge-muted'}`}>{connected ? 'Connected' : 'Not connected'}</span>
      </div>
      <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: 14 }}>
        Antigravity runs <span style={code}>baton-mcp-server</span> from <span style={code}>{ANTIGRAVITY_SESSION.config_path}</span> with your MCP token.
        Its <span style={code}>sync_history</span> tool keeps a memory of the conversation, and <span style={code}>save_memory</span> stores what was decided.
        The handover is built from that memory together with the GitHub history.
      </div>

      {!connected ? (
        <div className="ws-muted">
          Generate an MCP token to connect Antigravity.{' '}
          <button type="button" className="ws-btn ws-btn-sm" onClick={onNeedToken}>Generate token</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={box}>
            <div style={label}>Conversation memory · session {ANTIGRAVITY_SESSION.session_id}</div>
            {ANTIGRAVITY_SESSION.turns.map(turn => (
              <div key={turn.index} style={{ fontSize: '0.8rem', color: '#d1d5db', marginBottom: 6 }}>
                <span className="ws-badge ws-badge-muted">{turn.role} #{turn.index}</span> {turn.content}
              </div>
            ))}
          </div>
          <div style={box}>
            <div style={label}>Tool calls from Antigravity{at ? ` · ${at}` : ''}</div>
            <div style={{ ...code, marginBottom: 6 }}>→ sync_history() · {ANTIGRAVITY_SESSION.turns.length} conversation turns read</div>
            {memories.length === 0 ? (
              <div className="ws-muted">No memory stored yet.</div>
            ) : memories.map(m => (
              <div key={m.id} style={{ fontSize: '0.8rem', color: '#d1d5db', marginBottom: 6 }}>
                <span style={code}>→ save_memory()</span>{' '}
                <span className={`ws-badge ${m.type === 'blocker' ? 'ws-badge-danger' : 'ws-badge-verified'}`}>{m.type}</span>{' '}
                {m.metadata?.decision || m.metadata?.problem || m.content}
                <span style={{ color: 'var(--muted)' }}> · from turns {(m.metadata?.source_turns || []).join(', ')}</span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
            These records are cited as “[Antigravity · MCP]” in the Handovers tab next to commits and pull requests. The browser demo replays the session; a live IDE connects through <span style={code}>npm run baton -- init</span> against production.
          </div>
        </div>
      )}
    </div>
  );
}
