import React from 'react';
import { FUNCTION_ROLES } from '../../../server/audience.js';
import { McpConfig } from './McpConfig';
import { SettingsCard } from './SettingsCard';

export function TeamTab({
  boot,
  handleDeleteToken,
  handleSetFunctionRole,
  handleSimulateMcp,
  handleToggleOffboarding,
  isAdmin,
  isBusy,
  isDemo,
  members,
  mode,
  newestToken,
  notify,
  orgs,
  refreshOrgState,
  repositories,
  selectedOrg,
  selectedOrgId,
  setOrgs,
  setShowInviteModal,
  setShowTokenModal,
  setSimDecisionText,
  setSimReasonText,
  simDecisionText,
  simReasonText,
  simResult,
  simRunning,
  sources,
  tokens,
}) {
  return (
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
  );
}

export default TeamTab;
