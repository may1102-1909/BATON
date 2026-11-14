import React, { useState } from 'react';
import * as api from '../../lib/api.js';
import { copyText } from '../../lib/download.js';
import { Modal } from './Modal';

const memberName = m => m.name || m.github_login || m.user_id;

function FormError({ message }) {
  return message ? <div className="ws-notice ws-notice-error" role="alert" style={{ marginTop: 12 }}><span>{message}</span></div> : null;
}

function Actions({ onCancel, busy, submitLabel, busyLabel, disabled }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
      <button type="button" className="ws-btn" onClick={onCancel} disabled={busy}>Cancel</button>
      <button type="submit" className="ws-btn ws-btn-primary" disabled={busy || disabled}>{busy ? busyLabel : submitLabel}</button>
    </div>
  );
}

// Each modal owns its form state, shows a pending state while the request runs and an inline error if it fails.
function useSubmit(action) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event) {
    event?.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, submit };
}

export function CreateOrgModal({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const { busy, error, submit } = useSubmit(async () => {
    const res = await api.createOrg(name.trim());
    await onCreated(res);
  });
  return (
    <Modal title="Create new organization" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="ws-form-group">
          <label className="ws-form-label" htmlFor="ws-new-org-name">Organization name</label>
          <input id="ws-new-org-name" className="ws-input" placeholder="e.g. Acme Corp Engineering" value={name} maxLength={120} onChange={e => setName(e.target.value)} required />
        </div>
        <FormError message={error} />
        <Actions onCancel={onClose} busy={busy} submitLabel="Create organization" busyLabel="Creating…" disabled={!name.trim()} />
      </form>
    </Modal>
  );
}

export function InviteModal({ orgId, onClose, notify }) {
  const [role, setRole] = useState('member');
  const [email, setEmail] = useState('');
  const [link, setLink] = useState('');
  const [copied, setCopied] = useState(false);
  const { busy, error, submit } = useSubmit(async () => {
    const res = await api.createInvite(orgId, role, email.trim() || null);
    setLink(`${window.location.origin}/auth?invite=${res.token}`);
  });

  async function copy() {
    if (await copyText(link)) setCopied(true);
    else notify('Could not copy automatically. Select the link and copy it manually.');
  }

  return (
    <Modal title="Invite team member" onClose={onClose}>
      {link ? (
        <div>
          <div style={{ color: 'var(--green)', fontWeight: 600, marginBottom: 8 }}>✓ Invite link created</div>
          <div className="ws-muted" style={{ marginBottom: 8 }}>
            Send this link to your teammate. It can be used once{email.trim() ? ` and only by ${email.trim()}` : ''}.
          </div>
          <label className="ws-form-label" htmlFor="ws-invite-link">Invite link</label>
          <input id="ws-invite-link" className="ws-input" readOnly value={link} onFocus={e => e.target.select()} style={{ width: '100%', marginBottom: 14, fontFamily: 'monospace', fontSize: '0.8rem' }} />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="ws-btn" onClick={onClose}>Close</button>
            <button type="button" className="ws-btn ws-btn-primary" onClick={copy}>{copied ? '✓ Copied' : 'Copy link'}</button>
          </div>
          <div role="status" className="sr-only">{copied ? 'Invite link copied to clipboard' : ''}</div>
        </div>
      ) : (
        <form onSubmit={submit}>
          <div className="ws-form-group">
            <label className="ws-form-label" htmlFor="ws-invite-email">Email address (optional, restricts the invite to this email)</label>
            <input id="ws-invite-email" type="email" className="ws-input" placeholder="engineer@company.com" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="ws-form-group">
            <label className="ws-form-label" htmlFor="ws-invite-role">Role</label>
            <select id="ws-invite-role" className="ws-org-select" value={role} onChange={e => setRole(e.target.value)}>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <FormError message={error} />
          <Actions onCancel={onClose} busy={busy} submitLabel="Generate invite" busyLabel="Generating…" />
        </form>
      )}
    </Modal>
  );
}

export function TokenModal({ orgId, onClose, onCreated, notify }) {
  const [name, setName] = useState('');
  const [token, setToken] = useState('');
  const [copied, setCopied] = useState(false);
  const { busy, error, submit } = useSubmit(async () => {
    const res = await api.createToken(orgId, name.trim());
    setToken(res.token);
    onCreated(res.token);
  });

  async function copy() {
    if (await copyText(token)) setCopied(true);
    else notify('Could not copy automatically. Select the token and copy it manually.');
  }

  return (
    <Modal title="Generate Baton MCP token" onClose={onClose}>
      {token ? (
        <div>
          <div role="note" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: 6, padding: 12, marginBottom: 14, color: '#fca5a5', fontSize: '0.85rem' }}>
            <strong>Do not share:</strong> copy this token now. For your security it will not be shown again.
          </div>
          <label className="ws-form-label" htmlFor="ws-token-secret">New token</label>
          <input id="ws-token-secret" className="ws-input" readOnly value={token} onFocus={e => e.target.select()} style={{ width: '100%', marginBottom: 14, fontFamily: 'monospace', fontSize: '0.8rem', color: '#34d399' }} />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="ws-btn" onClick={onClose}>Close</button>
            <button type="button" className="ws-btn ws-btn-primary" onClick={copy}>{copied ? '✓ Copied' : 'Copy token'}</button>
          </div>
          <div role="status" className="sr-only">{copied ? 'Token copied to clipboard' : ''}</div>
        </div>
      ) : (
        <form onSubmit={submit}>
          <div className="ws-form-group">
            <label className="ws-form-label" htmlFor="ws-token-name">Token name / client description</label>
            <input id="ws-token-name" className="ws-input" placeholder="e.g. Cursor work laptop, Claude CLI" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <FormError message={error} />
          <Actions onCancel={onClose} busy={busy} submitLabel="Create token" busyLabel="Creating…" disabled={!name.trim()} />
        </form>
      )}
    </Modal>
  );
}

