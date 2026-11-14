import React from 'react';
import { Citations, ClaimsView, ConflictsPanel, RiskBadge, VersionHistory } from '../HandoverParts';

export function HandoversTab({
  activeHandoverDetail,
  answerText,
  answeringQuestionId,
  handleAcknowledgeHandover,
  handleAnswerQuestion,
  handleApproveHandover,
  handleAskQuestion,
  handleClaimReview,
  handleEditClaim,
  handleExportHandover,
  handleGenerateHandover,
  handleResolveConflict,
  handleSkipQuestion,
  handovers,
  hv,
  isAdmin,
  isBusy,
  loadHandover,
  loadingHandoverId,
  memberLabel,
  myUserId,
  notify,
  openConflicts,
  qaLoading,
  qaQuestion,
  qaResult,
  setAnswerText,
  setAnsweringQuestionId,
  setPacketId,
  setQaQuestion,
  sources,
  startHandoverFor,
}) {
  return (
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
                        Exit interview questions (knowledge gaps)
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
                                      <button type="submit" className="ws-btn ws-btn-primary ws-btn-sm" disabled={isBusy("handover") || !answerText.trim()}>
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
                                        disabled={isBusy("handover")}
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
                    <h2 className="ws-card-title">Evidence-backed claims</h2>
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
                    <h2 className="ws-card-title">Ask a question (cited answers)</h2>
                    <span className="ws-badge ws-badge-verified">Answers cite approved sources only</span>
                  </div>

                  <form onSubmit={handleAskQuestion} style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                    <input
                      type="text"
                      className="ws-input"
                      aria-label="Ask a question about this handover"
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
                    <h2 className="ws-card-title">Version history</h2>
                  </div>
                  <VersionHistory handoverId={hv.id} notify={notify} refreshKey={hv.version} />
                </div>
              </div>
            )}
          </div>
  );
}

export default HandoversTab;
