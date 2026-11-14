import React from 'react';

export function MemoryTab({
  filteredSources,
  handleDeleteMemory,
  isBusy,
  memoryFilter,
  memorySearch,
  setMemoryFilter,
  setMemorySearch,
  setShowMemoryModal,
  sources,
}) {
  return (
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
  );
}

export default MemoryTab;