export function MemoryModal({ orgId, onClose, onSaved }) {
  const [type, setType] = useState('decision');
  const [content, setContent] = useState('');
  const [metadata, setMetadata] = useState('');
  const [visibility, setVisibility] = useState('team');
  const { busy, error, submit } = useSubmit(async () => {
    let meta = {};
    if (metadata.trim()) {
      try {
        meta = JSON.parse(metadata);
      } catch {
        meta = { notes: metadata };
      }
    }
    await api.createMemory(orgId, { type, content: content.trim(), metadata: meta, visibility });
    await onSaved();
  });
  return (
    <Modal title="Log context and reasoning" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="ws-form-group">
          <label className="ws-form-label" htmlFor="ws-memory-type">Type</label>
          <select id="ws-memory-type" className="ws-org-select" value={type} onChange={e => setType(e.target.value)}>
            <option value="decision">Architectural decision</option>
            <option value="blocker">Blocker / unfinished task</option>
            <option value="note">Operational note</option>
          </select>
        </div>
        <div className="ws-form-group">
          <label className="ws-form-label" htmlFor="ws-memory-content">Content / decision summary</label>
          <textarea id="ws-memory-content" className="ws-input" rows={3} placeholder="Describe what was decided, why, or what is blocking…" value={content} onChange={e => setContent(e.target.value)} required />
        </div>
        <div className="ws-form-group">
          <label className="ws-form-label" htmlFor="ws-memory-meta">Metadata (JSON or notes, optional)</label>
          <textarea id="ws-memory-meta" className="ws-input" rows={2} placeholder='{"reason": "Faster builds", "files_affected": ["vite.config.js"]}' value={metadata} onChange={e => setMetadata(e.target.value)} />
        </div>
        <div className="ws-form-group">
          <label className="ws-form-label" htmlFor="ws-memory-visibility">Visibility</label>
          <select id="ws-memory-visibility" className="ws-org-select" value={visibility} onChange={e => setVisibility(e.target.value)}>
            <option value="team">Team (visible to the workspace)</option>
            <option value="admin">Admin only</option>
          </select>
        </div>
        <FormError message={error} />
        <Actions onCancel={onClose} busy={busy} submitLabel="Save memory" busyLabel="Saving…" disabled={!content.trim()} />
      </form>
    </Modal>
  );
}

