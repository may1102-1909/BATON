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

const labelStyle = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.8rem', color: 'var(--muted)' };

/**
 * Connect a GitHub repository: link the account, choose an installation and repository, or enter owner/repo.
 * Can be used repeatedly to connect more repositories, including from other accounts or organizations.
 * `outcome` is the result of the OAuth redirect: { status: 'linked' | 'error', reason }.
 */
export function GithubConnect({ orgId, installUrl, outcome, connectedNames = [], onConnected, ownOnly = false }) {
  const [phase, setPhase] = useState('loading'); // loading | unlinked | linked | error
  const [installations, setInstallations] = useState([]);
  const [installationId, setInstallationId] = useState('');
  const [repos, setRepos] = useState([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [repoName, setRepoName] = useState('');
  const [manualName, setManualName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null); // { tone: 'ok' | 'error', text, installUrl? }
  const [linkedLogin, setLinkedLogin] = useState('');

  const hasRepos = connectedNames.length > 0;
  const connected = new Set(connectedNames.map(name => name.toLowerCase()));
  const available = repos.filter(repo => !connected.has(String(repo.full_name).toLowerCase()));
  // GitHub also lists other people's personal accounts the user merely collaborates on; the dashboard offers
  // only the user's own account and organizations. Waits for the login so nothing flickers in or out.
  const visible = !ownOnly || !linkedLogin ? installations
    : installations.filter(item => item.account?.type !== 'User' || String(item.account?.login).toLowerCase() === linkedLogin.toLowerCase());

  useEffect(() => {
    if (!ownOnly) return;
    setInstallationId(cur => (visible.some(item => String(item.id) === cur) ? cur : visible.length ? String(visible[0].id) : ''));
  }, [ownOnly, linkedLogin, installations]);

  async function loadInstallations() {
    if (!orgId) return;
    setPhase('loading');
    try {
      const list = await api.getGithubInstallations(orgId);
      setInstallations(list);
      setInstallationId(cur => (list.some(item => String(item.id) === cur) ? cur : list.length ? String(list[0].id) : ''));
      const account = ownOnly ? await api.getGithubAccount(orgId).catch(() => null) : null;
      if (ownOnly) setLinkedLogin(account?.account?.login ?? '');
      setPhase('linked');
      if (!ownOnly) api.getGithubAccount(orgId).then(res => setLinkedLogin(res?.account?.login ?? '')).catch(() => setLinkedLogin(''));
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

  // Coming back from GitHub's install page in another tab: pick up the new installation.
  useEffect(() => {
    if (phase !== 'linked' || visible.length) return undefined;
    const onFocus = () => loadInstallations();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [phase, visible.length, orgId]);

  useEffect(() => {
    if (outcome?.status === 'linked') setMessage({ tone: 'ok', text: 'GitHub account linked. Now choose a repository to connect.' });
    if (outcome?.status === 'error') setMessage({ tone: 'error', text: OUTCOME_MESSAGES[outcome.reason] ?? OUTCOME_MESSAGES.failed });
  }, [outcome]);

  useEffect(() => {
    if (!orgId || !installationId) { setRepos([]); return undefined; }
    let cancelled = false;
    setReposLoading(true);
    api.getGithubInstallationRepos(orgId, installationId)
      .then(list => { if (!cancelled) setRepos(list); })
      .catch(err => { if (!cancelled) { setRepos([]); setMessage({ tone: 'error', text: err.message }); } })
      .finally(() => { if (!cancelled) setReposLoading(false); });
    return () => { cancelled = true; };
  }, [orgId, installationId]);

  useEffect(() => {
    setRepoName(cur => (available.some(repo => repo.full_name === cur) ? cur : available[0]?.full_name ?? ''));
  }, [repos, connectedNames.join('|')]);

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

  async function switchAccount() {
    setBusy(true);
    try {
      await api.unlinkGithubAccount(orgId);
      setLinkedLogin('');
      setInstallations([]);
      await startLink();
    } catch (err) {
      setMessage({ tone: 'error', text: err.message });
      setBusy(false);
    }
  }

  async function connect(fullName, withInstallation) {
    if (!fullName) return false;
    setBusy(true);
    try {
      await api.connectRepo(orgId, withInstallation ? installationId : null, fullName);
      setMessage({ tone: 'ok', text: `${fullName} connected. Click "Sync now" on it to import its commits and pull requests.` });
      onConnected?.();
      return true;
    } catch (err) {
      setMessage({ tone: 'error', text: err.message, installUrl: api.installUrlFromError(err) || installUrl });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function connectManual(event) {
    event.preventDefault();
    const name = manualName.trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '').replace(/\/+$/, '');
    if (!/^[\w.-]+\/[\w.-]+$/.test(name)) {
      setMessage({ tone: 'error', text: 'Enter the repository as owner/name, for example octocat/hello-world.' });
      return;
    }
    if (await connect(name, false)) setManualName('');
  }

  return (
    <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {message && (
        <div
          role={message.tone === 'ok' ? 'status' : 'alert'}
          style={{
            border: `1px solid ${message.tone === 'ok' ? 'var(--green)' : '#f59e0b'}`,
            borderRadius: 6, padding: '10px 12px', fontSize: '0.85rem', color: '#fff',
            display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between',
          }}
        >
          <span>{message.tone === 'ok' ? 'Done: ' : 'Problem: '}{message.text}</span>
          <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {message.installUrl && (
              <a className="ws-btn ws-btn-primary ws-btn-sm" href={message.installUrl} target="_blank" rel="noreferrer">Install the GitHub App</a>
            )}
            <button type="button" className="ws-notice-close" aria-label="Dismiss message" onClick={() => setMessage(null)}>✕</button>
          </span>
        </div>
      )}

      <div style={{ fontWeight: 600, color: '#fff', fontSize: '0.95rem' }}>
        {hasRepos ? 'Connect another repository' : 'Connect a repository'}
      </div>

      {phase === 'loading' && <div role="status" style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Checking GitHub link…</div>}

      {phase === 'unlinked' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Step 1 of 2: sign in with your GitHub account. GitHub lets you choose which account to use.</span>
          <button type="button" className="ws-btn ws-btn-primary ws-btn-sm" disabled={busy} onClick={startLink}>{busy ? 'Opening GitHub…' : 'Connect GitHub'}</button>
        </div>
      )}

      {phase === 'error' && (
        <button type="button" className="ws-btn ws-btn-sm" onClick={loadInstallations} style={{ alignSelf: 'flex-start' }}>Try again</button>
      )}

      {phase === 'linked' && linkedLogin && (
        <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
          Signed in to GitHub as <strong style={{ color: '#fff' }}>@{linkedLogin}</strong>. Not you?{' '}
          <button type="button" className="ws-btn ws-btn-sm" onClick={switchAccount} disabled={busy}>Use a different GitHub account</button>
        </div>
      )}

      {phase === 'linked' && visible.length === 0 && (
        <div style={{ fontSize: '0.85rem', color: 'var(--muted)', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <span>Step 2 of 2: install the Baton GitHub App on your account and choose which repositories it can read.</span>
          {installUrl && <a className="ws-btn ws-btn-primary ws-btn-sm" href={installUrl} target="_blank" rel="noreferrer">Install on GitHub</a>}
          <button type="button" className="ws-btn ws-btn-sm" onClick={loadInstallations}>I've installed it</button>
        </div>
      )}

      {phase === 'linked' && visible.length > 0 && (
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <label style={labelStyle}>
            GitHub account
            <select className="ws-input" value={installationId} onChange={e => setInstallationId(e.target.value)} disabled={busy}>
              {visible.map(item => (
                <option key={item.id} value={String(item.id)}>{item.account?.login ?? `Installation ${item.id}`}</option>
              ))}
            </select>
          </label>
          <label style={labelStyle}>
            Repository
            <select className="ws-input" value={repoName} onChange={e => setRepoName(e.target.value)} disabled={busy || reposLoading || !available.length}>
              {reposLoading && <option value="">Loading repositories…</option>}
              {!reposLoading && available.length === 0 && <option value="">{repos.length ? 'All repositories here are connected' : 'No repositories available'}</option>}
              {available.map(repo => <option key={repo.full_name} value={repo.full_name}>{repo.full_name}</option>)}
            </select>
          </label>
          <button type="button" className="ws-btn ws-btn-primary ws-btn-sm" disabled={busy || reposLoading || !repoName} onClick={() => connect(repoName, true)}>
            {busy ? 'Connecting…' : 'Connect repository'}
          </button>
        </div>
      )}

      {(phase === 'linked' || phase === 'unlinked') && (
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--muted)' }}>
          {installUrl && !(phase === 'linked' && visible.length === 0) && <a href={installUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--green)' }}>Install the app on more repositories or accounts</a>}
          {phase === 'linked' && (
            <button type="button" className="ws-btn ws-btn-sm" onClick={loadInstallations} disabled={busy}>Refresh list</button>
          )}
          {phase === 'linked' && !linkedLogin && (
            <button type="button" className="ws-btn ws-btn-sm" onClick={switchAccount} disabled={busy}>Use a different GitHub account</button>
          )}
        </div>
      )}

      {phase === 'linked' && (
        <form onSubmit={connectManual} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <label style={labelStyle}>
            Or enter owner/repo (any repository the app is installed on)
            <input className="ws-input" style={{ minWidth: 280 }} placeholder="owner/repository" value={manualName} onChange={e => setManualName(e.target.value)} disabled={busy} />
          </label>
          <button type="submit" className="ws-btn ws-btn-sm" disabled={busy || !manualName.trim()}>{busy ? 'Connecting…' : 'Connect by name'}</button>
        </form>
      )}
    </div>
  );
}

export default GithubConnect;
