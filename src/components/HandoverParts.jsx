import React, { useEffect, useState } from 'react';
import * as api from '../lib/api.js';

const SECTION_LABELS = {
  decisions: 'Decisions',
  unfinished_work: 'Unfinished work',
  risks: 'Risks',
  dependencies: 'Dependencies',
  next_actions: 'Next actions',
};

export const sectionLabel = section => SECTION_LABELS[section] || String(section || 'Other').replace(/_/g, ' ');

const typeLabel = type => {
  const text = String(type || 'source').replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
};

function shortTitle(source) {
  const line = String(source?.content ?? '').split('\n')[0].trim();
  return line.length > 40 ? `${line.slice(0, 40)}…` : line;
}

const dateOnly = value => (value ? String(value).slice(0, 10) : '');

export function sourceMap(sources) {
  return new Map((sources || []).map(source => [source.id, source]));
}

export function Citations({ ids, sources }) {
  const byId = sources instanceof Map ? sources : sourceMap(sources);
  const list = Array.isArray(ids) ? ids : [];
  if (list.length === 0) return null;
  return (
    <div className="ws-chips" aria-label="Citations">
      {list.map(id => {
        const source = byId.get(id);
        const label = source ? `${typeLabel(source.type)}${shortTitle(source) ? `: ${shortTitle(source)}` : ''}` : `Source ${String(id).slice(0, 8)}`;
        const detail = source ? `${typeLabel(source.type)}${source.created_at ? ` · ${dateOnly(source.created_at)}` : ''}\n${String(source.content ?? '').slice(0, 400)}` : 'Source not visible to you';
        return <span key={id} className="ws-chip" title={detail}>{label}</span>;
      })}
    </div>
  );
}

export function RiskBadge({ question }) {
  if (typeof question?.risk_score !== 'number') return null;
  const label = question.risk_label || (question.risk_score >= 60 ? 'high' : question.risk_score >= 30 ? 'medium' : 'low');
  const tone = label === 'high' ? 'ws-badge-danger' : label === 'medium' ? 'ws-badge-inferred' : 'ws-badge-muted';
  return <span className={`ws-badge ${tone}`}>{label} risk · score {question.risk_score}</span>;
}

function ConflictCard({ conflict, canResolve, onResolve, nameOf }) {
  const [text, setText] = useState('');
  const [chosen, setChosen] = useState('');
  const [busy, setBusy] = useState(false);
  const sides = conflict.sides || [];
  const chosenSide = sides.find(side => side.source_id === conflict.chosen_source_id);

  async function submit(e) {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      await onResolve(conflict.claim_id, { resolution: text.trim(), chosenSourceId: chosen });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ws-conflict-card">
      <div style={{ fontWeight: 600, color: '#fff', fontSize: '0.9rem' }}>{conflict.summary || conflict.subject}</div>
      <div className="ws-conflict-sides">
        {sides.map(side => (
          <div key={side.source_id} className="ws-conflict-side">
            <div className="ws-conflict-side-head">
              <span>{side.label || 'Source'}</span>
              <span>{side.date || 'No date'}</span>
            </div>
            <div style={{ color: '#cbd5e1' }}>{side.excerpt}</div>
          </div>
        ))}
      </div>
      {conflict.resolved ? (
        <div className="ws-notice ws-notice-success" style={{ margin: 0 }}>
          <span>
            Resolved{conflict.resolved_by ? ` by ${nameOf(conflict.resolved_by)}` : ''}
            {chosenSide ? ` in favour of ${chosenSide.label || 'the chosen source'}${chosenSide.date ? ` (${chosenSide.date})` : ''}` : ''}
            {conflict.resolution ? `: ${conflict.resolution}` : '.'}
          </span>
        </div>
      ) : canResolve ? (
        <form onSubmit={submit} aria-label="Resolve conflict">
          <fieldset style={{ border: 0, padding: 0, margin: '0 0 8px' }}>
            <legend className="ws-muted">Which side is right? (optional)</legend>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: '0.82rem' }}>
              {sides.map(side => (
                <label key={side.source_id}>
                  <input type="radio" name={`conflict-${conflict.claim_id}`} checked={chosen === side.source_id} onChange={() => setChosen(side.source_id)} />{' '}
                  {side.label}{side.date ? ` (${side.date})` : ''}
                </label>
              ))}
              <label>
                <input type="radio" name={`conflict-${conflict.claim_id}`} checked={chosen === ''} onChange={() => setChosen('')} /> Neither
              </label>
            </div>
          </fieldset>
          <textarea
            className="ws-input"
            rows={2}
            maxLength={2000}
            style={{ width: '100%', marginBottom: 6 }}
            aria-label="Resolution explanation"
            placeholder="Explain which is correct and why it changed"
            value={text}
            onChange={e => setText(e.target.value)}
          />
          <button type="submit" className="ws-btn ws-btn-primary ws-btn-sm" disabled={busy || !text.trim()}>
            {busy ? 'Resolving…' : 'Resolve conflict'}
          </button>
        </form>
      ) : (
        <div className="ws-muted">Awaiting resolution by an admin.</div>
      )}
    </div>
  );
}

