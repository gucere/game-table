import { useState } from 'react';
import type { Session } from '../engine/session';
import { MAX_OPTION, MAX_OPTIONS, MAX_QUESTION, type PollView } from '../engine/polls';
import { useT } from '../i18n';

/** Set by the Poll tool: the next room opens with the poll form ready */
let wantComposer = false;
export const requestPollComposer = () => {
  wantComposer = true;
};
/** Read it while setting up (no side effects there), clear it once the chat is shown */
export const pollComposerRequested = () => wantComposer;
export const clearPollComposerRequest = () => {
  wantComposer = false;
};

export function PollComposer({ session, onDone }: { session: Session; onDone: () => void }) {
  const t = useT();
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [multi, setMulti] = useState(false);
  const [anonymous, setAnonymous] = useState(false);
  const filled = options.map((o) => o.trim()).filter(Boolean);
  const ok = question.trim() && filled.length >= 2;
  return (
    <form
      className="poll-composer stack-sm"
      onSubmit={(e) => {
        e.preventDefault();
        if (!ok) return;
        session.createPoll?.(question, filled, multi, anonymous);
        onDone();
      }}
      // Don't let game keyboard shortcuts fire while typing
      onKeyDown={(e) => e.stopPropagation()}
    >
      <strong className="small">📊 {t('New poll')}</strong>
      <input className="input" value={question} maxLength={MAX_QUESTION} autoFocus placeholder={t('Question, e.g. What should we play next?')} onChange={(e) => setQuestion(e.target.value)} />
      {options.map((o, i) => (
        <div key={i} className="row poll-option-input">
          <input
            className="input grow"
            value={o}
            maxLength={MAX_OPTION}
            placeholder={t('Answer {n}', { n: i + 1 })}
            onChange={(e) => setOptions((x) => x.map((y, j) => (j === i ? e.target.value : y)))}
          />
          {options.length > 2 && (
            <button type="button" className="icon-btn" aria-label={t('Remove')} onClick={() => setOptions((x) => x.filter((_, j) => j !== i))}>
              ✕
            </button>
          )}
        </div>
      ))}
      {options.length < MAX_OPTIONS && (
        <button type="button" className="btn ghost small" onClick={() => setOptions((x) => [...x, ''])}>
          + {t('Add an answer')}
        </button>
      )}
      <label className="small row">
        <input type="checkbox" checked={multi} onChange={(e) => setMulti(e.target.checked)} /> {t('Allow more than one answer')}
      </label>
      <label className="small row">
        <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} /> {t('Anonymous (show counts, not names)')}
      </label>
      <div className="row">
        <button className="btn primary small" disabled={!ok}>
          {t('Start the poll')}
        </button>
        <button type="button" className="btn ghost small" onClick={onDone}>
          {t('Cancel')}
        </button>
      </div>
    </form>
  );
}

export function PollCard({ poll, session }: { poll: PollView; session: Session }) {
  const t = useT();
  const max = Math.max(1, ...poll.counts);
  const pick = (i: number) => {
    if (poll.closed) return;
    const has = poll.mine.includes(i);
    const next = poll.multi ? (has ? poll.mine.filter((x) => x !== i) : [...poll.mine, i]) : has ? [] : [i];
    session.votePoll?.(poll.id, next);
  };
  return (
    <div className={'poll-card' + (poll.closed ? ' closed' : '')}>
      <strong className="poll-q">📊 {poll.question}</strong>
      <span className="small muted">
        {poll.multi ? t('Pick any') : t('Pick one')}
        {poll.anonymous ? ` · ${t('anonymous')}` : ''}
        {poll.closed ? ` · ${t('closed')}` : ''}
      </span>
      <div className="poll-options">
        {poll.options.map((o, i) => {
          const chosen = poll.mine.includes(i);
          const pct = poll.total ? Math.round((poll.counts[i] / poll.total) * 100) : 0;
          return (
            <button key={i} className={'poll-option' + (chosen ? ' on' : '')} aria-pressed={chosen} disabled={poll.closed} onClick={() => pick(i)}>
              <span className="poll-bar" style={{ width: `${(poll.counts[i] / max) * 100}%` }} aria-hidden />
              <span className="poll-label">
                {chosen ? '✓ ' : ''}
                {o}
              </span>
              <span className="poll-count">
                {poll.counts[i]}
                {poll.total > 0 && <span className="muted"> · {pct}%</span>}
              </span>
              {poll.voters && poll.voters[i].length > 0 && <span className="poll-voters small muted">{poll.voters[i].join(', ')}</span>}
            </button>
          );
        })}
      </div>
      <div className="row">
        <span className="small muted grow">{poll.total === 1 ? t('1 vote') : t('{n} votes', { n: poll.total })}</span>
        {poll.canClose && (
          <button className="btn ghost small" onClick={() => session.closePoll?.(poll.id)}>
            {t('Close poll')}
          </button>
        )}
      </div>
    </div>
  );
}
