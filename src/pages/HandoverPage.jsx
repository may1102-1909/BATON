import React, { useEffect, useState } from 'react';
import * as api from '../lib/api.js';
import { downloadText, slugify } from '../lib/download.js';
import { Citations, ClaimsView, ConflictsPanel, VersionHistory, sourceMap } from '../components/HandoverParts.jsx';
import '../components/workspace.css';

const dateOnly = value => (value ? String(value).slice(0, 10) : '');

const FAILURES = {
  404: ['Handover not found', 'This handover does not exist, or the link is wrong.'],
  403: ['Not available to you yet', 'The packet opens for the incoming engineer once an admin has approved it. Admins and the leaving engineer can review it from the dashboard.'],
};

export function HandoverPage({ handoverId, onBack, mode = 'production', embedded = false }) {
  const isDemo = mode === 'demo';
  const [detail, setDetail] = useState(null);
  const [viewer, setViewer] = useState(null);
  const [members, setMembers] = useState([]);
  const [failure, setFailure] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState(null);
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [lastAnswer, setLastAnswer] = useState(null);
  const [acking, setAcking] = useState(false);
  const [exporting, setExporting] = useState(false);

  const notify = (message, kind = 'error') => setNotice({ message: String(message), kind });

  useEffect(() => {
    if (notice?.kind !== 'success') return undefined;
    const timer = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [notice]);

  async function load(initial = false) {
    if (initial) setLoading(true);
    try {
      const [res, me] = await Promise.all([api.getHandover(handoverId), api.fetchMe().catch(() => null)]);
      setDetail(res);
      setViewer(me);
      setFailure(null);
      api.fetchOrgState(res.handover.org_id).then(state => setMembers(state?.members || [])).catch(() => {});
    } catch (err) {
      if (initial) setFailure({ status: err.status, message: err.message });
      else notify(err.message);
    } finally {
      if (initial) setLoading(false);
    }
  }

  useEffect(() => {
    setDetail(null);
    setLastAnswer(null);
    load(true);
  }, [handoverId]);

  const hv = detail?.handover;
  const nameOf = id => {
    const member = members.find(item => item.user_id === id);
    return member?.name || member?.github_login || (id === viewer?.user?.id ? viewer?.user?.name : null) || 'a team member';
  };
  const isIncoming = Boolean(hv && viewer?.user?.id === hv.incoming_id);
  const canAck = isIncoming && hv.status === 'approved' && !hv.acknowledged_at;
  const canAsk = isIncoming && hv?.status === 'approved';
  const asked = (detail?.questions || []).filter(item => item.asked_by);
  const gaps = (detail?.questions || []).filter(item => item.assigned_to && item.status !== 'answered');
  const sources = sourceMap(detail?.sources);
  const hidden = detail?.hidden_count ?? 0;

  async function acknowledge() {
    setAcking(true);
    try {
      await api.acknowledgeHandover(handoverId);
      await load();
      notify('Handover acknowledged.', 'success');
    } catch (err) {
      notify(err.message);
    } finally {
      setAcking(false);
    }
  }

  async function exportMarkdown() {
    setExporting(true);
    try {
      const markdown = await api.getHandoverMarkdown(handoverId);
      downloadText(`handover-${slugify(nameOf(hv.leaver_id), 'leaver')}-to-${slugify(nameOf(hv.incoming_id), 'incoming')}.md`, markdown);
      notify('Markdown exported.', 'success');
    } catch (err) {
      notify(`Export failed: ${err.message}`);
    } finally {
      setExporting(false);
    }
  }

  async function ask(e) {
    e.preventDefault();
    if (!question.trim()) return;
    setAsking(true);
    try {
      setLastAnswer(await api.askHandover(handoverId, question.trim()));
      setQuestion('');
      await load();
    } catch (err) {
      notify(err.message);
    } finally {
      setAsking(false);
    }
  }

  const back = onBack && (
    <button type="button" className="ws-btn ws-btn-sm" onClick={onBack}>← {embedded ? 'Back to handovers' : 'Back'}</button>
  );

  let body;
  if (loading) {
    body = <div className="ws-card" role="status">Loading handover packet…</div>;
  } else if (failure) {
    const [title, text] = FAILURES[failure.status] || ['Could not load the handover', failure.message];
    body = (
      <div className="ws-card ws-empty-state" role="alert">
        <div className="ws-empty-title">{title}</div>
        <div>{text}</div>
      </div>
    );
  } else if (detail) {
    const claims = detail.claims || [];
    const Title = embedded ? 'h2' : 'h1';
    body = (
      <>
        <div className="ws-card">
          <div className="ws-card-header">
            <div>
              <Title style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff', margin: 0 }}>
                Handover packet: {nameOf(hv.leaver_id)} → {nameOf(hv.incoming_id)}
              </Title>
              <div className="ws-muted" style={{ marginTop: 4 }}>
                Status: <span className="ws-badge ws-badge-verified">{hv.acknowledged_at ? 'acknowledged' : hv.status}</span>
                {hv.approved_at && <> · approved {dateOnly(hv.approved_at)}</>}
                {hv.acknowledged_at && <> · acknowledged {dateOnly(hv.acknowledged_at)}</>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {hv.status === 'approved' && (
                <button type="button" className="ws-btn" onClick={exportMarkdown} disabled={exporting}>
                  {exporting ? 'Exporting…' : 'Export Markdown'}
                </button>
              )}
              {canAck && (
                <button type="button" className="ws-btn ws-btn-primary" onClick={acknowledge} disabled={acking}>
                  {acking ? 'Acknowledging…' : 'Acknowledge handover'}
                </button>
              )}
            </div>
          </div>
          {hidden > 0 && <div className="ws-muted" role="note">{hidden} item{hidden === 1 ? '' : 's'} hidden for your role.</div>}
        </div>

        <ConflictsPanel conflicts={detail.conflicts} canResolve={false} nameOf={nameOf} />

        <div className="ws-card">
          <div className="ws-card-header">
            <div className="ws-card-title">Claims by section</div>
            <span className="ws-badge ws-badge-verified">{claims.length} claims</span>
          </div>
          {claims.length === 0 ? <div className="ws-muted">No claims in this packet.</div> : <ClaimsView claims={claims} sources={detail.sources} grouped />}
        </div>

        {gaps.length > 0 && (
          <div className="ws-card">
            <div className="ws-card-header"><div className="ws-card-title">Known gaps</div></div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.85rem', color: '#cbd5e1' }}>
              {gaps.map(gap => <li key={gap.id}>{gap.question_text} <span className="ws-badge ws-badge-muted">{gap.status === 'skipped' ? 'skipped' : 'unanswered'}</span></li>)}
            </ul>
          </div>
        )}

        <div className="ws-card">
          <div className="ws-card-header">
            <div className="ws-card-title">Ask a question (cited answers)</div>
            <span className="ws-badge ws-badge-verified">Answers cite approved sources only</span>
          </div>
          {canAsk ? (
            <form onSubmit={ask} style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
              <input type="text" className="ws-input" aria-label="Your question" style={{ flex: 1, minWidth: 200 }} placeholder="e.g. What work is still unfinished?" value={question} onChange={e => setQuestion(e.target.value)} />
              <button type="submit" className="ws-btn ws-btn-primary" disabled={asking || !question.trim()}>{asking ? 'Searching evidence…' : 'Ask Baton'}</button>
            </form>
          ) : (
            <div className="ws-muted" style={{ marginBottom: 12 }}>
              {hv.status === 'approved' ? 'Only the incoming engineer can ask questions.' : 'Questions open once the handover is approved.'}
            </div>
          )}
          {lastAnswer?.hidden_count > 0 && <div className="ws-muted" style={{ marginBottom: 8 }}>{lastAnswer.hidden_count} item{lastAnswer.hidden_count === 1 ? '' : 's'} hidden for your role were not used.</div>}
          {asked.length === 0 ? (
            <div className="ws-muted">No questions asked yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {asked.map(item => (
                <div key={item.id} style={{ background: '#131417', border: '1px solid var(--line)', borderRadius: 6, padding: 12 }}>
                  <div style={{ fontWeight: 600, color: '#f4f4f5', fontSize: '0.88rem' }}>{item.question_text}</div>
                  <div style={{ margin: '6px 0', fontSize: '0.85rem', color: '#cbd5e1', whiteSpace: 'pre-wrap' }}>{item.answer}</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    {item.confidence && <span className={`ws-badge ${item.confidence === 'verified' ? 'ws-badge-verified' : 'ws-badge-muted'}`}>{item.confidence}</span>}
                    <Citations ids={item.source_ids} sources={sources} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="ws-card">
          <div className="ws-card-header"><div className="ws-card-title">Version history</div></div>
          <VersionHistory handoverId={handoverId} notify={notify} refreshKey={hv.version} />
        </div>
      </>
    );
  }

  const notices = notice && (
    <div className={`ws-notice ws-notice-${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>
      <span>{notice.message}</span>
      <button type="button" className="ws-notice-close" aria-label="Dismiss message" onClick={() => setNotice(null)}>✕</button>
    </div>
  );

  const Wrapper = embedded ? "div" : "main";
  return (
    <Wrapper className={embedded ? undefined : "ws-container"}>
      <div className="ws-packet" data-demo={isDemo ? 'true' : undefined}>
        {back && <div>{back}</div>}
        {notices}
        {body}
      </div>
    </Wrapper>
  );
}

export default HandoverPage;
