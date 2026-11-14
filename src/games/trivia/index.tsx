import { useState } from 'react';
import type { BoardProps, GameDef } from '../../engine/types';
import { t as tx, useT } from '../../i18n';
import { Countdown } from '../shared/Countdown';
import * as L from './logic';
import { MAX_A, MAX_PACK, MAX_Q, cleanQ, decodePack, encodePack, loadPack, mergePacks, savePack } from './pack';
import type { RawQ } from './questions';

const LETTERS = ['A', 'B', 'C', 'D'];
const blank = (): string[] => ['', '', '', '', ''];

/** Question + right answer + up to three wrong answers */
function QuestionFields({ value, onChange, n }: { value: string[]; onChange: (v: string[]) => void; n?: number }) {
  const t = useT();
  const set = (i: number, x: string) => onChange(value.map((y, k) => (k === i ? x : y)));
  const stop = (e: React.KeyboardEvent) => e.stopPropagation();
  return (
    <div className="tv-fields">
      <input className="input" maxLength={MAX_Q} placeholder={n ? t('Question {n}', { n }) : t('Question')} value={value[0]} onChange={(e) => set(0, e.target.value)} onKeyDown={stop} />
      <input className="input tv-right" maxLength={MAX_A} placeholder={t('Right answer')} value={value[1]} onChange={(e) => set(1, e.target.value)} onKeyDown={stop} />
      {[2, 3, 4].map((i) => (
        <input
          key={i}
          className="input tv-wrong"
          maxLength={MAX_A}
          placeholder={i === 2 ? t('Wrong answer') : t('Wrong answer (optional)')}
          value={value[i]}
          onChange={(e) => set(i, e.target.value)}
          onKeyDown={stop}
        />
      ))}
    </div>
  );
}

function WriteForm({ count, onMove }: { count: number; onMove: (m: L.TriviaMove) => void }) {
  const [qs, setQs] = useState(() => Array.from({ length: count }, blank));
  const cleaned = qs.map((q) => cleanQ(q));
  const ready = cleaned.every(Boolean);
  return (
    <form
      className="stack-sm"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) onMove({ type: 'write', questions: cleaned as RawQ[] });
      }}
    >
      <p className="small">{tx('Write {n} questions for the others. You won’t answer your own.', { n: count })}</p>
      {qs.map((q, i) => (
        <QuestionFields key={i} n={i + 1} value={q} onChange={(v) => setQs((all) => all.map((x, k) => (k === i ? v : x)))} />
      ))}
      <button className="btn primary" disabled={!ready}>
        {tx('Send my questions')}
      </button>
    </form>
  );
}

function Board({ view: v, seat, players, canMove, onMove, clockOffset }: BoardProps<L.TriviaView, L.TriviaMove>) {
  const name = (s: number) => (s === seat ? tx('You') : players[s].name);
  const ranking = players.map((_, i) => i).sort((a, b) => v.scores[b] - v.scores[a]);
  const scoreboard = (
    <div className="info-row">
      {ranking.map((i) => (
        <span key={i} className={'chip' + (v.gained[i] && v.phase === 'reveal' ? ' trump-chip' : '')}>
          {name(i)}: {v.scores[i]}
          {v.phase === 'reveal' && v.gained[i] > 0 && ` (+${v.gained[i]})`}
        </span>
      ))}
    </div>
  );

  if (v.phase === 'write') {
    return (
      <div className="stack tv">
        {canMove ? (
          <WriteForm count={v.perPlayer} onMove={onMove} />
        ) : (
          <p className="center muted">{tx('Waiting for everyone to write their questions… ({n} / {m})', { n: v.wroteCount, m: v.n })}</p>
        )}
      </div>
    );
  }

  const q = v.question;
  const revealed = q.correct !== null;
  const mine = v.answers[seat];
  const author = q.by;
  return (
    <div className="stack tv">
      <div className="info-row">
        <span className="chip">{tx('Question {n} / {m}', { n: v.round + 1, m: v.total })}</span>
        {(v.phase === 'ask' || v.phase === 'reveal') && <Countdown deadline={v.deadline} offset={clockOffset} />}
        {author !== null && <span className="chip">✍️ {tx('Written by {name}', { name: name(author) })}</span>}
      </div>
      <div className="tv-question">{q.q}</div>
      <div className="tv-choices">
        {q.choices.map((c, i) => {
          const pickedBy = revealed ? v.answers.flatMap((a, k) => (a === i ? [name(k)] : [])) : [];
          const cls = 'tv-choice' + (mine === i ? ' mine' : '') + (revealed && i === q.correct ? ' right' : '') + (revealed && mine === i && i !== q.correct ? ' wrong' : '');
          return (
            <button key={i} className={cls} disabled={!canMove || mine !== null} onClick={() => onMove({ type: 'answer', pick: i })}>
              <span className="tv-letter">{LETTERS[i]}</span>
              <span>{c}</span>
              {pickedBy.length > 0 && <span className="small tv-pickers">{pickedBy.join(', ')}</span>}
            </button>
          );
        })}
      </div>
      {v.phase === 'ask' && (
        <p className="small muted center">
          {author === seat
            ? tx('You wrote this one: the others are answering.')
            : mine !== null
              ? tx('Answer locked in. Waiting for the others… ({n} / {m})', { n: v.answered.filter(Boolean).length, m: v.n - (author !== null ? 1 : 0) })
              : tx('Faster right answers score more points.')}
        </p>
      )}
      {scoreboard}
    </div>
  );
}