export function ConflictsPanel({ conflicts, canResolve, onResolve, nameOf = id => id }) {
  const list = Array.isArray(conflicts) ? conflicts : [];
  if (list.length === 0) return null;
  const open = list.filter(item => !item.resolved).length;
  return (
    <section className="ws-conflict-panel" aria-label="Conflicts">
      <div className="ws-conflict-title">
        {open > 0 ? `${open} unresolved conflict${open === 1 ? '' : 's'}` : 'All conflicts resolved'}
      </div>
      <div className="ws-conflict-note">
        Sources disagree. Baton does not pick a winner; {open > 0 ? 'an admin must decide.' : 'the decision is recorded below.'}
      </div>
      {list.map(conflict => (
        <ConflictCard key={conflict.claim_id} conflict={conflict} canResolve={canResolve} onResolve={onResolve} nameOf={nameOf} />
      ))}
    </section>
  );
}

function ClaimItem({ claim, sources, editable, onReview, onEdit }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(claim.text || '');
  const unresolved = claim.conflict && !claim.conflict.resolved;
  const tone = claim.confidence === 'verified' ? 'ws-badge-verified' : claim.confidence === 'conflicting' ? 'ws-badge-danger' : 'ws-badge-inferred';

  async function save(e) {
    e.preventDefault();
    if (!draft.trim()) return;
    const ok = await onEdit(claim.id, draft.trim());
    if (ok !== false) setEditing(false);
  }

  return (
    <div style={{ background: '#131417', border: '1px solid var(--line)', borderRadius: 6, padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span className={`ws-badge ${tone}`}>{claim.confidence || 'inferred'}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--muted)', textTransform: 'uppercase' }}>{sectionLabel(claim.section)}</span>
          {claim.status && <span className="ws-badge ws-badge-muted">{claim.status}</span>}
        </div>
        {editable && (
          <div style={{ display: 'flex', gap: 6 }}>
            {!unresolved && (
              <button
                type="button"
                className="ws-btn ws-btn-sm"
                aria-label={`Approve claim: ${String(claim.text).slice(0, 60)}`}
                aria-pressed={['approved', 'edited'].includes(claim.status)}
                style={{ background: claim.status === 'approved' ? 'rgba(52, 211, 153, 0.2)' : 'transparent', color: claim.status === 'approved' ? 'var(--green)' : 'inherit' }}
                onClick={() => onReview(claim.id, 'approved')}
              >
                Approve
              </button>
            )}
            {!unresolved && (
              <button type="button" className="ws-btn ws-btn-sm" aria-label={`Edit claim: ${String(claim.text).slice(0, 60)}`} onClick={() => { setDraft(claim.text || ''); setEditing(true); }}>
                Edit
              </button>
            )}
            <button
              type="button"
              className="ws-btn ws-btn-sm"
              aria-label={`Reject claim: ${String(claim.text).slice(0, 60)}`}
              style={{ background: claim.status === 'rejected' ? 'rgba(239, 68, 68, 0.2)' : 'transparent', color: claim.status === 'rejected' ? '#ef4444' : 'inherit' }}
              onClick={() => onReview(claim.id, 'rejected')}
            >
              Reject
            </button>
          </div>
        )}
      </div>
      {editing ? (
        <form onSubmit={save} style={{ marginBottom: 8 }}>
          <textarea className="ws-input" rows={3} style={{ width: '100%', marginBottom: 6 }} aria-label="Claim text" value={draft} onChange={e => setDraft(e.target.value)} />
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="submit" className="ws-btn ws-btn-primary ws-btn-sm" disabled={!draft.trim()}>Save and approve</button>
            <button type="button" className="ws-btn ws-btn-sm" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </form>
      ) : (
        <div style={{ fontSize: '0.9rem', color: '#fff', marginBottom: 8 }}>{claim.text}</div>
      )}
      {unresolved && editable && <div className="ws-muted" style={{ marginBottom: 6 }}>Resolve the conflict above before approving this claim.</div>}
      {claim.note && <div className="ws-muted" style={{ marginBottom: 6 }}>{claim.note}</div>}
      <Citations ids={claim.source_ids} sources={sources} />
    </div>
  );
}

export function ClaimsView({ claims, sources, editable = false, grouped = false, onReview, onEdit }) {
  const byId = sourceMap(sources);
  const list = (claims || []).filter(claim => claim.status !== 'rejected' || editable);
  const render = claim => <ClaimItem key={claim.id} claim={claim} sources={byId} editable={editable} onReview={onReview} onEdit={onEdit} />;
  if (!grouped) return <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{list.map(render)}</div>;
  const sections = [...new Set(list.map(claim => claim.section || 'other'))];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {sections.map(section => (
        <section key={section} aria-label={sectionLabel(section)}>
          <h3 style={{ fontSize: '0.95rem', color: '#fff', margin: '0 0 8px' }}>{sectionLabel(section)}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{list.filter(claim => (claim.section || 'other') === section).map(render)}</div>
        </section>
      ))}
    </div>
  );
}

