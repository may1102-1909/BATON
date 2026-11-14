import React from 'react';

export function TasksTab({
  activeTaskIdForComments,
  handleAddTaskComment,
  handleUpdateTaskStatus,
  isBusy,
  memberLabel,
  newCommentText,
  setActiveTaskIdForComments,
  setNewCommentText,
  setShowTaskModal,
  tasks,
}) {
  return (
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
  );
}

export default TasksTab;