/** Shown on the setup screen: edit "My questions" and share them as a link */
function PackEditor() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [pack, setPack] = useState(loadPack);
  const [draft, setDraft] = useState(blank);
  const [editing, setEditing] = useState<number | null>(null);
  const [link, setLink] = useState('');
  const update = (p: RawQ[]) => {
    setPack(p);
    savePack(p);
    setLink('');
  };
  const cleaned = cleanQ(draft);

  if (!open) {
    return (
      <div className="row tv-pack-bar">
        <button className="btn small" onClick={() => setOpen(true)}>
          ✍️ {t('My questions ({n})', { n: pack.length })}
        </button>
        <span className="small muted">{t('Add your own questions, then pick “My questions” or “Mix” above.')}</span>
      </div>
    );
  }
  return (
    <div className="stack-sm tv-pack">
      <div className="row">
        <strong>✍️ {t('My questions ({n})', { n: pack.length })}</strong>
        <button className="btn ghost small" onClick={() => setOpen(false)}>
          {t('Close')}
        </button>
      </div>
      <p className="small muted">{t('Saved in this browser. Share the link so friends can add your questions to theirs.')}</p>
      <QuestionFields value={draft} onChange={setDraft} />
      <div className="row">
        <button
          className="btn primary small"
          disabled={!cleaned || (editing === null && pack.length >= MAX_PACK)}
          onClick={() => {
            if (!cleaned) return;
            update(editing === null ? [...pack, cleaned] : pack.map((q, i) => (i === editing ? cleaned : q)));
            setDraft(blank());
            setEditing(null);
          }}
        >
          {editing === null ? `+ ${t('Add question')}` : t('Save changes')}
        </button>
        {editing !== null && (
          <button
            className="btn ghost small"
            onClick={() => {
              setEditing(null);
              setDraft(blank());
            }}
          >
            {t('Cancel')}
          </button>
        )}
      </div>
      {pack.length > 0 && (
        <ol className="tv-pack-list">
          {pack.map((q, i) => (
            <li key={i}>
              <span>
                {q[0]} <span className="small muted">→ {q[1]}</span>
              </span>
              <span className="row">
                <button
                  className="btn ghost small"
                  onClick={() => {
                    setEditing(i);
                    setDraft([q[0], q[1], q[2] ?? '', q[3] ?? '', q[4] ?? '']);
                  }}
                >
                  ✎
                </button>
                <button className="btn ghost small" aria-label={t('Remove')} onClick={() => update(pack.filter((_, k) => k !== i))}>
                  ✕
                </button>
              </span>
            </li>
          ))}
        </ol>
      )}
      {pack.length > 0 && (
        <div className="row">
          <button
            className="btn small"
            onClick={() => {
              const url = `${window.location.href.split('#')[0]}#/trivia/${encodePack(pack)}`;
              setLink(url);
              navigator.clipboard?.writeText(url).catch(() => {});
            }}
          >
            🔗 {t('Copy share link')}
          </button>
          {link && <span className="small">{t('Link copied ✓')}</span>}
        </div>
      )}
    </div>
  );
}

