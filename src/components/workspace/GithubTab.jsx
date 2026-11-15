import React, { useState } from 'react';
import * as api from '../../lib/api.js';
import { GithubConnect } from '../GithubConnect';
import { ConfirmDialog, Modal } from './Modal';

const formatDate = value => (value ? new Date(value).toLocaleString() : 'Never');
// Demo: the GitHub account is already connected; the popup offers a sync until one has run in this visit.
let demoSyncedThisVisit = false;

export function GithubTab({ orgId, isDemo, isAdmin, health, outcome, repositories, sources, notify, onRefresh }) {
  const [syncingId, setSyncingId] = useState(null);
  const [disconnecting, setDisconnecting] = useState(null); // repository awaiting confirmation
  const [disconnectBusy, setDisconnectBusy] = useState(false);
  const [repoFilter, setRepoFilter] = useState('all');
  const [connectedDismissed, setConnectedDismissed] = useState(false);
  const showConnected = isDemo && !demoSyncedThisVisit && !connectedDismissed && repositories.length > 0;
  const setShowConnected = open => setConnectedDismissed(!open);

  const repoName = id => repositories.find(repo => repo.id === id)?.full_name;
  const evidence = sources
    .filter(s => s.type === 'commit' || s.type === 'pull_request')
    .filter(s => repoFilter === 'all' || s.repository_id === repoFilter);

  async function syncRepo(repo) {
    setSyncingId(repo.id);
    try {
      const res = await api.syncRepo(orgId, repo.id);
      const counts = `${res?.commits ?? 0} commits, ${res?.pullRequests ?? 0} pull requests, ${res?.issues ?? 0} issues`;
      const large = res?.truncated ? " Only the most recent history was imported because the repository is large." : "";
      if (res?.skipped) notify(`${repo.full_name} synced (${counts}), but ${res.skipped} record${res.skipped === 1 ? " was" : "s were"} skipped: ${res.skippedReason}${large}`);
      else notify(`${repo.full_name} synced: ${counts}.${large}`, "success");
      if (isDemo) demoSyncedThisVisit = true;
      await onRefresh();
    } catch (err) {
      notify(`Sync failed for ${repo.full_name}: ${err.message}`);
    } finally {
      setSyncingId(null);
    }
  }

  async function disconnect() {
    const repo = disconnecting;
    if (!repo) return;
    setDisconnectBusy(true);
    try {
      const res = await api.disconnectRepo(orgId, repo.id);
      setDisconnecting(null);
      if (repoFilter === repo.id) setRepoFilter('all');
      await onRefresh();
      notify(`${repo.full_name} disconnected. ${res?.removed_sources ?? 0} synced records removed.`, 'success');
    } catch (err) {
      notify(`Disconnect failed: ${err.message}`);
    } finally {
      setDisconnectBusy(false);
    }
  }

  return (
    <div>
      <section className="ws-card" aria-labelledby="ws-gh-title">
        <div className="ws-card-header">
          <h2 id="ws-gh-title" className="ws-card-title">Connected GitHub repositories</h2>
          <span className="ws-badge ws-badge-muted">{repositories.length} connected</span>
        </div>

        {repositories.length === 0 ? (
          <div className="ws-empty-state">
            <div className="ws-empty-icon" aria-hidden="true">🐙</div>
            <div className="ws-empty-title">No repositories linked yet</div>
            <div>{isAdmin || isDemo ? 'Connect a repository below to sync its pull requests and commits.' : 'Ask a workspace admin to connect a repository.'}</div>
          </div>
        ) : (
          <ul className="ws-repo-list">
            {repositories.map(repo => (
              <li key={repo.id} className="ws-repo-row">
                <div>
                  <div className="ws-repo-name">{repo.full_name}</div>
                  <div className="ws-muted">
                    {repo.installation_id ? `Installation #${repo.installation_id} · ` : ''}Last synced: {formatDate(repo.last_synced_at)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="ws-btn ws-btn-sm" disabled={syncingId !== null} onClick={() => syncRepo(repo)} aria-label={`Sync ${repo.full_name} now`}>
                    {syncingId === repo.id ? 'Syncing…' : '↻ Sync now'}
                  </button>
                  {isAdmin && !isDemo && (
                    <button type="button" className="ws-btn ws-btn-sm ws-btn-danger" disabled={syncingId === repo.id} onClick={() => setDisconnecting(repo)} aria-label={`Disconnect ${repo.full_name}`}>
                      Disconnect
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {(isAdmin || isDemo) && (
          <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
            <GithubConnect
              orgId={orgId}
              installUrl={health?.githubInstallUrl}
              outcome={outcome}
              connectedNames={repositories.map(repo => repo.full_name)}
              onConnected={onRefresh}
              ownOnly={!isDemo}
            />
          </div>
        )}
      </section>

      <section className="ws-card" aria-labelledby="ws-gh-feed-title">
        <div className="ws-card-header">
          <h2 id="ws-gh-feed-title" className="ws-card-title">Git and pull request evidence</h2>
          {repositories.length > 1 && (
            <select className="ws-org-select" aria-label="Filter evidence by repository" value={repoFilter} onChange={e => setRepoFilter(e.target.value)}>
              <option value="all">All repositories</option>
              {repositories.map(repo => <option key={repo.id} value={repo.id}>{repo.full_name}</option>)}
            </select>
          )}
        </div>

        {evidence.length === 0 ? (
          <div className="ws-muted">
            {repositories.length === 0
              ? 'Connect a repository to see its commits and pull requests here.'
              : 'No commits or pull requests synced yet. Click “Sync now” on a connected repository.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {evidence.map(s => (
              <div key={s.id} className="ws-evidence-row">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, gap: 8, flexWrap: 'wrap' }}>
                  <span className={`ws-badge ${s.type === 'pull_request' ? 'ws-badge-verified' : 'ws-badge-muted'}`}>
                    {s.type === 'pull_request' ? `PR #${s.metadata?.number || ''}` : 'Commit'}
                  </span>
                  <span className="ws-muted" style={{ fontSize: '0.75rem' }}>
                    {repositories.length > 1 && repoName(s.repository_id) ? `${repoName(s.repository_id)} · ` : ''}{new Date(s.created_at).toLocaleString()}
                  </span>
                </div>
                <div style={{ color: '#fff', fontWeight: 500 }}>{s.content}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {showConnected && repositories[0] && (
        <Modal title="GitHub account connected" onClose={() => setShowConnected(false)}>
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 14px', display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.88rem' }}>
            <li><span style={{ color: 'var(--green)' }}>✓</span> Signed in to GitHub as <strong>@{repositories[0].full_name.split('/')[0]}</strong></li>
            <li><span style={{ color: 'var(--green)' }}>✓</span> Baton GitHub App installed on <strong>{repositories.map(repo => repo.full_name).join(', ')}</strong></li>
            <li><span style={{ color: 'var(--green)' }}>✓</span> Last synced: {formatDate(repositories[0].last_synced_at)}</li>
          </ul>
          <div className="ws-muted" style={{ marginBottom: 16 }}>
            Sync the repository now to pull its latest commits and pull requests from GitHub. The handover export is rebuilt from whatever is synced.
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="ws-btn" onClick={() => setShowConnected(false)}>Later</button>
            <button
              type="button"
              className="ws-btn ws-btn-primary"
              onClick={() => { setShowConnected(false); syncRepo(repositories[0]); }}
            >
              ↻ Sync repository now
            </button>
          </div>
        </Modal>
      )}

      {disconnecting && (
        <ConfirmDialog
          title={`Disconnect ${disconnecting.full_name}?`}
          confirmLabel="Disconnect repository"
          busy={disconnectBusy}
          onConfirm={disconnect}
          onCancel={() => setDisconnecting(null)}
        >
          This stops syncing <strong>{disconnecting.full_name}</strong> and removes the commits, pull requests and branches
          that were synced from it. You can connect it again and sync later to re-import them.
        </ConfirmDialog>
      )}
    </div>
  );
}

export default GithubTab;
