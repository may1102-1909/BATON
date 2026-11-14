import React from 'react';
import { ContributionMatrix } from '../HandoverParts';
import { OnboardingChecklist } from './OnboardingChecklist';
import { SystemStatus } from './SystemStatus';

export function OverviewTab({
  blockersCount,
  checklistItems,
  commitsCount,
  decisionsCount,
  handovers,
  hasGithubData,
  health,
  hiddenRiskCount,
  isAdmin,
  isDemo,
  repositories,
  riskAlerts,
  riskCounts,
  riskRepoId,
  risks,
  selectedOrgId,
  setActiveTab,
  setRiskRepoId,
  setShowAllAlerts,
  showAllAlerts,
  startHandoverFor,
  tokens,
  visibleBusFactor,
  visibleRiskItems,
}) {
  return (
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
  );
}

export default OverviewTab;
