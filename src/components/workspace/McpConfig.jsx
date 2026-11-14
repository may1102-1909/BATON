import React, { useState } from 'react';
import { copyText } from '../../lib/download.js';

const MCP_PACKAGE_SOURCE = 'github:may1102-1909/BATON';

const CLIENTS = [
  { id: 'baton_init', label: 'baton init (recommended)', tip: 'Run inside the repository Baton should remember. Writes git-ignored configs for Claude Code (.mcp.json), Antigravity (.agents/mcp_config.json) and Cursor, plus the git and Claude Code hooks.' },
  { id: 'cursor', label: 'Cursor (.cursor/mcp.json)', tip: 'Paste into your project root as .cursor/mcp.json or in Cursor Settings → MCP → Add New Server.' },
  { id: 'claude_desktop', label: 'Claude Desktop', tip: 'Paste into claude_desktop_config.json (Claude Settings → Developer → Edit Config).' },
  { id: 'claude_cli', label: 'Claude Code (CLI)', tip: 'Paste this single command into your terminal.' },
  { id: 'antigravity', label: 'Antigravity', tip: 'Paste into .agents/mcp_config.json in your workspace (or ~/.gemini/config/mcp_config.json for every project), then refresh MCP servers with /mcp.' },
  { id: 'local_node', label: 'Local clone (node)', tip: 'For developers working directly inside a clone of the BATON repository.' },
];

function buildSnippet(tab, { orgId, repoId, apiKey }) {
  const env = { BATON_API_URL: window.location.origin, BATON_API_KEY: apiKey, BATON_ORG_ID: orgId, BATON_REPOSITORY_ID: repoId };
  if (tab === 'baton_init') {
    return `npx -y ${MCP_PACKAGE_SOURCE} baton init --api-url ${env.BATON_API_URL} --org ${orgId} --repo ${repoId} --key ${apiKey}`;
  }
  if (tab === 'claude_cli') {
    const flags = Object.entries(env).map(([k, v]) => `-e ${k}="${v}"`).join(' ');
    return `claude mcp add baton -s user ${flags} -- npx -y ${MCP_PACKAGE_SOURCE} baton-mcp`;
  }
  if (tab === 'local_node') {
    return JSON.stringify({ mcpServers: { baton: { command: 'node', args: ['mcp-server/dist/index.js'], env } } }, null, 2);
  }
  return JSON.stringify({ mcpServers: { baton: { command: 'npx', args: ['-y', MCP_PACKAGE_SOURCE, 'baton-mcp'], env } } }, null, 2);
}

/** Client configuration snippet for one repository the user picks (not silently the first). */
export function McpConfig({ orgId, repositories, tokens, revealedToken, notify, children }) {
  const [client, setClient] = useState('cursor');
  const [repoId, setRepoId] = useState('');
  const [copied, setCopied] = useState(false);

  const selectedRepoId = repositories.some(repo => repo.id === repoId) ? repoId : repositories[0]?.id;
  const apiKey = revealedToken || (tokens[0]?.name ? `<TOKEN_FOR_${tokens[0].name.toUpperCase()}>` : '<GENERATE_A_TOKEN_ABOVE>');
  const snippet = orgId && selectedRepoId ? buildSnippet(client, { orgId, repoId: selectedRepoId, apiKey }) : null;
  const current = CLIENTS.find(item => item.id === client);

  async function copy() {
    if (!snippet) return;
    if (await copyText(snippet)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      notify('Could not copy to the clipboard. Select the configuration text and copy it manually.');
    }
  }

  return (
    <div style={{ marginTop: 24, borderTop: '1px solid var(--line)', paddingTop: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#fff', margin: 0 }}>MCP client configuration</h3>
          <div className="ws-muted" style={{ marginTop: 2 }}>
            Connect Baton over stdio with npx, without cloning the repository.
          </div>
        </div>
        <button type="button" className="ws-btn ws-btn-primary ws-btn-sm" disabled={!snippet} onClick={copy}>
          {copied ? '✓ Copied' : 'Copy configuration'}
        </button>
      </div>

      {repositories.length > 1 && (
        <div className="ws-form-group" style={{ maxWidth: 360 }}>
          <label className="ws-form-label" htmlFor="ws-mcp-repo">Repository this configuration captures into</label>
          <select id="ws-mcp-repo" className="ws-org-select" value={selectedRepoId || ''} onChange={e => setRepoId(e.target.value)}>
            {repositories.map(repo => <option key={repo.id} value={repo.id}>{repo.full_name}</option>)}
          </select>
        </div>
      )}

      <div role="group" aria-label="MCP client" style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {CLIENTS.map(item => (
          <button
            key={item.id}
            type="button"
            aria-pressed={client === item.id}
            className={`ws-client-btn ${client === item.id ? 'active' : ''}`}
            onClick={() => setClient(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="ws-code-snippet">
        <pre style={{ margin: 0, overflowX: 'auto', fontSize: '0.82rem', lineHeight: 1.6 }} tabIndex={0} aria-label="MCP configuration">
          {snippet || 'Connect a repository first (GitHub tab) to generate an MCP configuration.'}
        </pre>
      </div>
      {snippet && <div className="ws-muted" style={{ marginTop: 8, fontFamily: 'monospace', fontSize: '0.76rem' }}>{current?.tip}</div>}

      {children}
    </div>
  );
}

export default McpConfig;
