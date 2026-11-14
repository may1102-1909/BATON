import React, { useEffect, useState } from 'react';
import * as api from '../../lib/api.js';

const SCOPES = [
  { id: 'sources', label: 'Synced and captured records', hint: 'Removes commits, pull requests, memories and decisions. Tasks and handovers are kept.' },
  { id: 'all', label: 'Everything', hint: 'Also removes tasks and handovers. Members, tokens and connected repositories are kept.' },
];

/** Admin-only workspace management: rename, clear data, delete. Never rendered in demo mode. */
export function SettingsCard({ org, notify, onRenamed, onCleared, onDeleted }) {
  const [name, setName] = useState(org.name);
  const [renaming, setRenaming] = useState(false);
  const [scope, setScope] = useState('sources');
  const [clearConfirm, setClearConfirm] = useState('');
  const [clearing, setClearing] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setName(org.name);
    setClearConfirm('');
    setDeleteConfirm('');
  }, [org.id, org.name]);

  async function rename(event) {
    event.preventDefault();
    const next = name.trim();
    if (!next || next === org.name) return;
    setRenaming(true);
    try {
      const res = await api.renameOrg(org.id, next);
      onRenamed?.(res?.organization || { ...org, name: next });
      notify('Workspace renamed.', 'success');
    } catch (err) {
      notify(`Rename failed: ${err.message}`);
    } finally {
      setRenaming(false);
    }
  }

  async function clearData(event) {
    event.preventDefault();
    setClearing(true);
    try {
      const res = await api.resetOrg(org.id, clearConfirm, scope);
      const removed = res?.removed || {};
      setClearConfirm('');
      await onCleared?.();
      notify(`Workspace data cleared: ${removed.sources ?? 0} records, ${removed.tasks ?? 0} tasks, ${removed.handovers ?? 0} handovers removed.`, 'success');
    } catch (err) {
      notify(`Clear failed: ${err.message}`);
    } finally {
      setClearing(false);
    }
  }

  async function deleteWorkspace(event) {
    event.preventDefault();
    setDeleting(true);
    try {
      await api.deleteOrg(org.id, deleteConfirm);
      setDeleteConfirm('');
      await onDeleted?.();
      notify('Workspace deleted.', 'success');
    } catch (err) {
      notify(`Delete failed: ${err.message}`);
    } finally {
      setDeleting(false);
    }
  }

  const busy = renaming || clearing || deleting;

  return (
    <section className="ws-card" aria-labelledby="ws-settings-title">
      <div className="ws-card-header">
        <h2 id="ws-settings-title" className="ws-card-title">Workspace settings</h2>
        <span className="ws-badge ws-badge-muted">Admin only</span>
      </div>

      <form onSubmit={rename} className="ws-settings-block">
        <label className="ws-form-label" htmlFor="ws-settings-name">Workspace name</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            id="ws-settings-name"
            className="ws-input"
            style={{ flex: 1, minWidth: 220 }}
            value={name}
            maxLength={120}
            onChange={e => setName(e.target.value)}
            required
          />
          <button type="submit" className="ws-btn ws-btn-primary" disabled={busy || !name.trim() || name.trim() === org.name}>
            {renaming ? 'Saving…' : 'Rename'}
          </button>
        </div>
      </form>

      <form onSubmit={clearData} className="ws-settings-block ws-danger-zone">
        <div className="ws-settings-title">Clear workspace data</div>
        <fieldset className="ws-scope-fieldset">
          <legend className="ws-form-label">What to remove</legend>
          {SCOPES.map(option => (
            <label key={option.id} className="ws-scope-option">
              <input type="radio" name="ws-clear-scope" value={option.id} checked={scope === option.id} onChange={() => setScope(option.id)} />
              <span><strong>{option.label}</strong><span className="ws-muted"> · {option.hint}</span></span>
            </label>
          ))}
        </fieldset>
        <label className="ws-form-label" htmlFor="ws-clear-confirm">Type the workspace name “{org.name}” to confirm</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input id="ws-clear-confirm" className="ws-input" style={{ flex: 1, minWidth: 220 }} value={clearConfirm} onChange={e => setClearConfirm(e.target.value)} autoComplete="off" />
          <button type="submit" className="ws-btn ws-btn-danger" disabled={busy || clearConfirm !== org.name}>
            {clearing ? 'Clearing…' : 'Clear data'}
          </button>
        </div>
      </form>

      <form onSubmit={deleteWorkspace} className="ws-settings-block ws-danger-zone">
        <div className="ws-settings-title">Delete workspace</div>
        <div className="ws-muted" style={{ marginBottom: 8 }}>Permanently deletes this workspace with its members, repositories, records and handovers. This cannot be undone.</div>
        <label className="ws-form-label" htmlFor="ws-delete-confirm">Type the workspace name “{org.name}” to confirm</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input id="ws-delete-confirm" className="ws-input" style={{ flex: 1, minWidth: 220 }} value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} autoComplete="off" />
          <button type="submit" className="ws-btn ws-btn-danger" disabled={busy || deleteConfirm !== org.name}>
            {deleting ? 'Deleting…' : 'Delete workspace'}
          </button>
        </div>
      </form>
    </section>
  );
}

export default SettingsCard;