/** #/trivia/<pack>: someone shared their questions */
export function TriviaImport({ token }: { token: string }) {
  const t = useT();
  const pack = decodePack(token);
  const [done, setDone] = useState(false);
  if (!pack) {
    return (
      <div className="stack center">
        <h1>🧠 {t('Trivia questions')}</h1>
        <p>{t('This link doesn’t contain any questions.')}</p>
      </div>
    );
  }
  return (
    <div className="stack tv-import">
      <h1>🧠 {t('Trivia questions')}</h1>
      <p>{pack.length === 1 ? t('Someone shared a trivia question with you.') : t('Someone shared {n} trivia questions with you.', { n: pack.length })}</p>
      <ol className="tv-pack-list">
        {pack.slice(0, 50).map((q, i) => (
          <li key={i}>{q[0]}</li>
        ))}
      </ol>
      {done ? (
        <p>
          ✅ {t('Added to My questions.')} <a href="#/game/bilgi-yarisi">{t('Play trivia')} →</a>
        </p>
      ) : (
        <button
          className="btn primary"
          onClick={() => {
            savePack(mergePacks(loadPack(), pack));
            setDone(true);
          }}
        >
          {t('Add to My questions')}
        </button>
      )}
    </div>
  );
}

export const trivia: GameDef<L.TriviaState, L.TriviaMove, L.TriviaView> = {
  id: 'bilgi-yarisi',
  name: 'Bilgi Yarışı',
  tagline: 'Quick-fire trivia: everyone answers at once, faster is better. Bring your own questions.',
  icon: '🧠',
  minPlayers: 1,
  maxPlayers: 12,
  defaultPlayers: 2,
  hiddenInfo: true,
  options: [
    {
      id: 'lang',
      label: 'Language',
      default: 'tr',
      choices: [
        { value: 'tr', label: 'Türkçe' },
        { value: 'en', label: 'English' },
      ],
    },
    {
      id: 'source',
      label: 'Questions',
      default: 'builtin',
      choices: [
        { value: 'builtin', label: 'Built-in questions' },
        { value: 'mine', label: 'My questions' },
        { value: 'mix', label: 'Mix' },
        { value: 'players', label: 'Everyone writes some' },
      ],
    },
    {
      id: 'count',
      label: 'Number of questions',
      default: '10',
      choices: [
        { value: '5', label: '5' },
        { value: '10', label: '10' },
        { value: '15', label: '15' },
        { value: '20', label: '20' },
      ],
    },
    {
      id: 'perPlayer',
      label: 'Questions each (Everyone writes)',
      default: '2',
      choices: [
        { value: '1', label: '1' },
        { value: '2', label: '2' },
        { value: '3', label: '3' },
      ],
    },
  ],
  rules:
    'Everyone sees the same question with up to four answers and has 20 seconds to pick one. A right answer scores 500 points plus up to 500 more for speed; wrong or no answer scores nothing. Highest total wins. Questions can be built in, your own (“My questions”, which you write below and can share as a link), a mix, or “Everyone writes some”: each player first writes questions for the others, and sits out their own.',
  setup: (ctx) => L.setup(ctx),
  activePlayers: L.activePlayers,
  view: L.view,
  move: (s, seat, m, ctx) => L.move(s, seat, m, ctx),
  result: L.result,
  bot: L.bot,
  botDelay: () => 2500 + Math.random() * 6000,
  isPrivate: (v) => v.phase === 'write' || v.phase === 'ask',
  timer: L.timer,
  onTimer: (s, ctx) => L.onTimer(s, ctx),
  SetupExtra: PackEditor,
  Board,
};