export function TaskModal({ orgId, members, onClose, onSaved }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignee, setAssignee] = useState('');
  const [due, setDue] = useState('');
  const { busy, error, submit } = useSubmit(async () => {
    await api.createTask(orgId, { title: title.trim(), description: description.trim(), assignee_id: assignee || null, due_at: due || null });
    await onSaved();
  });
  return (
    <Modal title="Create handover task" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="ws-form-group">
          <label className="ws-form-label" htmlFor="ws-task-title">Task title</label>
          <input id="ws-task-title" className="ws-input" placeholder="e.g. Verify webhook replay protection" value={title} onChange={e => setTitle(e.target.value)} required />
        </div>
        <div className="ws-form-group">
          <label className="ws-form-label" htmlFor="ws-task-desc">Description</label>
          <textarea id="ws-task-desc" className="ws-input" rows={3} placeholder="Details and expected acceptance criteria…" value={description} onChange={e => setDescription(e.target.value)} />
        </div>
        <div className="ws-form-group">
          <label className="ws-form-label" htmlFor="ws-task-assignee">Assignee</label>
          <select id="ws-task-assignee" className="ws-org-select" value={assignee} onChange={e => setAssignee(e.target.value)}>
            <option value="">Unassigned</option>
            {members.map(m => <option key={m.id} value={m.user_id}>{memberName(m)}</option>)}
          </select>
        </div>
        <div className="ws-form-group">
          <label className="ws-form-label" htmlFor="ws-task-due">Due date</label>
          <input id="ws-task-due" type="date" className="ws-input" value={due} onChange={e => setDue(e.target.value)} />
        </div>
        <FormError message={error} />
        <Actions onCancel={onClose} busy={busy} submitLabel="Create task" busyLabel="Creating…" disabled={!title.trim()} />
      </form>
    </Modal>
  );
}

export function StartHandoverModal({ orgId, members, initialLeaverId = '', onClose, onStarted }) {
  const [leaverId, setLeaverId] = useState(initialLeaverId);
  const [incomingId, setIncomingId] = useState('');
  const { busy, error, submit } = useSubmit(async () => {
    const res = await api.startHandover(orgId, leaverId, incomingId);
    await onStarted(res);
  });
  return (
    <Modal title="Initiate handover" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="ws-form-group">
          <label className="ws-form-label" htmlFor="ws-handover-leaver">Departing engineer (leaver)</label>
          <select id="ws-handover-leaver" className="ws-org-select" value={leaverId} onChange={e => setLeaverId(e.target.value)} required>
            <option value="">Select leaver…</option>
            {members.map(m => <option key={m.id} value={m.user_id}>{memberName(m)} {m.offboarding ? '(flagged for offboarding)' : ''}</option>)}
          </select>
        </div>
        <div className="ws-form-group">
          <label className="ws-form-label" htmlFor="ws-handover-incoming">Incoming engineer</label>
          <select id="ws-handover-incoming" className="ws-org-select" value={incomingId} onChange={e => setIncomingId(e.target.value)} required>
            <option value="">Select incoming engineer…</option>
            {members.map(m => <option key={m.id} value={m.user_id}>{memberName(m)}</option>)}
          </select>
        </div>
        <FormError message={error} />
        <Actions onCancel={onClose} busy={busy} submitLabel="Start handover" busyLabel="Starting…" disabled={!leaverId || !incomingId} />
      </form>
    </Modal>
  );
}