const FIELD_LABELS = { text: 'Text', section: 'Section', status: 'Status', confidence: 'Confidence', source_ids: 'Sources' };
const fieldValue = (claim, field) => {
  const value = claim?.[field];
  if (Array.isArray(value)) return value.length ? `${value.length} source${value.length === 1 ? '' : 's'}` : 'none';
  return value == null || value === '' ? 'none' : String(value);
};

export function VersionHistory({ handoverId, notify, refreshKey }) {
  const [versions, setVersions] = useState(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [diff, setDiff] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    setDiff(null);
    api.listVersions(handoverId).then(res => {
      if (!live) return;
      const list = Array.isArray(res?.versions) ? res.versions : [];
      setVersions(list);
      setTo(list[list.length - 1]?.id || '');
      setFrom(list.length > 1 ? list[list.length - 2].id : list[0]?.id || '');
    }).catch(err => {
      if (live) { setVersions([]); notify?.(err.message); }
    });
    return () => { live = false; };
  }, [handoverId, refreshKey]);

  async function compare() {
    setBusy(true);
    try {
      setDiff(await api.diffVersions(handoverId, from, to));
    } catch (err) {
      notify?.(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (versions === null) return <div className="ws-muted">Loading version history…</div>;
  if (versions.length === 0) return <div className="ws-muted">No versions recorded yet.</div>;
  const label = version => version.label || `v${version.version_number}`;
  const empty = diff && !diff.added.length && !diff.removed.length && !diff.changed.length;

  return (
    <div>
      <ul style={{ margin: '0 0 12px', paddingLeft: 18, fontSize: '0.85rem', color: '#cbd5e1' }}>
        {versions.map(version => (
          <li key={version.id}>{label(version)} · {version.status} · {version.claim_count ?? 0} claims · {dateOnly(version.created_at)}</li>
        ))}
      </ul>
      {versions.length > 1 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <label className="ws-muted" htmlFor={`ver-from-${handoverId}`}>From</label>
          <select id={`ver-from-${handoverId}`} className="ws-input" style={{ width: 'auto' }} value={from} onChange={e => setFrom(e.target.value)}>
            {versions.map(version => <option key={version.id} value={version.id}>{label(version)}</option>)}
          </select>
          <label className="ws-muted" htmlFor={`ver-to-${handoverId}`}>To</label>
          <select id={`ver-to-${handoverId}`} className="ws-input" style={{ width: 'auto' }} value={to} onChange={e => setTo(e.target.value)}>
            {versions.map(version => <option key={version.id} value={version.id}>{label(version)}</option>)}
          </select>
          <button type="button" className="ws-btn ws-btn-sm" onClick={compare} disabled={busy || !from || !to}>
            {busy ? 'Comparing…' : 'Compare versions'}
          </button>
        </div>
      )}
      {diff && (
        <div style={{ marginTop: 12 }} aria-live="polite">
          <div className="ws-muted">
            v{diff.from.version_number} → v{diff.to.version_number}: {diff.added.length} added, {diff.removed.length} removed, {diff.changed.length} changed
          </div>
          {empty && <div className="ws-muted" style={{ marginTop: 6 }}>No claim differences between these versions.</div>}
          {diff.added.map(claim => (
            <div key={`a-${claim.id ?? claim.text}`} className="ws-diff-item ws-diff-added"><strong>Added</strong> · {sectionLabel(claim.section)}<div>{claim.text}</div></div>
          ))}
          {diff.removed.map(claim => (
            <div key={`r-${claim.id ?? claim.text}`} className="ws-diff-item ws-diff-removed"><strong>Removed</strong> · {sectionLabel(claim.section)}<div>{claim.text}</div></div>
          ))}
          {diff.changed.map(item => (
            <div key={`c-${item.claim_id}`} className="ws-diff-item ws-diff-changed">
              <strong>Changed</strong> · {item.fields.map(field => FIELD_LABELS[field] || field).join(', ')}
              {item.fields.map(field => (
                <div key={field} className="ws-diff-grid" style={{ marginTop: 6 }}>
                  <div><span className="ws-muted">Before ({FIELD_LABELS[field] || field})</span><div>{fieldValue(item.before, field)}</div></div>
                  <div><span className="ws-muted">After ({FIELD_LABELS[field] || field})</span><div>{fieldValue(item.after, field)}</div></div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ContributionMatrix({ matrix, modules }) {
  const names = matrix?.modules || [];
  const people = matrix?.contributors || [];
  if (!names.length || !people.length) return null;
  const factors = new Map((modules || []).map(item => [item.module, item.bus_factor]));
  const cell = (c, m) => matrix.cells?.[c]?.[m] ?? 0;
  return (
    <div className="ws-table-scroll" tabIndex={0} role="region" aria-label="Contribution matrix, scrollable">
      <table className="ws-matrix">
        <caption>Recorded changes per module and contributor (count and share of the module)</caption>
        <thead>
          <tr>
            <th scope="col">Module</th>
            {people.map(person => <th key={person.id} scope="col">{person.name}</th>)}
            <th scope="col">Bus factor</th>
          </tr>
        </thead>
        <tbody>
          {names.map((name, m) => {
            const total = people.reduce((sum, _, c) => sum + cell(c, m), 0);
            const top = Math.max(...people.map((_, c) => cell(c, m)));
            return (
              <tr key={name}>
                <th scope="row">{name}</th>
                {people.map((person, c) => {
                  const value = cell(c, m);
                  const sole = total > 0 && value === total;
                  return (
                    <td key={person.id} className={sole ? 'ws-cell-sole' : value === top && value > 0 ? 'ws-cell-top' : ''}>
                      {value}
                      {total > 0 && value > 0 && <span className="ws-cell-pct">{Math.round((value / total) * 100)}%</span>}
                      {sole && <span className="ws-cell-pct"> sole</span>}
                    </td>
                  );
                })}
                <td>{factors.get(name) ?? 'n/a'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
