import { useEffect, useState } from 'react';
import { accountsEnabled, getFirebase, useAccount } from '../account/account';
import { autoPost, boardId, boardLabels, myEntry, postScore, setAutoPost, topScores, type Entry } from '../account/leaderboard';
import type { GameDef, GameOptions } from '../engine/types';
import { useT } from '../i18n';
import { Avatar } from './Avatar';

/** Bumped after posting, so open leaderboards reload */
let version = 0;
const listeners = new Set<() => void>();
const bump = () => {
  version++;
  listeners.forEach((fn) => fn());
};
function useVersion() {
  const [v, setV] = useState(version);
  useEffect(() => {
    const fn = () => setV(version);
    listeners.add(fn);
    return () => void listeners.delete(fn);
  }, []);
  return v;
}

/** Top 10 of one board, plus your own place if you're further down */
export function Leaderboard({ game, options }: { game: GameDef; options?: GameOptions }) {
  const t = useT();
  const acct = useAccount();
  const v = useVersion();
  const board = boardId(game, options);
  const [top, setTop] = useState<Entry[] | null>(null);
  const [mine, setMine] = useState<{ entry: Entry; rank: number } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    setFailed(false);
    getFirebase()
      .then(async (f) => {
        const list = await topScores(f, board);
        const me = acct.uid ? await myEntry(f, board, acct.uid) : null;
        if (live) {
          setTop(list);
          setMine(me);
        }
      })
      .catch((e) => {
        console.warn('Leaderboard failed', e);
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [board, acct.uid, v]);

  if (!accountsEnabled() || !game.leaderboard) return null;
  const labels = boardLabels(game, options);
  return (
    <section className="stack-sm leaderboard">
      <h2 className="section-title">
        🏆 {t('Leaderboard')}
        {labels.length > 0 && <span className="lb-board"> · {labels.map((l) => t(l)).join(' · ')}</span>}
      </h2>
      {failed ? (
        <p className="small muted">{t('Couldn’t load the leaderboard.')}</p>
      ) : top === null ? (
        <p className="small muted">{t('Loading…')}</p>
      ) : top.length === 0 ? (
        <p className="small muted">{t('No scores yet. Be the first!')}</p>
      ) : (
        <ol className="lb-list">
          {top.map((e, i) => (
            <li key={e.uid} className={'lb-row' + (e.uid === acct.uid ? ' me' : '')}>
              <span className="lb-rank">{i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</span>
              <Avatar name={e.name} avatar={e.avatar} size={24} />
              <span className="grow lb-name">{e.name}</span>
              <strong>{e.score}</strong>
            </li>
          ))}
          {mine && !top.some((e) => e.uid === acct.uid) && (
            <li className="lb-row me">
              <span className="lb-rank">{mine.rank}</span>
              <Avatar name={mine.entry.name} avatar={mine.entry.avatar} size={24} />
              <span className="grow lb-name">{mine.entry.name}</span>
              <strong>{mine.entry.score}</strong>
            </li>
          )}
        </ol>
      )}
      {acct.status !== 'signed-in' && (
        <p className="small muted">
          <a href="#/profile">{t('Sign in')}</a> {t('to put your scores on the leaderboard.')}
        </p>
      )}
    </section>
  );
}

/** After a game: add the score to the leaderboard (once asked, or every time if you chose that) */
export function ScorePost({ game, options, score }: { game: GameDef; options?: GameOptions; score: number }) {
  const t = useT();
  const acct = useAccount();
  const [state, setState] = useState<'ask' | 'saving' | 'saved' | 'not-best' | 'error'>('ask');
  const [best, setBest] = useState(0);
  const [always, setAlways] = useState(autoPost());
  const board = boardId(game, options);

  const post = async () => {
    if (!acct.uid) return;
    setState('saving');
    try {
      const r = await postScore(await getFirebase(), board, acct.uid, score);
      setBest(r.best);
      setState(r.improved ? 'saved' : 'not-best');
      bump();
    } catch (e) {
      console.warn(e);
      setState('error');
    }
  };

  useEffect(() => {
    if (acct.status === 'signed-in' && autoPost() && score > 0) void post();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [score, acct.status]);

  if (!accountsEnabled() || score <= 0 || acct.status !== 'signed-in') return null;
  if (state === 'saved') return <p className="small center">🏆 {t('Your new best, {n}, is on the leaderboard!', { n: best })}</p>;
  if (state === 'not-best') return <p className="small center muted">{t('Your best on the leaderboard is still {n}.', { n: best })}</p>;
  if (state === 'error') return <p className="small center muted">{t('Couldn’t save to the leaderboard. Try again later.')}</p>;
  return (
    <div className="stack-sm center score-post">
      <button className="btn primary" disabled={state === 'saving'} onClick={() => void post()}>
        🏆 {t('Add {n} to the leaderboard', { n: score })}
      </button>
      <label className="small row">
        <input
          type="checkbox"
          checked={always}
          onChange={(e) => {
            setAlways(e.target.checked);
            setAutoPost(e.target.checked);
          }}
        />
        {t('Always add my best scores (your name and avatar are shown to everyone)')}
      </label>
    </div>
  );
}
