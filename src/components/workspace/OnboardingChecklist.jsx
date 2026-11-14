import React, { useEffect, useState } from 'react';

const storageKey = orgId => `baton_checklist_dismissed_${orgId}`;

/** Builds checklist items from real workspace state only. */
export function buildChecklist({ members, repositories, tokens, sources, handovers }) {
  const memories = sources.filter(s => s.type === 'decision' || s.type === 'blocker' || s.type === 'note');
  return [
    { id: 'team', label: 'Create your team', done: true, tab: 'team' },
    { id: 'invite', label: 'Invite a teammate', done: members.length > 1, tab: 'team' },
    { id: 'github', label: 'Connect a GitHub repository', done: repositories.length > 0, tab: 'github' },
    { id: 'sync', label: 'Sync a repository', done: repositories.some(r => r.last_synced_at), tab: 'github' },
    { id: 'token', label: 'Create an MCP token', done: tokens.length > 0, tab: 'team' },
    { id: 'memory', label: 'Capture your first memory', done: memories.length > 0, tab: 'memory' },
    { id: 'handover', label: 'Start a handover', done: handovers.length > 0, tab: 'handovers' },
  ];
}

export function OnboardingChecklist({ orgId, items, onGo }) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(storageKey(orgId)) === '1');
    } catch {
      setDismissed(false);
    }
  }, [orgId]);

  const doneCount = items.filter(item => item.done).length;
  if (dismissed || doneCount === items.length) return null;

  function dismiss() {
    try {
      localStorage.setItem(storageKey(orgId), '1');
    } catch {}
    setDismissed(true);
  }

  return (
    <section className="ws-card ws-checklist" aria-labelledby="ws-checklist-title">
      <div className="ws-card-header">
        <h2 id="ws-checklist-title" className="ws-card-title">Get started · {doneCount} of {items.length} done</h2>
        <button type="button" className="ws-btn ws-btn-sm" onClick={dismiss}>Dismiss</button>
      </div>
      <ul className="ws-checklist-list">
        {items.map(item => (
          <li key={item.id} className="ws-checklist-item">
            <span className={`ws-badge ${item.done ? 'ws-badge-verified' : 'ws-badge-muted'}`}>{item.done ? 'Done' : 'To do'}</span>
            <span className={item.done ? 'ws-muted' : undefined} style={item.done ? { textDecoration: 'line-through' } : undefined}>{item.label}</span>
            {!item.done && (
              <button type="button" className="ws-btn ws-btn-sm" onClick={() => onGo(item.tab)}>Go to {item.tab === 'team' ? 'Team & Tokens' : item.tab === 'memory' ? 'Memory & Decisions' : item.tab === 'github' ? 'GitHub' : 'Handovers'}</button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default OnboardingChecklist;
