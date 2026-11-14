import React from 'react';

const formatDate = value => (value ? new Date(value).toLocaleString() : null);

/** Status derived from /api/health and the workspace state; nothing here is a fixed claim. */
export function SystemStatus({ health, isDemo, repositories, tokens }) {
  const lastSync = repositories.map(repo => repo.last_synced_at).filter(Boolean).sort().pop();
  const cards = [
    {
      label: 'API',
      value: health?.ok ? 'Online' : 'Unreachable',
      tone: health?.ok ? 'ok' : 'warn',
    },
    {
      label: 'Data store',
      value: isDemo
        ? 'Demo sandbox (sample data, kept in this browser)'
        : !health
          ? 'Unknown'
          : health.configured?.supabase ? 'Supabase configured' : 'Not configured (in-memory, not persisted)',
      tone: isDemo || health?.configured?.supabase ? 'ok' : 'warn',
    },
    {
      label: 'GitHub App',
      value: !health ? 'Unknown' : health.configured?.github ? 'Configured' : 'Not configured',
      detail: `${repositories.length} ${repositories.length === 1 ? 'repository' : 'repositories'} connected` + (lastSync ? ` · last sync ${formatDate(lastSync)}` : ''),
      tone: health?.configured?.github ? 'ok' : 'warn',
    },
    {
      label: 'MCP access',
      value: tokens.length ? `${tokens.length} active ${tokens.length === 1 ? 'token' : 'tokens'}` : 'No tokens yet',
      tone: tokens.length ? 'ok' : 'warn',
    },
  ];

  return (
    <section className="ws-card" aria-labelledby="ws-system-title">
      <div className="ws-card-header">
        <h2 id="ws-system-title" className="ws-card-title">System status</h2>
      </div>
      <div className="ws-grid-4">
        {cards.map(card => (
          <div key={card.label} className="ws-status-tile">
            <div className="ws-muted" style={{ marginBottom: 4 }}>{card.label}</div>
            <div style={{ fontWeight: 600, color: card.tone === 'ok' ? 'var(--green)' : '#f59e0b' }}>{card.value}</div>
            {card.detail && <div className="ws-muted" style={{ marginTop: 4, fontSize: '0.78rem' }}>{card.detail}</div>}
          </div>
        ))}
      </div>
    </section>
  );
}

export default SystemStatus;
