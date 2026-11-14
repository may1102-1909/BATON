import React, { useEffect, useState } from 'react';
import * as api from '../lib/api.js';

const OUTCOME_MESSAGES = {
  expired: 'That GitHub sign-in link expired or was already used. Click "Connect GitHub" to try again.',
  already_linked: 'This GitHub account or member is already linked to a different account. Disconnect it first.',
  not_member: 'You need to be an active member of this team to link GitHub.',
  not_configured: 'GitHub is not fully configured on the server. Check the GitHub and TOKEN_ENCRYPTION_KEY settings.',
  exchange_failed: 'GitHub rejected the sign-in. Check that the client ID and client secret belong to the same GitHub App.',
  failed: 'GitHub could not be linked. Check the server log for the "[github callback]" line.',
};

/**
 * Three-step GitHub connection: link the account, choose an installation, choose a repository.
 * `outcome` is the result of the OAuth redirect: { status: 'linked' | 'error', reason }.
 */
export function GithubConnect({ orgId, installUrl, outcome, onConnected }) {
  const [phase, setPhase] = useState('loading'); // loading | unlinked | linked | error
  const [installations, setInstallations] = useState([]);
  const [installationId, setInstallationId] = useState('');
  const [repos, setRepos] = useState([]);
  const [repoName, setRepoName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null); // { tone: 'ok' | 'error', text }

  async function loadInstallations() {
    if (!orgId) return;
    setPhase('loading');
    try {
      const list = await api.getGithubInstallations(orgId);
      setInstallations(list);
      setInstallationId(list.length ? String(list[0].id) : '');
      setPhase('linked');
    } catch (err) {
      if (err.status === 409) {
        setPhase('unlinked');
        if (/expired/i.test(err.message)) setMessage({ tone: 'error', text: err.message });
      } else {
        setPhase('error');
        setMessage({ tone: 'error', text: err.message });
      }
    }
  }

  useEffect(() => { loadInstallations(); }, [orgId]);

  useEffect(() => {
    if (outcome?.status === 'linked') setMessage({ tone: 'ok', text: 'GitHub account linked. Now choose a repository to connect.' });
    if (outcome?.status === 'error') setMessage({ tone: 'error', text: OUTCOME_MESSAGES[outcome.reason] ?? OUTCOME_MESSAGES.failed });
  }, [outcome]);

  useEffect(() => {
    if (!orgId || !installationId) { setRepos([]); setRepoName(''); return; }
    let cancelled = false;
    api.getGithubInstallationRepos(orgId, installationId)
      .then(list => { if (!cancelled) { setRepos(list); setRepoName(list[0]?.full_name ?? ''); } })
      .catch(err => { if (!cancelled) { setRepos([]); setRepoName(''); setMessage({ tone: 'error', text: err.message }); } });
    return () => { cancelled = true; };
  }, [orgId, installationId]);

  async function startLink() {
    setBusy(true);
    try {
      const res = await api.getGithubConnectUrl(orgId);
      if (res?.url) window.location.href = res.url;
      else setMessage({ tone: 'error', text: 'The server did not return a GitHub sign-in link.' });
    } catch (err) {
      setMessage({ tone: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function connect() {
    if (!installationId || !repoName) return;
    setBusy(true);
    try {
      await api.connectRepo(orgId, installationId, repoName);
      setMessage({ tone: 'ok', text: `${repoName} connected. Click "Sync Now" to import its commits and pull requests.` });
      onConnected?.();
    } catch (err) {
      setMessage({ tone: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {message && (
        <div
          role="status"
          style={{
            border: `1px solid ${message.tone === 'ok' ? 'var(--green)' : '#f59e0b'}`,
            borderRadius: 6, padding: '10px 12px', fontSize: '0.85rem', color: '#fff',
          }}
        >
          {message.tone === 'ok' ? 'Done: ' : 'Problem: '}{message.text}
        </div>
      )}

      {phase === 'loading' && <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Checking GitHub link…</div>}

      {phase === 'unlinked' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Step 1 of 2: link your GitHub account.</span>
          <button className="ws-btn ws-btn-primary ws-btn-sm" disabled={busy} onClick={startLink}>Connect GitHub</button>
        </div>
      )}

      {phase === 'error' && (
        <button className="ws-btn ws-btn-sm" onClick={loadInstallations} style={{ alignSelf: 'flex-start' }}>Try again</button>
      )}

      {phase === 'linked' && installations.length === 0 && (
        <div style={{ fontSize: '0.85rem', color: 'var(--muted)', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <span>Your GitHub account is linked, but the BATON GitHub App is not installed on any account or repository you can access.</span>
          {installUrl && <a className="ws-btn ws-btn-primary ws-btn-sm" href={installUrl} target="_blank" rel="noreferrer">Install the GitHub App</a>}
          <button className="ws-btn ws-btn-sm" onClick={loadInstallations}>Refresh</button>
        </div>
      )}

      {phase === 'linked' && installations.length > 0 && (
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.8rem', color: 'var(--muted)' }}>
            GitHub account
            <select className="ws-input" value={installationId} onChange={e => setInstallationId(e.target.value)}>
              {installations.map(item => (
                <option key={item.id} value={String(item.id)}>{item.account?.login ?? `Installation ${item.id}`}</option>
              ))}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.8rem', color: 'var(--muted)' }}>
            Repository
            <select className="ws-input" value={repoName} onChange={e => setRepoName(e.target.value)} disabled={!repos.length}>
              {repos.length === 0 && <option value="">No repositories available</option>}
              {repos.map(repo => <option key={repo.full_name} value={repo.full_name}>{repo.full_name}</option>)}
            </select>
          </label>
          <button className="ws-btn ws-btn-primary ws-btn-sm" disabled={busy || !repoName} onClick={connect}>Connect repository</button>
          {installUrl && <a href={installUrl} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Add more repositories</a>}
        </div>
      )}
    </div>
  );
}

export default GithubConnect;
