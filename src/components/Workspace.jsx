import React, { useState, useEffect, useRef } from 'react';
import { Brand } from './Brand';
import * as api from '../lib/api.js';
import { Citations, ClaimsView, ConflictsPanel, ContributionMatrix, RiskBadge, VersionHistory } from './HandoverParts';
import { HandoverPage } from '../pages/HandoverPage';
import { FUNCTION_ROLES } from '../../server/audience.js';
import { downloadText, slugify } from '../lib/download.js';
import { inviteErrorMessage, parseInviteToken } from '../lib/invite.js';
import { ConfirmDialog } from './workspace/Modal';
import { CreateOrgModal, InviteModal, MemoryModal, StartHandoverModal, TaskModal, TokenModal } from './workspace/Modals';
import { SettingsCard } from './workspace/SettingsCard';
import { OnboardingChecklist, buildChecklist } from './workspace/OnboardingChecklist';
import { GithubTab } from './workspace/GithubTab';
import { McpConfig } from './workspace/McpConfig';
import { SystemStatus } from './workspace/SystemStatus';
import './workspace.css';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'memory', label: 'Memory & Decisions' },
  { id: 'github', label: 'GitHub' },
  { id: 'team', label: 'Team & Tokens' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'handovers', label: 'Handovers' },
];

