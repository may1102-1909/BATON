import React, { useState, useEffect } from 'react';
import { Brand } from './Brand';
import * as api from '../lib/api.js';
import { GithubConnect } from './GithubConnect';
import { Citations, ClaimsView, ConflictsPanel, ContributionMatrix, RiskBadge, VersionHistory } from './HandoverParts';
import { HandoverPage } from '../pages/HandoverPage';
import { FUNCTION_ROLES } from '../../server/audience.js';
import './workspace.css';

const MCP_PACKAGE_SOURCE = 'github:may1102-1909/BATON';

export function Workspace({
  onSignOut,
  onBack,
  mode = 'production',
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
  const [risks, setRisks] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [githubOutcome, setGithubOutcome] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [inviteToken, setInviteToken] = useState('');

  // Modals & form states
  const [showCreateOrgModal, setShowCreateOrgModal] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteRole, setInviteRole] = useState('member');
  const [inviteEmail, setInviteEmail] = useState('');
  const [generatedInviteToken, setGeneratedInviteToken] = useState(null);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [newTokenName, setNewTokenName] = useState('');
  const [revealedToken, setRevealedToken] = useState(null);
  const [showMemoryModal, setShowMemoryModal] = useState(false);
  const [memoryType, setMemoryType] = useState('decision');
  const [memoryContent, setMemoryContent] = useState('');
  const [memoryMetadata, setMemoryMetadata] = useState('');
  const [memoryVisibility, setMemoryVisibility] = useState('team');
  const [memoryFilter, setMemoryFilter] = useState('all');
  const [memorySearch, setMemorySearch] = useState('');

  // Tasks state
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskAssignee, setTaskAssignee] = useState('');
  const [taskDue, setTaskDue] = useState('');
  const [activeTaskIdForComments, setActiveTaskIdForComments] = useState(null);
  const [newCommentText, setNewCommentText] = useState('');

  // Handover state
  const [showStartHandoverModal, setShowStartHandoverModal] = useState(false);
  const [handoverLeaverId, setHandoverLeaverId] = useState('');
  const [handoverIncomingId, setHandoverIncomingId] = useState('');
  const [activeHandoverDetail, setActiveHandoverDetail] = useState(null);
  const [answeringQuestionId, setAnsweringQuestionId] = useState(null);
  const [answerText, setAnswerText] = useState('');
  const [qaQuestion, setQaQuestion] = useState('');
  const [qaResult, setQaResult] = useState(null);
  const [qaLoading, setQaLoading] = useState(false);
  const [packetId, setPacketId] = useState(null);


  // Zero-Clone MCP Client Config & demo-only simulator state
  const [mcpClientTab, setMcpClientTab] = useState('cursor');
  const [copiedMcpSnippet, setCopiedMcpSnippet] = useState(false);
  const [simDecisionText, setSimDecisionText] = useState(demoSimulatorSample?.decision ?? '');
  const [simReasonText, setSimReasonText] = useState(demoSimulatorSample?.reason ?? '');
  const [simRunning, setSimRunning] = useState(false);
  const [simResult, setSimResult] = useState(null);

  function notify(message, kind = 'error') {
    setNotice({ message: String(message), kind });
  }

  useEffect(() => {
    if (notice?.kind !== 'success') return undefined;
    const timer = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [notice]);

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

  async function boot() {
    setLoading(true);
    setError(null);
    try {
      if (isDemo && demoPersona) api.setDemoUser(demoPersona);
      const h = await api.fetchHealth().catch(() => null);
      setHealth(h);

      const meData = await api.fetchMe().catch(() => null);
      if (meData) {
        setMe(meData);
        const orgList = meData.organizations || [];
        setOrgs(orgList);
        if (orgList.length > 0) {
          setSelectedOrgId(cur => (orgList.some(o => o.id === cur) ? cur : orgList[0].id));
        } else {
          setSelectedOrgId(null);
          setOrgState(null);
          setRisks(null);
        }
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
    if (!selectedOrgId) return;
    refreshOrgState(selectedOrgId);
  }, [selectedOrgId, demoPersona]);

  async function refreshOrgState(orgId) {
    try {
      const state = await api.fetchOrgState(orgId);
      setOrgState(state);
      const r = await api.fetchRisks(orgId).catch(() => null);
      setRisks(r);
    } catch (err) {
      console.error('Failed to load org state:', err);
    }
  }

  async function handleCreateOrg(e) {
    e.preventDefault();
    if (!newOrgName.trim()) return;
    try {
      const res = await api.createOrg(newOrgName.trim());
      setNewOrgName('');
      setShowCreateOrgModal(false);
      await boot();
      if (res?.organization?.id) setSelectedOrgId(res.organization.id);
      notify('Team created.', 'success');
    } catch (err) {
      notify(err.message);
    }
  }

  async function handleAcceptInvite(e) {
    e.preventDefault();
    const token = inviteToken.trim();
    if (!token) return;
    try {
      const res = await api.acceptInvite(token);
      setInviteToken('');
      await boot();
      if (res?.organization_id) setSelectedOrgId(res.organization_id);
      notify('Invite accepted.', 'success');
    } catch (err) {
      notify(err.message);
    }
  }

  async function handleCreateInvite(e) {
    e.preventDefault();
    if (!selectedOrgId) return;
    try {
      const res = await api.createInvite(selectedOrgId, inviteRole, inviteEmail.trim() || null);
      setGeneratedInviteToken(res.token);
    } catch (err) {
      notify(err.message);
    }
  }

  async function handleCreateToken(e) {
    e.preventDefault();
    const orgId = selectedOrgId || orgs[0]?.id;
    if (!orgId) {
      notify('Please create or select an organization before generating an MCP token.');
      return;
    }
    if (!newTokenName.trim()) {
      notify('Please enter a name for the MCP token.');
      return;
    }
    try {
      const res = await api.createToken(orgId, newTokenName.trim());
      setRevealedToken(res.token);
      setNewTokenName('');
      refreshOrgState(orgId);
    } catch (err) {
      notify(`Token generation failed: ${err.message}`);
    }
  }

  async function handleDeleteToken(tokenId) {
    if (!selectedOrgId || !confirm('Are you sure you want to revoke this MCP API token?')) return;
    try {
      await api.deleteToken(selectedOrgId, tokenId);
      refreshOrgState(selectedOrgId);
    } catch (err) {
      notify(err.message);
    }
  }

  async function handleToggleOffboarding(member) {
    if (!selectedOrgId) return;
    try {
      await api.updateMember(selectedOrgId, member.id, {
        offboarding: !member.offboarding
      });
      refreshOrgState(selectedOrgId);
    } catch (err) {
      notify(err.message);
    }
  }

  async function handleCreateMemory(e) {
    e.preventDefault();
    if (!selectedOrgId || !memoryContent.trim()) return;
    let meta = {};
    if (memoryMetadata.trim()) {
      try {
        meta = JSON.parse(memoryMetadata);
      } catch {
        meta = { notes: memoryMetadata };
      }
    }
    try {
      await api.createMemory(selectedOrgId, {
        type: memoryType,
        content: memoryContent.trim(),
        metadata: meta,
        visibility: memoryVisibility
      });
      setShowMemoryModal(false);
      setMemoryContent('');
      setMemoryMetadata('');
      refreshOrgState(selectedOrgId);
    } catch (err) {
      notify(err.message);
    }
  }

  async function handleDeleteMemory(memoryId) {
    if (!selectedOrgId || !confirm('Delete this memory record?')) return;
    try {
      await api.deleteMemory(selectedOrgId, memoryId);
      refreshOrgState(selectedOrgId);
    } catch (err) {
      notify(err.message);
    }
  }

  async function handleCreateTask(e) {
    e.preventDefault();
    if (!selectedOrgId || !taskTitle.trim()) return;
    try {
      await api.createTask(selectedOrgId, {
        title: taskTitle.trim(),
        description: taskDesc.trim(),
        assignee_id: taskAssignee || null,
        due_at: taskDue || null
      });
      setShowTaskModal(false);
      setTaskTitle('');
      setTaskDesc('');
      refreshOrgState(selectedOrgId);
    } catch (err) {
      notify(err.message);
    }
  }

  async function handleUpdateTaskStatus(taskId, status) {
    try {
      await api.updateTask(taskId, { status });
      refreshOrgState(selectedOrgId);
    } catch (err) {
      notify(err.message);
    }
  }

  async function handleAddTaskComment(e, taskId) {
    e.preventDefault();
    if (!newCommentText.trim()) return;
    try {
      await api.createTaskComment(taskId, newCommentText.trim());
      setNewCommentText('');
      refreshOrgState(selectedOrgId);
    } catch (err) {
      notify(err.message);
    }
  }

  async function handleSyncRepo(repoId) {
    if (!selectedOrgId) return;
    try {
      await api.syncRepo(selectedOrgId, repoId);
      notify('Repository synced successfully.', 'success');
      refreshOrgState(selectedOrgId);
    } catch (err) {
      notify(err.message);
    }
  }

  // Handover actions
  async function handleStartHandover(e) {
    e.preventDefault();
    if (!selectedOrgId || !handoverLeaverId || !handoverIncomingId) return;
    try {
      const res = await api.startHandover(selectedOrgId, handoverLeaverId, handoverIncomingId);
      setShowStartHandoverModal(false);
      setActiveTab('handovers');
      refreshOrgState(selectedOrgId);
      if (res?.handover?.id) await loadHandover(res.handover.id);
    } catch (err) {
      notify(err.message);
    }
  }

  async function loadHandover(id) {
    try {
      const detail = await api.getHandover(id);
      setActiveHandoverDetail(detail);
    } catch (err) {
      notify(`Failed to load handover: ${err.message}`);
    }
  }

  // Run a handover action, then reload the full detail the server returns from GET.
  async function runHandoverAction(action, successMessage) {
    const id = activeHandoverDetail?.handover?.id;
    if (!id) return;
    try {
      await action(id);
      await loadHandover(id);
      refreshOrgState(selectedOrgId);
      if (successMessage) notify(successMessage, 'success');
    } catch (err) {
      notify(err.message);
    }
  }

  async function handleAnswerQuestion(e, questionId) {
    e.preventDefault();
    if (!answerText.trim()) return;
    await runHandoverAction(id => api.answerQuestion(id, questionId, answerText.trim()));
    setAnsweringQuestionId(null);
    setAnswerText('');
  }

  const handleGenerateHandover = () => runHandoverAction(id => api.generateHandover(id));
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

  async function handleSetFunctionRole(member, value) {
    try {
      await api.updateMember(selectedOrgId, member.id, { function_role: value || null });
      await refreshOrgState(selectedOrgId);
    } catch (err) {
      notify(err.message);
    }
  }

  function startHandoverFor(leaverUserId) {
    setHandoverLeaverId(leaverUserId || '');
    setHandoverIncomingId('');
    setShowStartHandoverModal(true);
  }
  const handleApproveHandover = () => runHandoverAction(id => api.approveHandover(id), 'Handover approved.');
  const handleAcknowledgeHandover = () => runHandoverAction(id => api.acknowledgeHandover(id), 'Handover acknowledged.');

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

  if (loading && !orgState) {
    return (
      <div className="ws-container" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <style>{`
          @keyframes batonLoaderGlow {
            0% {
              opacity: 0.65;
              filter: drop-shadow(0 0 4px rgba(52, 211, 153, 0.2));
              transform: scale(0.97);
            }
            50% {
              opacity: 1;
              filter: drop-shadow(0 0 14px rgba(52, 211, 153, 0.65));
              transform: scale(1.03);
            }
            100% {
              opacity: 0.65;
              filter: drop-shadow(0 0 4px rgba(52, 211, 153, 0.2));
              transform: scale(0.97);
            }
          }
        `}</style>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{ animation: 'batonLoaderGlow 2.4s ease-in-out infinite' }}>
            <Brand size={32} iconOnly />
          </div>
          <div style={{ color: 'var(--muted)', fontSize: '0.9rem', letterSpacing: '0.02em' }}>Loading Baton Workspace...</div>
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
  const isAdmin = orgs.find(o => o.id === selectedOrgId)?.role === 'admin';
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

  function buildMcpSnippet(tab) {
    const repoId = repositories[0]?.id;
    if (!selectedOrgId || !repoId) return null;
    const apiUrl = window.location.origin.includes('localhost') ? 'https://baton-nu.vercel.app' : window.location.origin;
    const apiKey = revealedToken || (tokens[0]?.name ? `<TOKEN_FOR_${tokens[0].name.toUpperCase()}>` : '<GENERATE_A_TOKEN_ABOVE>');
    const env = { BATON_API_URL: apiUrl, BATON_API_KEY: apiKey, BATON_ORG_ID: selectedOrgId, BATON_REPOSITORY_ID: repoId };
    if (tab === 'claude_cli') {
      const flags = Object.entries(env).map(([k, v]) => `-e ${k}="${v}"`).join(' ');
      return `claude mcp add baton -s user ${flags} -- npx -y ${MCP_PACKAGE_SOURCE} baton-mcp`;
    }
    if (tab === 'local_node') {
      return JSON.stringify({ mcpServers: { baton: { command: 'node', args: ['mcp-server/dist/index.js'], env } } }, null, 2);
    }
    return JSON.stringify({ mcpServers: { baton: { command: 'npx', args: ['-y', MCP_PACKAGE_SOURCE, 'baton-mcp'], env } } }, null, 2);
  }

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
      {/* Top Header */}
      <header className="ws-header">
        <div className="ws-header-left">
          <div className="ws-logo-wrap" onClick={onBack}>
            <Brand size={20} />
          </div>

          {orgs.length > 0 && (
            <select
              className="ws-org-select"
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

          <button className="ws-btn ws-btn-sm" onClick={() => setShowCreateOrgModal(true)}>
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
            <span style={{ color: 'var(--green)', fontWeight: 600 }}>●</span>
            <span>{userLabel}</span>
          </div>

          {onSignOut && (
            <button className="ws-btn ws-btn-sm" onClick={onSignOut}>
              Sign Out
            </button>
          )}
          {onBack && (
            <button className="ws-btn ws-btn-sm" onClick={onBack}>
              Home
            </button>
          )}
        </div>
      </header>

      {noticeBar}

      {error && <div className="ws-notice ws-notice-error" role="alert"><span>{error}</span></div>}

      {/* Navigation Tabs */}
      {!noOrgs && !packetId && (
      <nav className="ws-nav-tabs">
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'memory', label: 'Memory & Decisions', count: sources.length },
          { id: 'github', label: 'GitHub', count: repositories.length },
          { id: 'team', label: 'Team & Tokens', count: members.length },
          { id: 'tasks', label: 'Tasks', count: tasks.length },
          { id: 'handovers', label: 'Handovers', count: handovers.length },
        ].map(tab => (
          <button
            key={tab.id}
            className={`ws-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {tab.count !== undefined && <span className="ws-tab-count">{tab.count}</span>}
          </button>
        ))}
      </nav>
      )}

      {noOrgs && (
        <main className="ws-main">
          <div className="ws-card ws-empty-state">
            <div className="ws-empty-icon">👥</div>
            <div className="ws-empty-title">You are not part of a team yet</div>
            <div style={{ marginBottom: 20 }}>Create a team or join one with an invite token.</div>
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
                <button type="submit" className="ws-btn ws-btn-primary">Create a team</button>
              </form>
              <form onSubmit={handleAcceptInvite} style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 260 }}>
                <label className="ws-form-label" htmlFor="ws-join-invite">Join with invite</label>
                <input
                  id="ws-join-invite"
                  type="text"
                  className="ws-input"
                  placeholder="Invite token"
                  value={inviteToken}
                  onChange={e => setInviteToken(e.target.value)}
                  required
                />
                <button type="submit" className="ws-btn">Join with invite</button>
              </form>
            </div>
          </div>
        </main>
      )}

      {/* Main Workspace Body */}
      {!noOrgs && !packetId && (
      <main className="ws-main">
        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div>
            {riskAlerts.length > 0 && (
              <section className="ws-alert-list" aria-label="Bus factor alerts">
                {(showAllAlerts ? riskAlerts : riskAlerts.slice(0, 3)).map(alert => (
                  <div key={alert.module} className="ws-alert" role="alert">
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
                <div style={{ marginBottom: 14 }}>Connect GitHub to see who owns which modules, or explore the demo with sample data.</div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button type="button" className="ws-btn ws-btn-primary" onClick={() => setActiveTab('github')}>Connect GitHub</button>
                  {!isDemo && <a className="ws-btn" href="/demo-page">Open the demo</a>}
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
                <div className="ws-card-title">
                  <span>Continuous Architectural Risk Assessment</span>
                </div>
                <span className="ws-badge ws-badge-verified">Grounded Evidence Engine</span>
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

                  {riskItems.length > 0 ? (
                    <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: 6, padding: 14 }}>
                      <div style={{ fontWeight: 600, color: '#ef4444', marginBottom: 8, fontSize: '0.9rem' }}>
                        Source-backed risks:
                      </div>
                      <ul style={{ margin: 0, paddingLeft: 20, fontSize: '0.85rem', color: '#fca5a5', lineHeight: 1.6 }}>
                        {riskItems.map((r, i) => (
                          <li key={r.source_ids?.[0] || i}>{r.summary || r.kind}</li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                      No blockers, open pull requests, or branches ahead in the synced evidence.
                    </div>
                  )}

                  {busFactor.map((b, i) => (
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
                <div className="ws-card-title">Who knows what: contribution matrix</div>
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

            {/* System Status Overview */}
            <div className="ws-card">
              <div className="ws-card-header">
                <div className="ws-card-title">System Infrastructure & Sync Health</div>
              </div>
              <div className="ws-grid-3">
                <div style={{ background: '#131417', padding: 14, borderRadius: 6, border: '1px solid var(--line)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: 4 }}>Storage Engine</div>
                  <div style={{ fontWeight: 600, color: '#fff' }}>
                    {health?.configured?.supabase ? 'Supabase Postgres (RLS enabled)' : 'In-Memory Synthetic Store'}
                  </div>
                </div>
                <div style={{ background: '#131417', padding: 14, borderRadius: 6, border: '1px solid var(--line)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: 4 }}>GitHub App Integration</div>
                  <div style={{ fontWeight: 600, color: health?.configured?.github ? 'var(--green)' : '#f59e0b' }}>
                    {health?.configured?.github ? 'Configured & Active' : 'Not configured'}
                  </div>
                </div>
                <div style={{ background: '#131417', padding: 14, borderRadius: 6, border: '1px solid var(--line)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: 4 }}>Local MCP Server</div>
                  <div style={{ fontWeight: 600, color: 'var(--green)' }}>
                    StdioServerTransport v0.1.0 Ready
                  </div>
                </div>
              </div>
            </div>
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
                    className={`ws-filter-pill ${memoryFilter === f ? 'active' : ''}`}
                    onClick={() => setMemoryFilter(f)}
                  >
                    {f === 'all' ? 'All Memories' : f.replace('_', ' ')}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <input
                  type="text"
                  className="ws-input"
                  placeholder="Search decisions, files, rationale..."
                  value={memorySearch}
                  onChange={e => setMemorySearch(e.target.value)}
                  style={{ width: 260 }}
                />
                <button className="ws-btn ws-btn-primary" onClick={() => setShowMemoryModal(true)}>
                  + Log Memory
                </button>
              </div>
            </div>

            {filteredSources.length === 0 ? (
              <div className="ws-card ws-empty-state">
                <div className="ws-empty-icon">🧠</div>
                <div className="ws-empty-title">No memory records found</div>
                <div>Use the "+ Log Memory" button or the Baton Local MCP Server to capture context.</div>
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
                          className="ws-btn ws-btn-danger ws-btn-sm"
                          onClick={() => handleDeleteMemory(s.id)}
                          title="Delete memory"
                        >
                          ✕
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
          <div>
            <div className="ws-card">
              <div className="ws-card-header">
                <div className="ws-card-title">Connected GitHub Repositories</div>
              </div>

              <GithubConnect
                orgId={selectedOrgId}
                installUrl={health?.githubInstallUrl}
                outcome={githubOutcome}
                onConnected={() => refreshOrgState(selectedOrgId)}
              />

              {repositories.length === 0 ? (
                <div className="ws-empty-state">
                  <div className="ws-empty-icon">🐙</div>
                  <div className="ws-empty-title">No repositories linked yet</div>
                  <div>Connect your organization's GitHub App to sync pull requests and commits.</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {repositories.map(repo => (
                    <div
                      key={repo.id}
                      style={{
                        background: '#131417',
                        border: '1px solid var(--line)',
                        borderRadius: 6,
                        padding: 16,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '1rem', fontWeight: 600, color: '#fff' }}>
                          {repo.full_name}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: 4 }}>
                          Installation ID: #{repo.installation_id} · Last Synced:{' '}
                          {repo.last_synced_at ? new Date(repo.last_synced_at).toLocaleString() : 'Never'}
                        </div>
                      </div>

                      <button
                        className="ws-btn ws-btn-sm"
                        onClick={() => handleSyncRepo(repo.id)}
                      >
                        ↻ Sync Now
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Imported Commits & Pull Requests Feed */}
            <div className="ws-card">
              <div className="ws-card-header">
                <div className="ws-card-title">Live Git & PR Evidence Activity</div>
                <span className="ws-badge ws-badge-verified">Idempotent Sync</span>
              </div>

              {sources.filter(s => s.type === 'commit' || s.type === 'pull_request').length === 0 ? (
                <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                  No commits or pull requests synced yet. Click "Sync Now" on a connected repository.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {sources
                    .filter(s => s.type === 'commit' || s.type === 'pull_request')
                    .map(s => (
                      <div
                        key={s.id}
                        style={{
                          background: '#121316',
                          border: '1px solid var(--line)',
                          borderRadius: 6,
                          padding: 12,
                          fontSize: '0.85rem',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span className={`ws-badge ${s.type === 'pull_request' ? 'ws-badge-verified' : 'ws-badge-muted'}`}>
                            {s.type === 'pull_request' ? `PR #${s.metadata?.number || ''}` : 'Commit'}
                          </span>
                          <span style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>
                            {new Date(s.created_at).toLocaleString()}
                          </span>
                        </div>
                        <div style={{ color: '#fff', fontWeight: 500 }}>{s.content}</div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: TEAM & MCP TOKENS */}
        {activeTab === 'team' && (
          <div>
            {/* Team Members List */}
            <div className="ws-card">
              <div className="ws-card-header">
                <div className="ws-card-title">Organization Members</div>
                <button className="ws-btn ws-btn-primary ws-btn-sm" onClick={() => setShowInviteModal(true)}>
                  + Invite Member
                </button>
              </div>

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
                        className={`ws-btn ws-btn-sm ${m.offboarding ? 'ws-btn-danger' : ''}`}
                        onClick={() => handleToggleOffboarding(m)}
                        title="Toggle offboarding mode for handover generation"
                      >
                        {m.offboarding ? 'Offboarding Flagged' : 'Set Offboarding'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* MCP API Tokens & Client Snippet */}
            <div className="ws-card">
              <div className="ws-card-header">
                <div className="ws-card-title">Baton MCP Server & API Tokens</div>
                <button className="ws-btn ws-btn-primary ws-btn-sm" onClick={() => setShowTokenModal(true)}>
                  + Generate MCP Token
                </button>
              </div>

              <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: 16 }}>
                Baton MCP integrates directly with Cursor, Claude Desktop, Antigravity, and Codex to capture decisions and blockers locally with client-side secret redaction.
              </div>

              {/* Token List */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff', marginBottom: 10 }}>
                  Active API Tokens:
                </div>
                {tokens.length === 0 ? (
                  <div style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>No tokens created yet.</div>
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
                          className="ws-btn ws-btn-danger ws-btn-sm"
                          onClick={() => handleDeleteToken(t.id)}
                        >
                          Revoke
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Ready-to-copy JSON configuration with Zero-Clone npx options */}
              <div style={{ marginTop: 24, borderTop: '1px solid var(--line)', paddingTop: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>Zero-Clone MCP Configuration</span>
                      <span style={{ fontSize: '0.7rem', color: '#34d399', background: 'rgba(52, 211, 153, 0.1)', border: '1px solid #284435', padding: '2px 8px', borderRadius: 12, fontFamily: 'monospace' }}>
                        Zero Git Clone Required
                      </span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: 2 }}>
                      Connect Baton's memory daemon over stdio via npx directly from GitHub without cloning or downloading code.
                    </div>
                  </div>

                  <button
                    className="ws-btn ws-btn-primary ws-btn-sm"
                    disabled={!buildMcpSnippet(mcpClientTab)}
                    onClick={() => {
                      const textToCopy = buildMcpSnippet(mcpClientTab);
                      if (!textToCopy) return;
                      navigator.clipboard?.writeText(textToCopy);
                      setCopiedMcpSnippet(true);
                      setTimeout(() => setCopiedMcpSnippet(false), 2000);
                    }}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <span>{copiedMcpSnippet ? '✓ Copied!' : 'Copy Configuration'}</span>
                  </button>
                </div>

                {/* Client Selector Tabs */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                  {[
                    { id: 'cursor', label: 'Cursor (.cursor/mcp.json)' },
                    { id: 'claude_desktop', label: 'Claude Desktop' },
                    { id: 'claude_cli', label: 'Claude Code (1-Click CLI)' },
                    { id: 'antigravity', label: 'Antigravity / Windsurf' },
                    { id: 'local_node', label: 'Local Clone (node)' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setMcpClientTab(tab.id)}
                      style={{
                        background: mcpClientTab === tab.id ? '#1e2430' : '#14161a',
                        color: mcpClientTab === tab.id ? '#34d399' : '#8f96a3',
                        border: `1px solid ${mcpClientTab === tab.id ? '#2a4d3d' : 'var(--line)'}`,
                        borderRadius: 6,
                        padding: '6px 12px',
                        fontSize: '0.78rem',
                        fontWeight: mcpClientTab === tab.id ? 600 : 400,
                        cursor: 'pointer',
                        fontFamily: 'monospace'
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Configuration Code Box */}
                <div className="ws-code-snippet" style={{ position: 'relative' }}>
                  <pre style={{ margin: 0, overflowX: 'auto', fontSize: '0.82rem', lineHeight: 1.6 }}>
                    {buildMcpSnippet(mcpClientTab) || 'Connect a repository first (GitHub tab) to generate an MCP configuration.'}
                  </pre>
                </div>

                {/* Setup Tip */}
                <div style={{ fontSize: '0.76rem', color: '#7e8594', marginTop: 8, fontFamily: 'monospace' }}>
                  {mcpClientTab === 'cursor' && '💡 Paste into your project root as .cursor/mcp.json or in Cursor Settings → MCP → Add New Server.'}
                  {mcpClientTab === 'claude_desktop' && '💡 Paste into claude_desktop_config.json (Claude Settings → Developer → Edit Config).'}
                  {mcpClientTab === 'claude_cli' && '💡 Paste this single command directly into your terminal. Zero files to edit.'}
                  {mcpClientTab === 'antigravity' && '💡 Paste into .antigravity/mcp.json in your workspace root.'}
                  {mcpClientTab === 'local_node' && '💡 For developers working directly inside the cloned BATON repository.'}
                </div>

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
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: TASKS & ACTION ITEMS */}
        {activeTab === 'tasks' && (
          <div>
            <div className="ws-filter-bar">
              <div className="ws-card-title" style={{ margin: 0 }}>
                Handoff Tasks & Operational Action Items
              </div>
              <button className="ws-btn ws-btn-primary" onClick={() => setShowTaskModal(true)}>
                + New Task
              </button>
            </div>

            {tasks.length === 0 ? (
              <div className="ws-card ws-empty-state">
                <div className="ws-empty-icon">📋</div>
                <div className="ws-empty-title">No pending handover tasks</div>
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
                          style={{ fontSize: '0.75rem', padding: '3px 8px' }}
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
                              placeholder="Write a comment..."
                              value={newCommentText}
                              onChange={e => setNewCommentText(e.target.value)}
                              style={{ flex: 1, padding: '6px 10px', fontSize: '0.8rem' }}
                            />
                            <button type="submit" className="ws-btn ws-btn-primary ws-btn-sm">
                              Reply
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
                <div className="ws-card-title">Engineering Handovers</div>
                <button
                  className="ws-btn ws-btn-primary ws-btn-sm"
                  onClick={() => setShowStartHandoverModal(true)}
                >
                  + Initiate Handover
                </button>
              </div>

              {handovers.length === 0 ? (
                <div className="ws-empty-state">
                  <div className="ws-empty-icon">🤝</div>
                  <div className="ws-empty-title">No active handovers</div>
                  <div>Initiate an evidence-based handover to capture and verify knowledge transfer.</div>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {handovers.map(h => (
                    <button
                      key={h.id}
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
                      <button className="ws-btn ws-btn-sm" onClick={handleGenerateHandover} disabled={hv?.status !== 'draft'}>
                        ⚡ Compile Claims
                      </button>
                      {isAdmin && (
                        <button
                          className="ws-btn ws-btn-primary ws-btn-sm"
                          onClick={handleApproveHandover}
                          disabled={hv?.status !== 'draft' || openConflicts > 0}
                          title={openConflicts > 0 ? 'Resolve every conflict before approving' : undefined}
                        >
                          ✓ Approve Handover
                        </button>
                      )}
                      {myUserId && myUserId === hv?.incoming_id && (
                        <button
                          className="ws-btn ws-btn-sm"
                          onClick={handleAcknowledgeHandover}
                          disabled={hv?.status !== 'approved' || Boolean(hv?.acknowledged_at)}
                        >
                          🤝 Acknowledge Transfer
                        </button>
                      )}
                      <button type="button" className="ws-btn ws-btn-sm" onClick={() => setPacketId(hv.id)}>
                        Open packet
                      </button>
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

