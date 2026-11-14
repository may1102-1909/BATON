import React, { useState, useEffect, useRef } from 'react';
import { Brand } from './Brand';
import * as api from '../lib/api.js';
import { HandoverPage } from '../pages/HandoverPage';
import { downloadText, slugify } from '../lib/download.js';
import { inviteErrorMessage, parseInviteToken } from '../lib/invite.js';
import { ConfirmDialog } from './workspace/Modal';
import { CreateOrgModal, InviteModal, MemoryModal, StartHandoverModal, TaskModal, TokenModal } from './workspace/Modals';
import { buildChecklist } from './workspace/OnboardingChecklist';
import { GithubTab } from './workspace/GithubTab';
import { OverviewTab } from './workspace/OverviewTab';
import { MemoryTab } from './workspace/MemoryTab';
import { TeamTab } from './workspace/TeamTab';
import { TasksTab } from './workspace/TasksTab';
import { HandoversTab } from './workspace/HandoversTab';
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
        const markdown = await api.getHandoverMarkdown(handover.id);
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
      <h1 className="sr-only">{isDemo ? 'Baton demo workspace' : `Baton workspace${selectedOrg ? `: ${selectedOrg.name}` : ''}`}</h1>
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
          <OverviewTab
            blockersCount={blockersCount}
            checklistItems={checklistItems}
            commitsCount={commitsCount}
            decisionsCount={decisionsCount}
            handovers={handovers}
            hasGithubData={hasGithubData}
            health={health}
            hiddenRiskCount={hiddenRiskCount}
            isAdmin={isAdmin}
            isDemo={isDemo}
            repositories={repositories}
            riskAlerts={riskAlerts}
            riskCounts={riskCounts}
            riskRepoId={riskRepoId}
            risks={risks}
            selectedOrgId={selectedOrgId}
            setActiveTab={setActiveTab}
            setRiskRepoId={setRiskRepoId}
            setShowAllAlerts={setShowAllAlerts}
            showAllAlerts={showAllAlerts}
            startHandoverFor={startHandoverFor}
            tokens={tokens}
            visibleBusFactor={visibleBusFactor}
            visibleRiskItems={visibleRiskItems}
          />
        )}

        {/* TAB 2: MEMORY & DECISIONS */}
        {activeTab === 'memory' && (
          <MemoryTab
            filteredSources={filteredSources}
            handleDeleteMemory={handleDeleteMemory}
            isBusy={isBusy}
            memoryFilter={memoryFilter}
            memorySearch={memorySearch}
            setMemoryFilter={setMemoryFilter}
            setMemorySearch={setMemorySearch}
            setShowMemoryModal={setShowMemoryModal}
            sources={sources}
          />
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
          <TeamTab
            boot={boot}
            handleDeleteToken={handleDeleteToken}
            handleSetFunctionRole={handleSetFunctionRole}
            handleSimulateMcp={handleSimulateMcp}
            handleToggleOffboarding={handleToggleOffboarding}
            isAdmin={isAdmin}
            isBusy={isBusy}
            isDemo={isDemo}
            members={members}
            mode={mode}
            newestToken={newestToken}
            notify={notify}
            orgs={orgs}
            refreshOrgState={refreshOrgState}
            repositories={repositories}
            selectedOrg={selectedOrg}
            selectedOrgId={selectedOrgId}
            setOrgs={setOrgs}
            setShowInviteModal={setShowInviteModal}
            setShowTokenModal={setShowTokenModal}
            setSimDecisionText={setSimDecisionText}
            setSimReasonText={setSimReasonText}
            simDecisionText={simDecisionText}
            simReasonText={simReasonText}
            simResult={simResult}
            simRunning={simRunning}
            sources={sources}
            tokens={tokens}
          />
        )}

        {/* TAB 5: TASKS & ACTION ITEMS */}
        {activeTab === 'tasks' && (
          <TasksTab
            activeTaskIdForComments={activeTaskIdForComments}
            handleAddTaskComment={handleAddTaskComment}
            handleUpdateTaskStatus={handleUpdateTaskStatus}
            isBusy={isBusy}
            memberLabel={memberLabel}
            newCommentText={newCommentText}
            setActiveTaskIdForComments={setActiveTaskIdForComments}
            setNewCommentText={setNewCommentText}
            setShowTaskModal={setShowTaskModal}
            tasks={tasks}
          />
        )}

        {/* TAB 6: HANDOVERS & NEWCOMER QUERY ENGINE */}
        {activeTab === 'handovers' && (
          <HandoversTab
            activeHandoverDetail={activeHandoverDetail}
            answerText={answerText}
            answeringQuestionId={answeringQuestionId}
            handleAcknowledgeHandover={handleAcknowledgeHandover}
            handleAnswerQuestion={handleAnswerQuestion}
            handleApproveHandover={handleApproveHandover}
            handleAskQuestion={handleAskQuestion}
            handleClaimReview={handleClaimReview}
            handleEditClaim={handleEditClaim}
            handleExportHandover={handleExportHandover}
            handleGenerateHandover={handleGenerateHandover}
            handleResolveConflict={handleResolveConflict}
            handleSkipQuestion={handleSkipQuestion}
            handovers={handovers}
            hv={hv}
            isAdmin={isAdmin}
            isBusy={isBusy}
            loadHandover={loadHandover}
            loadingHandoverId={loadingHandoverId}
            memberLabel={memberLabel}
            myUserId={myUserId}
            notify={notify}
            openConflicts={openConflicts}
            qaLoading={qaLoading}
            qaQuestion={qaQuestion}
            qaResult={qaResult}
            setAnswerText={setAnswerText}
            setAnsweringQuestionId={setAnsweringQuestionId}
            setPacketId={setPacketId}
            setQaQuestion={setQaQuestion}
            sources={sources}
            startHandoverFor={startHandoverFor}
          />
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