export function Workspace({
  onSignOut,
  onBack,
  mode = 'production',
  inviteResult,
  demoPersonas = [],
  demoPersona,
  onDemoPersonaChange,
  demoSimulatorSample,
}) {
  const isDemo = mode === 'demo';
  const [showAllAlerts, setShowAllAlerts] = useState(false);
  const [health, setHealth] = useState(null);
  const [me, setMe] = useState(null);
  const [orgs, setOrgs] = useState([]);
  const [selectedOrgId, setSelectedOrgId] = useState(null);
  const [orgState, setOrgState] = useState(null);
  const [orgError, setOrgError] = useState(null);
  const [risks, setRisks] = useState(null);
  const [riskRepoId, setRiskRepoId] = useState('all');
  const [activeTab, setActiveTab] = useState('overview');
  const [githubOutcome, setGithubOutcome] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [inviteToken, setInviteToken] = useState('');
  const [busy, setBusy] = useState({});
  const busyRef = useRef({});
  const preferredOrgRef = useRef(inviteResult?.status === 'accepted' ? inviteResult.organizationId : null);

  // Modals & form states (each modal owns its own form fields)
  const [showCreateOrgModal, setShowCreateOrgModal] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [newestToken, setNewestToken] = useState(null);
  const [showMemoryModal, setShowMemoryModal] = useState(false);
  const [memoryFilter, setMemoryFilter] = useState('all');
  const [memorySearch, setMemorySearch] = useState('');
  const [confirming, setConfirming] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  // Tasks state
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [activeTaskIdForComments, setActiveTaskIdForComments] = useState(null);
  const [newCommentText, setNewCommentText] = useState('');

  // Handover state
  const [showStartHandoverModal, setShowStartHandoverModal] = useState(false);
  const [handoverLeaverId, setHandoverLeaverId] = useState('');
  const [activeHandoverDetail, setActiveHandoverDetail] = useState(null);
  const [loadingHandoverId, setLoadingHandoverId] = useState(null);
  const [answeringQuestionId, setAnsweringQuestionId] = useState(null);
  const [answerText, setAnswerText] = useState('');
  const [qaQuestion, setQaQuestion] = useState('');
  const [qaResult, setQaResult] = useState(null);
  const [qaLoading, setQaLoading] = useState(false);
  const [packetId, setPacketId] = useState(null);

  // Demo-only MCP simulator state
  const [simDecisionText, setSimDecisionText] = useState(demoSimulatorSample?.decision ?? '');
  const [simReasonText, setSimReasonText] = useState(demoSimulatorSample?.reason ?? '');
  const [simRunning, setSimRunning] = useState(false);
  const [simResult, setSimResult] = useState(null);

  function notify(message, kind = 'error') {
    setNotice({ message: String(message), kind });
  }

  const isBusy = key => Boolean(busy[key]);

  // Runs one request per key at a time and exposes its pending state to the UI.
  async function runBusy(key, task) {
    if (busyRef.current[key]) return undefined;
    busyRef.current[key] = true;
    setBusy(cur => ({ ...cur, [key]: true }));
    try {
      return await task();
    } finally {
      delete busyRef.current[key];
      setBusy(cur => {
        const next = { ...cur };
        delete next[key];
        return next;
      });
    }
  }

  useEffect(() => {
    if (notice?.kind !== 'success') return undefined;
    const timer = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (inviteResult?.status === 'accepted') notify('Invite accepted. You joined the team.', 'success');
    if (inviteResult?.status === 'error') notify(inviteResult.message);
  }, []);

  const handleSimulateMcp = async () => {
    if (!selectedOrgId || simRunning || !simDecisionText.trim()) return;
    setSimRunning(true);
    setSimResult(null);
    try {
      const secretPattern = /(eyJ[a-zA-Z0-9_\-.]+|[a-zA-Z0-9_]{20,})/;
      const detectedSecret = simDecisionText.match(secretPattern)?.[0] || null;
      const cleanDecision = simDecisionText.replace(secretPattern, '[REDACTED: API_KEY]');

      const res = await api.createMemory(selectedOrgId, {
        type: 'decision',
        content: `Decision: ${cleanDecision}\nReason: ${simReasonText}`,
        metadata: {
          decision: cleanDecision,
          reason: simReasonText,
          source: 'mcp-live-simulator',
          redaction_applied: Boolean(detectedSecret),
          original_quarantined: Boolean(detectedSecret)
        },
        repository_id: repositories[0]?.id || null,
        visibility: 'team'
      });

      setSimResult({
        success: true,
        detectedSecret,
        cleanDecision,
        memory: res.memory
      });
      refreshOrgState(selectedOrgId);
    } catch (err) {
      setSimResult({ success: false, error: err.message });
    } finally {
      setSimRunning(false);
    }
  };

  // Initial boot (re-runs when the demo persona changes)
  useEffect(() => {
    boot();
  }, [demoPersona]);

  async function boot(preferredId) {
    setLoading(true);
    setError(null);
    try {
      if (isDemo && demoPersona) api.setDemoUser(demoPersona);
      const h = await api.fetchHealth().catch(() => null);
      setHealth(h);

      let meData;
      try {
        meData = await api.fetchMe();
      } catch (err) {
        setError(err.status === 401 ? 'Your session has expired. Sign out and sign in again.' : `Could not load your account: ${err.message}`);
        return;
      }
      setMe(meData);
      const orgList = meData.organizations || [];
      setOrgs(orgList);
      const wanted = preferredId || preferredOrgRef.current;
      preferredOrgRef.current = null;
      if (orgList.length > 0) {
        setSelectedOrgId(cur => {
          if (wanted && orgList.some(o => o.id === wanted)) return wanted;
          return orgList.some(o => o.id === cur) ? cur : orgList[0].id;
        });
      } else {
        setSelectedOrgId(null);
        setOrgState(null);
        setRisks(null);
      }
    } catch (err) {
      setError(err.message || 'Failed to initialize session');
    } finally {
      setLoading(false);
    }
  }

  // Returning from the GitHub sign-in redirect: open the GitHub tab and show the result.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('github');
    if (!status) return;
    setGithubOutcome({ status, reason: params.get('reason') });
    setActiveTab('github');
    window.history.replaceState(null, '', window.location.pathname);
  }, []);

  // Load org state when selectedOrgId changes
  useEffect(() => {
    setActiveHandoverDetail(null);
    setPacketId(null);
    setNewestToken(null);
    setRiskRepoId('all');
    if (!selectedOrgId) return;
    refreshOrgState(selectedOrgId);
  }, [selectedOrgId, demoPersona]);

  async function refreshOrgState(orgId) {
    try {
      const state = await api.fetchOrgState(orgId);
      setOrgState(state);
      setOrgError(null);
      const r = await api.fetchRisks(orgId).catch(() => null);
      setRisks(r);
    } catch (err) {
      setOrgError(err.message || 'Failed to load workspace data');
    }
  }

  async function handleCreateOrg(e) {
    e.preventDefault();
    if (!newOrgName.trim()) return;
    await runBusy('createOrg', async () => {
      try {
        const res = await api.createOrg(newOrgName.trim());
        setNewOrgName('');
        await boot(res?.organization?.id);
        notify('Team created.', 'success');
      } catch (err) {
        notify(err.message);
      }
    });
  }

  async function handleAcceptInvite(e) {
    e.preventDefault();
    const token = parseInviteToken(inviteToken);
    if (!token) return;
    await runBusy('join', async () => {
      try {
        const res = await api.acceptInvite(token);
        setInviteToken('');
        await boot(res?.organization_id);
        notify('Invite accepted.', 'success');
      } catch (err) {
        notify(inviteErrorMessage(err));
      }
    });
  }

  function handleDeleteToken(token) {
    if (!selectedOrgId) return;
    setConfirming({
      title: 'Revoke MCP token?',
      confirmLabel: 'Revoke token',
      body: <>Any MCP client using <strong>{token.name}</strong> will stop working immediately.</>,
      run: () => runBusy(`token:${token.id}`, async () => {
        await api.deleteToken(selectedOrgId, token.id);
        await refreshOrgState(selectedOrgId);
        notify('Token revoked.', 'success');
      }),
    });
  }

  function handleToggleOffboarding(member) {
    if (!selectedOrgId) return Promise.resolve();
    return runBusy(`member:${member.id}`, async () => {
      try {
        await api.updateMember(selectedOrgId, member.id, { offboarding: !member.offboarding });
        await refreshOrgState(selectedOrgId);
      } catch (err) {
        notify(err.message);
      }
    });
  }

  function handleDeleteMemory(memoryId) {
    if (!selectedOrgId) return;
    setConfirming({
      title: 'Delete this memory record?',
      confirmLabel: 'Delete record',
      body: 'The record is removed from this workspace and from future handover evidence.',
      run: () => runBusy(`memory:${memoryId}`, async () => {
        await api.deleteMemory(selectedOrgId, memoryId);
        await refreshOrgState(selectedOrgId);
        notify('Record deleted.', 'success');
      }),
    });
  }

  function handleUpdateTaskStatus(taskId, status) {
    return runBusy(`task:${taskId}`, async () => {
      try {
        await api.updateTask(taskId, { status });
        await refreshOrgState(selectedOrgId);
      } catch (err) {
        notify(err.message);
      }
    });
  }

  async function handleAddTaskComment(e, taskId) {
    e.preventDefault();
    if (!newCommentText.trim()) return;
    await runBusy(`comment:${taskId}`, async () => {
      try {
        await api.createTaskComment(taskId, newCommentText.trim());
        setNewCommentText('');
        await refreshOrgState(selectedOrgId);
      } catch (err) {
        notify(err.message);
      }
    });
  }

  // Handover actions
  async function loadHandover(id) {
    setLoadingHandoverId(id);
    try {
      const detail = await api.getHandover(id);
      setActiveHandoverDetail(detail);
    } catch (err) {
      notify(`Failed to load handover: ${err.message}`);
    } finally {
      setLoadingHandoverId(null);
    }
  }

  // Run a handover action, then reload the full detail the server returns from GET.
  async function runHandoverAction(action, successMessage) {
    const id = activeHandoverDetail?.handover?.id;
    if (!id) return false;
    const ok = await runBusy('handover', async () => {
      try {
        await action(id);
        await loadHandover(id);
        refreshOrgState(selectedOrgId);
        if (successMessage) notify(successMessage, 'success');
        return true;
      } catch (err) {
        notify(err.message);
        return false;
      }
    });
    return Boolean(ok);
  }

  async function handleAnswerQuestion(e, questionId) {
    e.preventDefault();
    if (!answerText.trim()) return;
    const ok = await runHandoverAction(id => api.answerQuestion(id, questionId, answerText.trim()));
    if (ok) {
      setAnsweringQuestionId(null);
      setAnswerText('');
    }
  }

  const handleGenerateHandover = () => runHandoverAction(id => api.generateHandover(id), 'Claims compiled.');
  const handleClaimReview = (claimId, status) => runHandoverAction(id => api.updateClaim(id, claimId, { status }));
  const handleSkipQuestion = questionId => runHandoverAction(id => api.skipQuestion(id, questionId));
  const handleResolveConflict = (claimId, body) => runHandoverAction(id => api.resolveConflict(id, claimId, body), 'Conflict resolved.');

  async function handleEditClaim(claimId, text) {
    const id = activeHandoverDetail?.handover?.id;
    if (!id) return false;
    try {
      await api.updateClaim(id, claimId, { status: 'edited', text });
      await loadHandover(id);
      return true;
    } catch (err) {
      notify(err.message);
      return false;
    }
  }

  function handleSetFunctionRole(member, value) {
    return runBusy(`role:${member.id}`, async () => {
      try {
        await api.updateMember(selectedOrgId, member.id, { function_role: value || null });
        await refreshOrgState(selectedOrgId);
      } catch (err) {
        notify(err.message);
      }
    });
  }

  function startHandoverFor(leaverUserId) {
    setHandoverLeaverId(leaverUserId || '');
    setShowStartHandoverModal(true);
  }
  const handleApproveHandover = () => runHandoverAction(id => api.approveHandover(id), 'Handover approved.');
  const handleAcknowledgeHandover = () => runHandoverAction(id => api.acknowledgeHandover(id), 'Handover acknowledged.');

  function handleExportHandover() {
    const handover = activeHandoverDetail?.handover;
    if (!handover) return Promise.resolve();
    return runBusy('export', async () => {
      try {
        const markdown = await api.exportHandoverMarkdown(handover.id);
        const from = slugify(memberLabel(handover.leaver_id), 'leaver');
        const to = slugify(memberLabel(handover.incoming_id), 'incoming');
        downloadText(`handover-${from}-to-${to}.md`, typeof markdown === 'string' ? markdown : JSON.stringify(markdown, null, 2));
        notify('Markdown exported.', 'success');
      } catch (err) {
        notify(`Export failed: ${err.message}`);
      }
    });
  }

  async function handleAskQuestion(e) {
    e.preventDefault();
    if (!activeHandoverDetail?.handover?.id || !qaQuestion.trim()) return;
    setQaLoading(true);
    setQaResult(null);
    try {
      const res = await api.askHandover(activeHandoverDetail.handover.id, qaQuestion.trim());
      setQaResult(res);
    } catch (err) {
      setQaResult({ answer: `Error: ${err.message}`, citations: [] });
    } finally {
      setQaLoading(false);
    }
  }

  function onTabKeyDown(event) {
    const keys = { ArrowRight: 1, ArrowLeft: -1 };
    const index = TABS.findIndex(tab => tab.id === activeTab);
    let next = null;
    if (event.key in keys) next = (index + keys[event.key] + TABS.length) % TABS.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = TABS.length - 1;
    if (next === null) return;
    event.preventDefault();
    setActiveTab(TABS[next].id);
    document.getElementById(`ws-tab-${TABS[next].id}`)?.focus();
  }

  if (loading && !orgState) {
    return (
      <div className="ws-container" role="status" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <style>{`
          @keyframes batonLoaderGlow {
            0% { opacity: 0.65; transform: scale(0.97); }
            50% { opacity: 1; transform: scale(1.03); }
            100% { opacity: 0.65; transform: scale(0.97); }
          }
        `}</style>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{ animation: 'batonLoaderGlow 2.4s ease-in-out infinite' }}>
            <Brand size={32} iconOnly />
          </div>
          <div style={{ color: 'var(--muted)', fontSize: '0.9rem', letterSpacing: '0.02em' }}>Loading Baton workspace…</div>
        </div>
      </div>
    );
  }

  const sources = orgState?.sources || [];
  const members = orgState?.members || [];
  const repositories = orgState?.repositories || [];
  const tasks = orgState?.tasks || [];
  const handovers = orgState?.handovers || [];
  const tokens = orgState?.tokens || [];

  const hv = activeHandoverDetail?.handover;
  const myUserId = me?.user?.id;
  const selectedOrg = orgs.find(o => o.id === selectedOrgId);
  const isAdmin = selectedOrg?.role === 'admin';
  const riskAlerts = Array.isArray(risks?.alerts) ? risks.alerts : [];
  const hiddenRiskCount = risks?.hidden_count ?? 0;
  const openConflicts = (activeHandoverDetail?.claims || []).filter(c => c.conflict && !c.conflict.resolved && c.status !== 'rejected').length;
  const hasGithubData = repositories.length > 0 || sources.some(s => s.type === 'commit' || s.type === 'pull_request');
  const memberLabel = id => {
    const m = members.find(item => item.user_id === id);
    return m?.name || m?.github_login || id || 'Unknown';
  };
  const activePersona = demoPersonas.find(p => p.id === demoPersona);
  const userLabel = isDemo
    ? `${activePersona ? `${activePersona.name} (${activePersona.role})` : 'Demo visitor'} · demo`
    : me?.user?.email || me?.user?.name || 'Signed in';
  const riskItems = Array.isArray(risks?.risks) ? risks.risks : [];
  const riskCounts = risks?.counts || {};
  const busFactor = Array.isArray(risks?.bus_factor) ? risks.bus_factor : risks?.bus_factor ? [risks.bus_factor] : [];
  const sourceRepo = new Map(sources.map(s => [s.id, s.repository_id]));
  const visibleRiskItems = riskRepoId === 'all'
    ? riskItems
    : riskItems.filter(r => (r.source_ids || []).some(id => sourceRepo.get(id) === riskRepoId));
  const visibleBusFactor = riskRepoId === 'all' ? busFactor : busFactor.filter(b => b.repository_id === riskRepoId);
  const checklistItems = buildChecklist({ members, repositories, tokens, sources, handovers });

  const noticeBar = notice && (
    <div
      className={`ws-notice ws-notice-${notice.kind}`}
      role={notice.kind === 'error' ? 'alert' : 'status'}
    >
      <span>{notice.message}</span>
      <button type="button" className="ws-notice-close" aria-label="Dismiss message" onClick={() => setNotice(null)}>✕</button>
    </div>
  );

  const noOrgs = orgs.length === 0 && !selectedOrgId;

  const decisionsCount = sources.filter(s => s.type === 'decision').length;
  const blockersCount = sources.filter(s => s.type === 'blocker').length;
  const commitsCount = sources.filter(s => s.type === 'commit' || s.type === 'pull_request').length;
  const tabCounts = { memory: sources.length, github: repositories.length, team: members.length, tasks: tasks.length, handovers: handovers.length };

  // Filtered sources
  const filteredSources = sources.filter(s => {
    if (memoryFilter !== 'all' && s.type !== memoryFilter) return false;
    if (memorySearch) {
      const q = memorySearch.toLowerCase();
      const contentMatch = s.content?.toLowerCase().includes(q);
      const metaMatch = JSON.stringify(s.metadata || {}).toLowerCase().includes(q);
      return contentMatch || metaMatch;
    }
    return true;
  });

  return (
    <div className="ws-container">
      {!isDemo && <h1 className="sr-only">Baton workspace{selectedOrg ? `: ${selectedOrg.name}` : ''}</h1>}
      {/* Top Header */}
      <header className="ws-header">
        <div className="ws-header-left">
          <button type="button" className="ws-logo-wrap" aria-label="Home" onClick={onBack}>
            <Brand size={20} />
          </button>

          {orgs.length > 0 && (
            <select
              className="ws-org-select"
              aria-label="Organization"
              value={selectedOrgId || ''}
              onChange={e => setSelectedOrgId(e.target.value)}
            >
              {orgs.map(o => (
                <option key={o.id} value={o.id}>
                  {o.name} {o.role ? `(${o.role})` : ''}
                </option>
              ))}
            </select>
          )}

          <button type="button" className="ws-btn ws-btn-sm" aria-label="Create organization" onClick={() => setShowCreateOrgModal(true)}>
            + Org
          </button>
        </div>

        <div className="ws-header-right">
          {isDemo && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="ws-demo-badge">Demo Mode</span>
              {demoPersonas.length > 0 && (
                <select
                  className="ws-org-select"
                  aria-label="Switch demo persona"
                  style={{ fontSize: '0.75rem', padding: '3px 8px' }}
                  value={demoPersona || ''}
                  onChange={e => onDemoPersonaChange?.(e.target.value)}
                  title="Switch demo persona"
                >
                  {demoPersonas.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.role})</option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div className="ws-user-badge">
            <span aria-hidden="true" style={{ color: 'var(--green)', fontWeight: 600 }}>●</span>
            <span>{userLabel}</span>
          </div>

          {onSignOut && (
            <button type="button" className="ws-btn ws-btn-sm" onClick={onSignOut}>
              Sign Out
            </button>
          )}
          {onBack && (
            <button type="button" className="ws-btn ws-btn-sm" onClick={onBack}>
              Home
            </button>
          )}
        </div>
      </header>

      {noticeBar}

      {error && (
        <div className="ws-notice ws-notice-error" role="alert">
          <span>{error}</span>
          <button type="button" className="ws-btn ws-btn-sm" onClick={() => boot()} disabled={loading}>Retry</button>
        </div>
      )}

      {orgError && (
        <div className="ws-notice ws-notice-error" role="alert">
          <span>Could not load workspace data: {orgError}</span>
          <button type="button" className="ws-btn ws-btn-sm" onClick={() => refreshOrgState(selectedOrgId)}>Retry</button>
        </div>
      )}

      {/* Navigation Tabs */}
      {!noOrgs && !packetId && (
      <div className="ws-nav-tabs" role="tablist" aria-label="Workspace sections" onKeyDown={onTabKeyDown}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`ws-tab-${tab.id}`}
            aria-selected={activeTab === tab.id}
            aria-controls="ws-panel"
            tabIndex={activeTab === tab.id ? 0 : -1}
            className={`ws-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {tabCounts[tab.id] !== undefined && <span className="ws-tab-count">{tabCounts[tab.id]}</span>}
          </button>
        ))}
      </div>
      )}

      {noOrgs && (
        <main id="main" className="ws-main">
          <div className="ws-card ws-empty-state">
            <div className="ws-empty-icon">👥</div>
            <div className="ws-empty-title">You are not part of a team yet</div>
            <div style={{ marginBottom: 20 }}>Create a team, or join one with an invite link from your admin.</div>
            <div style={{ display: 'flex', gap: 24, justifyContent: 'center', flexWrap: 'wrap' }}>
              <form onSubmit={handleCreateOrg} style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 260 }}>
                <label className="ws-form-label" htmlFor="ws-create-team">Create a team</label>
                <input
                  id="ws-create-team"
                  type="text"
                  className="ws-input"
                  placeholder="Team name"
                  value={newOrgName}
                  onChange={e => setNewOrgName(e.target.value)}
                  maxLength={120}
                  required
                />
                <button type="submit" className="ws-btn ws-btn-primary" disabled={isBusy("createOrg") || !newOrgName.trim()}>{isBusy("createOrg") ? "Creating…" : "Create a team"}</button>
              </form>
              <form onSubmit={handleAcceptInvite} style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 260 }}>
                <label className="ws-form-label" htmlFor="ws-join-invite">Join with invite</label>
                <input
                  id="ws-join-invite"
                  type="text"
                  className="ws-input"
                  placeholder="Paste an invite link or token"
                  value={inviteToken}
                  onChange={e => setInviteToken(e.target.value)}
                  required
                />
                <button type="submit" className="ws-btn" disabled={isBusy("join") || !inviteToken.trim()}>{isBusy("join") ? "Joining…" : "Join with invite"}</button>
              </form>
            </div>
          </div>
        </main>
      )}

      {/* Main Workspace Body */}
      {!noOrgs && !packetId && (
      <main id="main" className="ws-main">
        <div role="tabpanel" id="ws-panel" aria-labelledby={`ws-tab-${activeTab}`}>
        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div>
            {!isDemo && (
              <OnboardingChecklist orgId={selectedOrgId} items={checklistItems} onGo={setActiveTab} />
            )}

            {riskAlerts.length > 0 && (
              <section className="ws-alert-list" aria-label="Bus factor alerts">
                {(showAllAlerts ? riskAlerts : riskAlerts.slice(0, 3)).map(alert => (
                  <div key={alert.module} className="ws-alert">
                    <span>
                      <strong>Bus factor alert · {alert.module}:</strong> {alert.message}
                    </span>
                    {isAdmin && (
                      <button
                        type="button"
                        className="ws-btn ws-btn-sm ws-btn-danger"
                        aria-label={`Start handover for ${alert.sole_contributor?.name || 'contributor'} (${alert.module})`}
                        onClick={() => startHandoverFor(alert.sole_contributor?.id)}
                      >
                        Start handover
                      </button>
                    )}
                  </div>
                ))}
                {riskAlerts.length > 3 && (
                  <button type="button" className="ws-btn ws-btn-sm" aria-expanded={showAllAlerts} onClick={() => setShowAllAlerts(value => !value)}>
                    {showAllAlerts ? "Show fewer alerts" : `Show all ${riskAlerts.length} alerts`}
                  </button>
                )}
              </section>
            )}

            {!hasGithubData && (
              <div className="ws-card ws-empty-state">
                <div className="ws-empty-title">No GitHub data yet</div>
                <div style={{ marginBottom: 14 }}>Connect a GitHub repository to see who owns which modules and where the bus-factor risks are.</div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button type="button" className="ws-btn ws-btn-primary" onClick={() => setActiveTab('github')}>Connect GitHub</button>
                </div>
              </div>
            )}

            {/* Quick Metrics */}
            <div className="ws-grid-4" style={{ marginBottom: 24 }}>
              <div className="ws-stat-card">
                <span className="ws-stat-label">Architectural Decisions</span>
                <span className="ws-stat-val" style={{ color: 'var(--green)' }}>{decisionsCount}</span>
              </div>
              <div className="ws-stat-card">
                <span className="ws-stat-label">Active Blockers</span>
                <span className="ws-stat-val" style={{ color: blockersCount > 0 ? '#ef4444' : '#fff' }}>{blockersCount}</span>
              </div>
              <div className="ws-stat-card">
                <span className="ws-stat-label">Git Commits / PRs</span>
                <span className="ws-stat-val">{commitsCount}</span>
              </div>
              <div className="ws-stat-card">
                <span className="ws-stat-label">Active Handovers</span>
                <span className="ws-stat-val" style={{ color: handovers.length > 0 ? '#f59e0b' : '#fff' }}>{handovers.length}</span>
              </div>
            </div>

            {/* Risk Assessment Cards */}
            <div className="ws-card">
              <div className="ws-card-header">
                <h2 className="ws-card-title">Architectural risk assessment</h2>
                {repositories.length > 1 && (
                  <select className="ws-org-select" aria-label="Repository for risk details" value={riskRepoId} onChange={e => setRiskRepoId(e.target.value)}>
                    <option value="all">All repositories</option>
                    {repositories.map(repo => <option key={repo.id} value={repo.id}>{repo.full_name}</option>)}
                  </select>
                )}
              </div>

              {risks ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <span className="ws-badge ws-badge-danger">
                      Active blockers: {riskCounts.active_blockers ?? 0}
                    </span>
                    <span className="ws-badge ws-badge-inferred">
                      Open PRs: {riskCounts.open_pull_requests ?? 0}
                    </span>
                    <span className="ws-badge ws-badge-inferred">
                      Branches ahead: {riskCounts.branches_ahead ?? 0}
                    </span>
                    <span className="ws-badge ws-badge-muted">
                      Source records: {riskCounts.source_records ?? 0}
                    </span>
                  </div>

                  {visibleRiskItems.length > 0 ? (
                    <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: 6, padding: 14 }}>
                      <div style={{ fontWeight: 600, color: '#ef4444', marginBottom: 8, fontSize: '0.9rem' }}>
                        Source-backed risks:
                      </div>
                      <ul style={{ margin: 0, paddingLeft: 20, fontSize: '0.85rem', color: '#fca5a5', lineHeight: 1.6 }}>
                        {visibleRiskItems.map((r, i) => (
                          <li key={r.source_ids?.[0] || i}>{r.summary || r.kind}</li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                      No blockers, open pull requests, or branches ahead in the synced evidence.
                    </div>
                  )}

                  {visibleBusFactor.map((b, i) => (
                    <div key={b.repository_id || i} style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
                      {b.available === false ? (
                        <span>Bus factor: {b.reason}</span>
                      ) : (
                        <span>
                          Bus factor ({repositories.find(r => r.id === b.repository_id)?.full_name || 'repository'}):{' '}
                          <strong>{b.risk}</strong> risk. {b.evidence}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                  Risk data is not available yet.
                </div>
              )}
            </div>

            <div className="ws-card">
              <div className="ws-card-header">
                <h2 className="ws-card-title">Who knows what: contribution matrix</h2>
              </div>
              {!risks ? (
                <div className="ws-muted">Loading contribution data…</div>
              ) : risks.matrix?.modules?.length ? (
                <ContributionMatrix matrix={risks.matrix} modules={risks.modules} />
              ) : (
                <div className="ws-muted">No module contribution data yet. Sync a GitHub repository to build it.</div>
              )}
              {hiddenRiskCount > 0 && (
                <div className="ws-muted" role="note" style={{ marginTop: 10 }}>
                  {hiddenRiskCount} item{hiddenRiskCount === 1 ? '' : 's'} hidden for your role are not counted here.
                </div>
              )}
            </div>

            <SystemStatus health={health} isDemo={isDemo} repositories={repositories} tokens={tokens} />
          </div>
        )}

        {/* TAB 2: MEMORY & DECISIONS */}
        {activeTab === 'memory' && (
          <div>
            <div className="ws-filter-bar">
              <div className="ws-filter-pills">
                {['all', 'decision', 'blocker', 'commit', 'pull_request'].map(f => (
                  <button
                    key={f}
                    type="button"
                    aria-pressed={memoryFilter === f}
                    className={`ws-filter-pill ${memoryFilter === f ? 'active' : ''}`}
                    onClick={() => setMemoryFilter(f)}
                  >
                    {f === 'all' ? 'All Memories' : f.replace('_', ' ')}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <input
                  type="search"
                  aria-label="Search memories"
                  className="ws-input"
                  placeholder="Search decisions, files, rationale..."
                  value={memorySearch}
                  onChange={e => setMemorySearch(e.target.value)}
                  style={{ width: 260 }}
                />
                <button type="button" className="ws-btn ws-btn-primary" onClick={() => setShowMemoryModal(true)}>
                  + Log Memory
                </button>
              </div>
            </div>

            {filteredSources.length === 0 ? (
              <div className="ws-card ws-empty-state">
                <div className="ws-empty-icon" aria-hidden="true">🧠</div>
                <div className="ws-empty-title">{sources.length === 0 ? 'No memory records yet' : 'No records match this filter'}</div>
                <div>
                  {sources.length === 0
                    ? 'Use the “+ Log Memory” button, connect a repository, or capture context with the Baton MCP server.'
                    : 'Try another filter or clear the search.'}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {filteredSources.map(s => {
                  const isDecision = s.type === 'decision';
                  const isBlocker = s.type === 'blocker';
                  const meta = s.metadata || {};

                  return (
                    <div key={s.id} className="ws-card" style={{ marginBottom: 0 }}>
                      <div className="ws-card-header" style={{ marginBottom: 10, paddingBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span
                            className={`ws-badge ${
                              isDecision ? 'ws-badge-verified' : isBlocker ? 'ws-badge-danger' : 'ws-badge-muted'
                            }`}
                          >
                            {s.type}
                          </span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                            by <strong>{s.author_login || s.author_id}</strong> · {new Date(s.created_at).toLocaleString()}
                          </span>
                        </div>

                        <button
                          type="button"
                          className="ws-btn ws-btn-danger ws-btn-sm"
                          disabled={isBusy(`memory:${s.id}`)}
                          onClick={() => handleDeleteMemory(s.id)}
                          title="Delete memory"
                          aria-label={`Delete ${s.type} record`}
                        >
                          {isBusy(`memory:${s.id}`) ? '…' : '✕'}
                        </button>
                      </div>

                      <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f4f4f5', marginBottom: 8 }}>
                        {meta.decision || meta.problem || s.content}
                      </div>

                      {meta.reason && (
                        <div style={{ fontSize: '0.85rem', color: '#d1d5db', marginBottom: 6 }}>
                          <strong style={{ color: 'var(--green)' }}>Rationale:</strong> {meta.reason}
                        </div>
                      )}

                      {meta.alternatives && (
                        <div style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: 6 }}>
                          <strong>Discarded Alternatives:</strong>{' '}
                          {Array.isArray(meta.alternatives) ? meta.alternatives.join(', ') : meta.alternatives}
                        </div>
                      )}

                      {meta.files_affected && meta.files_affected.length > 0 && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                          {meta.files_affected.map((f, i) => (
                            <span
                              key={i}
                              style={{
                                background: '#1c1e24',
                                border: '1px solid #2d3039',
                                padding: '2px 8px',
                                borderRadius: 4,
                                fontFamily: 'monospace',
                                fontSize: '0.75rem',
                                color: '#93c5fd',
                              }}
                            >
                              {f}
                            </span>
                          ))}
                        </div>
                      )}

                      {meta.workaround_notes && (
                        <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: 8, borderRadius: 4, marginTop: 8, fontSize: '0.82rem', color: '#fca5a5' }}>
                          <strong>Workaround:</strong> {meta.workaround_notes}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: GITHUB INTEGRATION */}
        {activeTab === 'github' && (
          <GithubTab
            orgId={selectedOrgId}
            isDemo={isDemo}
            isAdmin={isAdmin}
            health={health}
            outcome={githubOutcome}
            repositories={repositories}
            sources={sources}
            notify={notify}
            onRefresh={() => refreshOrgState(selectedOrgId)}
          />
        )}

        {/* TAB 4: TEAM & MCP TOKENS */}
        {activeTab === 'team' && (
          <div>
            {/* Team Members List */}
            <div className="ws-card">
              <div className="ws-card-header">
                <h2 className="ws-card-title">Organization members</h2>
                {(isAdmin || isDemo) && (
                  <button type="button" className="ws-btn ws-btn-primary ws-btn-sm" onClick={() => setShowInviteModal(true)}>
                    + Invite member
                  </button>
                )}
              </div>

              {members.length === 0 && <div className="ws-muted">No members to show.</div>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {members.map(m => (
                  <div
                    key={m.id}
                    style={{
                      background: '#131417',
                      border: '1px solid var(--line)',
                      borderRadius: 6,
                      padding: 14,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: '#fff', fontSize: '0.95rem' }}>
                        {m.name || m.github_login || m.user_id}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: 2 }}>
                        {!isDemo && `${m.email || 'No email provided'} · `}GitHub:{' '}
                        <strong>{m.github_login ? `@${m.github_login}` : 'Not linked'}</strong>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span className={`ws-badge ${m.role === 'admin' ? 'ws-badge-verified' : 'ws-badge-muted'}`}>
                        {m.role}
                      </span>
                      {isAdmin ? (
                        <select
                          className="ws-input"
                          style={{ width: 'auto' }}
                          aria-label={`Function role for ${m.name || m.github_login || m.user_id}`}
                          value={m.function_role || ''}
                          onChange={e => handleSetFunctionRole(m, e.target.value)}
                        >
                          <option value="">No function role</option>
                          {FUNCTION_ROLES.map(role => <option key={role} value={role}>{role}</option>)}
                        </select>
                      ) : (
                        <span className="ws-badge ws-badge-muted">{m.function_role || 'no function role'}</span>
                      )}
                      <button
                        type="button"
                        className={`ws-btn ws-btn-sm ${m.offboarding ? 'ws-btn-danger' : ''}`}
                        disabled={isBusy(`member:${m.id}`)}
                        aria-pressed={Boolean(m.offboarding)}
                        onClick={() => handleToggleOffboarding(m)}
                        title="Toggle offboarding mode for handover generation"
                      >
                        {isBusy(`member:${m.id}`) ? 'Saving…' : m.offboarding ? 'Offboarding flagged' : 'Set offboarding'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* MCP API Tokens & Client Snippet */}
            <div className="ws-card">
              <div className="ws-card-header">
                <h2 className="ws-card-title">Baton MCP server and API tokens</h2>
                <button type="button" className="ws-btn ws-btn-primary ws-btn-sm" onClick={() => setShowTokenModal(true)}>
                  + Generate MCP Token
                </button>
              </div>

              <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: 16 }}>
                Baton MCP captures decisions and blockers from MCP-compatible tools such as Cursor, Claude and Antigravity, with client-side secret redaction.
              </div>

              {/* Token List */}
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff', margin: '0 0 10px' }}>
                  Active API tokens
                </h3>
                {tokens.length === 0 ? (
                  <div className="ws-muted">No tokens yet. Generate one to connect an MCP client.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {tokens.map(t => (
                      <div
                        key={t.id}
                        style={{
                          background: '#131417',
                          border: '1px solid var(--line)',
                          borderRadius: 6,
                          padding: 10,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <div>
                          <span style={{ fontWeight: 600, color: '#fff' }}>{t.name}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--muted)', marginLeft: 10 }}>
                            Created: {new Date(t.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="ws-btn ws-btn-danger ws-btn-sm"
                          disabled={isBusy(`token:${t.id}`)}
                          aria-label={`Revoke token ${t.name}`}
                          onClick={() => handleDeleteToken(t)}
                        >
                          {isBusy(`token:${t.id}`) ? 'Revoking…' : 'Revoke'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <McpConfig orgId={selectedOrgId} repositories={repositories} tokens={tokens} revealedToken={newestToken} notify={notify}>
                {isDemo ? (
                <div style={{
                  marginTop: 24,
                  background: '#0e1115',
                  border: '1px solid #252b36',
                  borderRadius: 8,
                  padding: 16
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#fff' }}>
                        ⚡ Live MCP Simulation Console (Test 'log_decision' in Browser)
                      </span>
                      <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 2 }}>
                        Test how Baton redacts secrets with Shannon entropy and saves decisions to Supabase without opening an IDE.
                      </div>
                    </div>
                    <span style={{ fontSize: '0.7rem', color: '#6ee7b7', background: 'rgba(52, 211, 153, 0.1)', border: '1px solid #284435', padding: '2px 8px', borderRadius: 4, fontFamily: 'monospace' }}>
                      Demo sandbox
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#a0a6b4', marginBottom: 4, fontFamily: 'monospace' }}>
                        Architectural Decision (sample text):
                      </div>
                      <input
                        type="text"
                        value={simDecisionText}
                        onChange={(e) => setSimDecisionText(e.target.value)}
                        className="ws-input"
                        style={{ width: '100%', fontSize: '0.8rem', fontFamily: 'monospace' }}
                      />
                    </div>

                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#a0a6b4', marginBottom: 4, fontFamily: 'monospace' }}>
                        Rationale:
                      </div>
                      <input
                        type="text"
                        value={simReasonText}
                        onChange={(e) => setSimReasonText(e.target.value)}
                        className="ws-input"
                        style={{ width: '100%', fontSize: '0.8rem', fontFamily: 'monospace' }}
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, flexWrap: 'wrap', gap: 8 }}>
                      <div style={{ fontSize: '0.74rem', color: '#7a8290', fontFamily: 'monospace' }}>
                        Target: <span style={{ color: '#34d399' }}>POST /api/orgs/{selectedOrgId ? selectedOrgId.slice(0, 8) + '...' : 'active'}/memories</span>
                      </div>
                      <button
                        className="ws-btn ws-btn-primary ws-btn-sm"
                        onClick={handleSimulateMcp}
                        disabled={simRunning}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                      >
                        <span>{simRunning ? 'Sanitizing & Logging...' : 'Execute log_decision →'}</span>
                      </button>
                    </div>

                    {simResult && (
                      <div style={{
                        marginTop: 10,
                        background: simResult.success ? '#0a1a12' : '#2a1010',
                        border: `1px solid ${simResult.success ? '#1f5238' : '#6b2020'}`,
                        borderRadius: 6,
                        padding: 12,
                        fontSize: '0.78rem',
                        fontFamily: 'monospace'
                      }}>
                        {simResult.success ? (
                          <div>
                            <div style={{ color: '#34d399', fontWeight: 600, marginBottom: 4 }}>
                              ✓ Success: MCP Memory Intercepted & Stored in Database!
                            </div>
                            <div style={{ color: '#f59e0b', fontSize: '0.74rem' }}>
                              🛡️ Quarantined Secret: <span style={{ textDecoration: 'line-through', color: '#ef4444' }}>{simResult.detectedSecret}</span> → Sanitized to [REDACTED: API_KEY]
                            </div>
                            <div style={{ color: '#9da3ae', fontSize: '0.74rem', marginTop: 4 }}>
                              Saved as record: {simResult.memory?.id} · Visible immediately in the Overview Activity feed.
                            </div>
                          </div>
                        ) : (
                          <div style={{ color: '#ef4444' }}>
                            Error: {simResult.error}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                ) : (
                <div style={{ marginTop: 24, background: '#0e1115', border: '1px solid #252b36', borderRadius: 8, padding: 16 }}>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#fff', marginBottom: 10 }}>
                    Recent MCP captures
                  </div>
                  {sources.filter(s => s.type === 'decision' || s.type === 'blocker').length === 0 ? (
                    <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                      No captures yet. Decisions and blockers logged through the Baton MCP server will appear here.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {sources.filter(s => s.type === 'decision' || s.type === 'blocker').slice(0, 5).map(s => (
                        <div key={s.id} style={{ fontSize: '0.8rem', color: '#d1d5db' }}>
                          <span className={`ws-badge ${s.type === 'blocker' ? 'ws-badge-danger' : 'ws-badge-verified'}`}>{s.type}</span>{' '}
                          {s.metadata?.decision || s.metadata?.problem || s.content}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                )}
              </McpConfig>
            </div>

            {isAdmin && !isDemo && selectedOrg && (
              <SettingsCard
                org={selectedOrg}
                notify={notify}
                onRenamed={org => setOrgs(list => list.map(item => (item.id === org.id ? { ...item, name: org.name } : item)))}
                onCleared={() => refreshOrgState(selectedOrgId)}
                onDeleted={() => boot()}
              />
            )}
          </div>
        )}

        {/* TAB 5: TASKS & ACTION ITEMS */}
        {activeTab === 'tasks' && (
          <div>
            <div className="ws-filter-bar">
              <h2 className="ws-card-title" style={{ margin: 0 }}>
                Handoff tasks and action items
              </h2>
              <button type="button" className="ws-btn ws-btn-primary" onClick={() => setShowTaskModal(true)}>
                + New Task
              </button>
            </div>

            {tasks.length === 0 ? (
              <div className="ws-card ws-empty-state">
                <div className="ws-empty-icon" aria-hidden="true">📋</div>
                <div className="ws-empty-title">No tasks yet</div>
                <div>Create tasks to track outstanding architectural deliverables and follow-ups.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {tasks.map(task => (
                  <div key={task.id} className="ws-card" style={{ marginBottom: 0 }}>
                    <div className="ws-card-header" style={{ marginBottom: 10, paddingBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span
                          className={`ws-badge ${
                            task.status === 'done'
                              ? 'ws-badge-verified'
                              : task.status === 'in_progress'
                              ? 'ws-badge-inferred'
                              : 'ws-badge-muted'
                          }`}
                        >
                          {task.status || 'open'}
                        </span>
                        <span style={{ fontWeight: 600, fontSize: '0.95rem', color: '#fff' }}>
                          {task.title}
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: 6 }}>
                        <select
                          className="ws-org-select"
                          aria-label={`Status for task ${task.title}`}
                          disabled={isBusy(`task:${task.id}`)}
                          style={{ fontSize: "0.75rem", padding: "3px 8px" }}
                          value={task.status || 'open'}
                          onChange={e => handleUpdateTaskStatus(task.id, e.target.value)}
                        >
                          <option value="open">Open</option>
                          <option value="in_progress">In Progress</option>
                          <option value="done">Done</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ fontSize: '0.85rem', color: '#d1d5db', marginBottom: 8 }}>
                      {task.description}
                    </div>

                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'flex', gap: 12 }}>
                      <span>Assignee: {task.assignee_id ? memberLabel(task.assignee_id) : 'Unassigned'}</span>
                      {task.due_at && <span>Due: {new Date(task.due_at).toLocaleDateString()}</span>}
                    </div>

                    {/* Comments & Discussion Drawer */}
                    <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <button
                        type="button"
                        aria-expanded={activeTaskIdForComments === task.id}
                        className="ws-btn ws-btn-sm"
                        style={{ background: 'transparent', border: 'none', color: 'var(--green)', padding: 0 }}
                        onClick={() =>
                          setActiveTaskIdForComments(activeTaskIdForComments === task.id ? null : task.id)
                        }
                      >
                        {activeTaskIdForComments === task.id ? '▲ Hide Comments' : `▼ Threaded Comments (${task.comments?.length || 0})`}
                      </button>

                      {activeTaskIdForComments === task.id && (
                        <div style={{ marginTop: 10 }}>
                          {task.comments && task.comments.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                              {task.comments.map(c => (
                                <div
                                  key={c.id}
                                  style={{
                                    background: '#131417',
                                    padding: 8,
                                    borderRadius: 4,
                                    fontSize: '0.82rem',
                                  }}
                                >
                                  <div style={{ fontWeight: 600, color: '#fff', fontSize: '0.75rem' }}>
                                    {memberLabel(c.author_id)} · {new Date(c.created_at).toLocaleTimeString()}
                                  </div>
                                  <div style={{ color: '#d1d5db', marginTop: 2 }}>{c.content}</div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div style={{ color: 'var(--muted)', fontSize: '0.75rem', marginBottom: 10 }}>
                              No comments yet.
                            </div>
                          )}

                          <form
                            onSubmit={e => handleAddTaskComment(e, task.id)}
                            style={{ display: 'flex', gap: 8 }}
                          >
                            <input
                              type="text"
                              className="ws-input"
                              aria-label="Write a comment"
                              placeholder="Write a comment..."
                              value={newCommentText}
                              onChange={e => setNewCommentText(e.target.value)}
                              style={{ flex: 1, padding: '6px 10px', fontSize: '0.8rem' }}
                            />
                            <button type="submit" className="ws-btn ws-btn-primary ws-btn-sm" disabled={isBusy(`comment:${task.id}`) || !newCommentText.trim()}>
                              {isBusy(`comment:${task.id}`) ? "Sending…" : "Reply"}
                            </button>
                          </form>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 6: HANDOVERS & NEWCOMER QUERY ENGINE */}
        {activeTab === 'handovers' && (
          <div>
            <div className="ws-card">
              <div className="ws-card-header">
                <h2 className="ws-card-title">Engineering handovers</h2>
                <button
                  type="button"
                  className="ws-btn ws-btn-primary ws-btn-sm"
                  onClick={() => startHandoverFor("")}
                >
                  + Initiate Handover
                </button>
              </div>

              {handovers.length === 0 ? (
                <div className="ws-empty-state">
                  <div className="ws-empty-icon" aria-hidden="true">🤝</div>
                  <div className="ws-empty-title">No active handovers</div>
                  <div>Initiate an evidence-based handover to capture and verify knowledge transfer.</div>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {handovers.map(h => (
                    <button
                      key={h.id}
                      type="button"
                      aria-pressed={hv?.id === h.id}
                      disabled={loadingHandoverId !== null}
                      className={`ws-btn ${hv?.id === h.id ? 'ws-btn-primary' : ''}`}
                      onClick={() => loadHandover(h.id)}
                    >
                      Handover {memberLabel(h.leaver_id)} → {memberLabel(h.incoming_id)} ({h.status || 'draft'})
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Handover Detail View */}
            {activeHandoverDetail && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <ConflictsPanel
                  conflicts={activeHandoverDetail.conflicts}
                  canResolve={isAdmin && hv?.status === 'draft'}
                  onResolve={handleResolveConflict}
                  nameOf={memberLabel}
                />

                {/* Header card with status and actions */}
                <div className="ws-card">
                  <div className="ws-card-header">
                    <div>
                      <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff' }}>
                        Handover: {memberLabel(hv?.leaver_id)} → {memberLabel(hv?.incoming_id)}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: 4 }}>
                        Status: <span className="ws-badge ws-badge-verified">{hv?.acknowledged_at ? 'acknowledged' : hv?.status || 'draft'}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" className="ws-btn ws-btn-sm" onClick={handleGenerateHandover} disabled={hv?.status !== "draft" || isBusy("handover")}>
                        ⚡ Compile Claims
                      </button>
                      {isAdmin && (
                        <button
                          type="button"
                          className="ws-btn ws-btn-primary ws-btn-sm"
                          onClick={handleApproveHandover}
                          disabled={hv?.status !== "draft" || openConflicts > 0 || isBusy("handover")}
                          title={openConflicts > 0 ? 'Resolve every conflict before approving' : undefined}
                        >
                          ✓ Approve Handover
                        </button>
                      )}
                      {myUserId && myUserId === hv?.incoming_id && (
                        <button
                          type="button"
                          className="ws-btn ws-btn-sm"
                          onClick={handleAcknowledgeHandover}
                          disabled={hv?.status !== "approved" || Boolean(hv?.acknowledged_at) || isBusy("handover")}
                        >
                          🤝 Acknowledge Transfer
                        </button>
                      )}
                      <button type="button" className="ws-btn ws-btn-sm" onClick={() => setPacketId(hv.id)}>
                        Open packet
                      </button>
                      {hv?.status === 'approved' && (
                        <button type="button" className="ws-btn ws-btn-sm" onClick={handleExportHandover} disabled={isBusy('export')}>
                          {isBusy('export') ? 'Exporting…' : 'Export Markdown'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Exit Interview Questions */}
                  {activeHandoverDetail.questions && activeHandoverDetail.questions.length > 0 && (
                    <div style={{ marginTop: 14 }}>
                      <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#fff', marginBottom: 8 }}>
                        Exit Interview Questions (Knowledge Gap Detection):
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {activeHandoverDetail.questions.filter(q => !q.asked_by).map(q => (
                          <div
                            key={q.id}
                            style={{
                              background: '#131417',
                              border: '1px solid var(--line)',
                              borderRadius: 6,
                              padding: 12,
                            }}
                          >
                            <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#f4f4f5' }}>
                              {q.question_text}
                            </div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 6 }}>
                              <RiskBadge question={q} />
                              {q.status === 'skipped' && <span className="ws-badge ws-badge-muted">skipped</span>}
                            </div>
                            {Array.isArray(q.risk_reasons) && q.risk_reasons.length > 0 && (
                              <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: '0.78rem', color: 'var(--muted)' }} aria-label="Why this question matters">
                                {q.risk_reasons.map(reason => <li key={reason}>{reason}</li>)}
                              </ul>
                            )}
                            {q.answer ? (
                              <div style={{ marginTop: 6, fontSize: '0.82rem', color: 'var(--green)' }}>
                                <strong>Answer:</strong> {q.answer}
                              </div>
                            ) : q.status === 'skipped' ? null : hv?.status !== 'draft' ? null : (
                              <div style={{ marginTop: 8 }}>
                                {answeringQuestionId === q.id ? (
                                  <form onSubmit={e => handleAnswerQuestion(e, q.id)}>
                                    <textarea
                                      className="ws-input"
                                      placeholder="Provide the missing context..."
                                      rows={2}
                                      value={answerText}
                                      onChange={e => setAnswerText(e.target.value)}
                                      style={{ width: '100%', marginBottom: 6 }}
                                    />
                                    <div style={{ display: 'flex', gap: 6 }}>
                                      <button type="submit" className="ws-btn ws-btn-primary ws-btn-sm">
                                        Submit Answer
                                      </button>
                                      <button
                                        type="button"
                                        className="ws-btn ws-btn-sm"
                                        onClick={() => setAnsweringQuestionId(null)}
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </form>
                                ) : (
                                  <div style={{ display: 'flex', gap: 6 }}>
                                    {myUserId === q.assigned_to && (
                                      <button
                                        className="ws-btn ws-btn-sm"
                                        aria-label={`Answer question: ${String(q.question_text).slice(0, 60)}`}
                                        onClick={() => {
                                          setAnsweringQuestionId(q.id);
                                          setAnswerText('');
                                        }}
                                      >
                                        Answer
                                      </button>
                                    )}
                                    {(isAdmin || myUserId === q.assigned_to) && (
                                      <button
                                        type="button"
                                        className="ws-btn ws-btn-sm"
                                        aria-label={`Skip question: ${String(q.question_text).slice(0, 60)}`}
                                        onClick={() => handleSkipQuestion(q.id)}
                                      >
                                        Skip
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Grounded Claims List */}
                <div className="ws-card">
                  <div className="ws-card-header">
                    <div className="ws-card-title">Evidence-Backed Grounded Claims</div>
                    <span className="ws-badge ws-badge-verified">
                      {activeHandoverDetail.claims?.length || 0} claims
                    </span>
                  </div>

                  {(!activeHandoverDetail.claims || activeHandoverDetail.claims.length === 0) ? (
                    <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                      Click "Compile Claims" above to synthesize claims from git history, PRs, and agent memory.
                    </div>
                  ) : (
                    <ClaimsView
                      claims={activeHandoverDetail.claims}
                      sources={activeHandoverDetail.sources}
                      editable={isAdmin && hv?.status === 'draft'}
                      onReview={handleClaimReview}
                      onEdit={handleEditClaim}
                    />
                  )}
                </div>

                {/* Newcomer Cited Q&A Tool */}
                <div className="ws-card">
                  <div className="ws-card-header">
                    <div className="ws-card-title">Ask Newcomer Question (Cited Q&A)</div>
                    <span className="ws-badge ws-badge-verified">Verbatim Citations Only</span>
                  </div>

                  <form onSubmit={handleAskQuestion} style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                    <input
                      type="text"
                      className="ws-input"
                      placeholder="e.g. Why did we choose this database? What work is still unfinished?"
                      value={qaQuestion}
                      onChange={e => setQaQuestion(e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <button
                      type="submit"
                      className="ws-btn ws-btn-primary"
                      disabled={qaLoading || !qaQuestion.trim()}
                    >
                      {qaLoading ? 'Searching Evidence...' : 'Ask Baton'}
                    </button>
                  </form>

                  {qaResult && (
                    <div
                      style={{
                        background: '#121316',
                        border: '1px solid var(--line)',
                        borderRadius: 6,
                        padding: 16,
                      }}
                    >
                      <div style={{ fontWeight: 600, color: 'var(--green)', marginBottom: 6, fontSize: '0.9rem' }}>
                        Answer:
                      </div>
                      <div style={{ fontSize: '0.9rem', color: '#f4f4f5', lineHeight: 1.6, marginBottom: 12 }}>
                        {qaResult.answer}
                      </div>

                      {Array.isArray(qaResult.source_ids) && qaResult.source_ids.length > 0 ? (
                        <div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: 6 }}>Supporting Evidence Citations:</div>
                          <Citations ids={qaResult.source_ids} sources={activeHandoverDetail.sources} />
                        </div>
                      ) : (
                        qaResult.confidence === 'missing' && <div className="ws-muted">No approved source supports an answer.</div>
                      )}
                    </div>
                  )}
                </div>

                <div className="ws-card">
                  <div className="ws-card-header">
                    <div className="ws-card-title">Version History</div>
                  </div>
                  <VersionHistory handoverId={hv.id} notify={notify} refreshKey={hv.version} />
                </div>
              </div>
            )}
          </div>
        )}
        </div>
      </main>
      )}

      {packetId && (
        <main id="main" className="ws-main">
          <HandoverPage handoverId={packetId} mode={mode} embedded onBack={() => setPacketId(null)} />
        </main>
      )}

      {showCreateOrgModal && (
        <CreateOrgModal
          onClose={() => setShowCreateOrgModal(false)}
          onCreated={async res => {
            setShowCreateOrgModal(false);
            await boot(res?.organization?.id);
            notify('Team created.', 'success');
          }}
        />
      )}

      {showInviteModal && <InviteModal orgId={selectedOrgId} notify={notify} onClose={() => { setShowInviteModal(false); refreshOrgState(selectedOrgId); }} />}

      {showTokenModal && (
        <TokenModal
          orgId={selectedOrgId}
          notify={notify}
          onCreated={token => { setNewestToken(token); refreshOrgState(selectedOrgId); }}
          onClose={() => setShowTokenModal(false)}
        />
      )}

      {showMemoryModal && (
        <MemoryModal
          orgId={selectedOrgId}
          onClose={() => setShowMemoryModal(false)}
          onSaved={async () => { setShowMemoryModal(false); await refreshOrgState(selectedOrgId); notify('Memory saved.', 'success'); }}
        />
      )}

      {showTaskModal && (
        <TaskModal
          orgId={selectedOrgId}
          members={members}
          onClose={() => setShowTaskModal(false)}
          onSaved={async () => { setShowTaskModal(false); await refreshOrgState(selectedOrgId); notify('Task created.', 'success'); }}
        />
      )}

      {showStartHandoverModal && (
        <StartHandoverModal
          orgId={selectedOrgId}
          members={members}
          initialLeaverId={handoverLeaverId}
          onClose={() => setShowStartHandoverModal(false)}
          onStarted={async res => {
            setShowStartHandoverModal(false);
            setActiveTab('handovers');
            await refreshOrgState(selectedOrgId);
            if (res?.handover?.id) await loadHandover(res.handover.id);
          }}
        />
      )}

      {confirming && (
        <ConfirmDialog
          title={confirming.title}
          confirmLabel={confirming.confirmLabel}
          busy={confirmBusy}
          onCancel={() => setConfirming(null)}
          onConfirm={async () => {
            setConfirmBusy(true);
            try {
              await confirming.run();
              setConfirming(null);
            } catch (err) {
              setConfirming(null);
              notify(err.message);
            } finally {
              setConfirmBusy(false);
            }
          }}
        >
          {confirming.body}
        </ConfirmDialog>
      )}
    </div>
  );
}

export default Workspace;

