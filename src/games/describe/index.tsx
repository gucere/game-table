import type { BoardProps, GameDef, PlayerInfo } from '../../engine/types';
import { t as tx } from '../../i18n';
import { Countdown } from '../shared/Countdown';
import * as L from './logic';

const MARK_ICON: Record<L.Mark, string> = { ok: '✅', pass: '⏭', buzz: '🚫' };

export function TeamChips({ players, scores, seat, active }: { players: PlayerInfo[]; scores: [number, number]; seat: number; active?: 0 | 1 | null }) {
  return (
    <div className="info-row">
      {[0, 1].map((t) => (
        <span key={t} className={'chip team-chip' + (active === t ? ' trump-chip' : '')}>
          <span className="seat-dot" style={{ background: t ? 'var(--p1)' : 'var(--p0)' }} />
          {t ? tx('Team B') : tx('Team A')}: {scores[t]}
          <span className="small muted">
            {' '}
            ({players.flatMap((p, i) => (i % 2 === t ? [i === seat ? tx('you') : p.name] : [])).join(', ')})
          </span>
        </span>
      ))}
    </div>
  );
}

function Board({ view: v, seat, players, canMove, onMove, clockOffset }: BoardProps<L.DescribeView, L.DescribeMove>) {
  const dTeam = L.teamOf(v.describer);
  const iDescribe = seat === v.describer;
  const dName = iDescribe ? tx('You') : players[v.describer].name;

  return (
    <div className="stack center da">
      <TeamChips players={players} scores={v.scores} seat={seat} active={v.phase === 'done' ? null : dTeam} />
      <span className="chip">{tx('Turn {n} / {m}', { n: Math.min(v.turn + 1, v.totalTurns), m: v.totalTurns })}</span>

      {v.phase === 'ready' && (
        <div className="stack-sm center">
          {v.log.length > 0 && (
            <div className="da-log">
              {v.log.map((l, i) => (
                <span key={i} className={'chip da-' + l.mark}>
                  {MARK_ICON[l.mark]} {l.word}
                </span>
              ))}
            </div>
          )}
          {canMove ? (
            <>
              <p>{tx('Your turn to describe! Your team guesses out loud.')}</p>
              <button className="btn primary big-btn" onClick={() => onMove({ type: 'start' })}>
                ▶ {tx('Start')}
              </button>
            </>
          ) : (
            <p className="muted">{tx('{name} describes next for {team}.', { name: dName, team: dTeam ? tx('Team B') : tx('Team A') })}</p>
          )}
        </div>
      )}

      {v.phase === 'describe' && (
        <div className="stack-sm center">
          <Countdown deadline={v.deadline} offset={clockOffset} />
          {v.card ? (
            <div className="da-card">
              <strong className="da-word">{v.card[0].toLocaleUpperCase(v.lang === 'tr' ? 'tr' : 'en')}</strong>
              <span className="small muted">{tx('Don’t say:')}</span>
              <ul>
                {v.card[1].map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="da-guess">{tx('Guess! {name} is describing.', { name: dName })}</p>
          )}
          {canMove && iDescribe && (
            <div className="row center">
              <button className="btn primary" onClick={() => onMove({ type: 'mark', mark: 'ok' })}>
                ✅ {tx('Got it')}
              </button>
              <button className="btn" disabled={v.passLimit > 0 && v.passesLeft <= 0} onClick={() => onMove({ type: 'mark', mark: 'pass' })}>
                ⏭ {v.passLimit > 0 ? tx('Pass ({n} left)', { n: v.passesLeft }) : tx('Pass')}
              </button>
              <button className="btn ghost" onClick={() => onMove({ type: 'mark', mark: 'buzz' })}>
                🚫 {tx('Said a forbidden word')}
              </button>
            </div>
          )}
          {!iDescribe && v.card && <p className="small muted">{tx('You’re on the other team: watch for forbidden words and call them out!')}</p>}
          <div className="da-log">
            {v.log.map((l, i) => (
              <span key={i} className={'chip da-' + l.mark}>
                {MARK_ICON[l.mark]} {l.word}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export const describeGame: GameDef<L.DescribeState, L.DescribeMove, L.DescribeView> = {
  id: 'kelimeyi-anlat',
  name: 'Kelimeyi Anlat',
  tagline: 'Describe the word without saying the forbidden ones. Team against team, against the clock.',
  icon: '🗣️',
  minPlayers: 4,
  maxPlayers: 12,
  defaultPlayers: 4,
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
      id: 'seconds',
      label: 'Time per turn',
      default: '60',
      choices: [
        { value: '45', label: '45 s' },
        { value: '60', label: '60 s' },
        { value: '90', label: '90 s' },
      ],
    },
    {
      id: 'rounds',
      label: 'Turns each',
      default: '1',
      choices: [
        { value: '1', label: 'Once each' },
        { value: '2', label: 'Twice each' },
      ],
    },
    {
      id: 'passes',
      label: 'Passes per turn',
      default: '3',
      choices: [
        { value: '3', label: '3' },
        { value: '0', label: 'Unlimited' },
      ],
    },
  ],
  rules:
    'Two teams: players 1, 3, 5… against players 2, 4, 6…. Teams take turns; on your turn you see a word and the words you may not say. Describe it so your team guesses it out loud: no saying the word itself, its forbidden words, parts of them, or acting it out with sounds. Every word guessed scores 1. Skipping is free (3 per turn unless set to unlimited); saying a forbidden word costs 1 point. The other team sees the card too and calls out forbidden words. Play in the same room, or online with voice chat on. The team with more points at the end wins.',
  setup: L.setup,
  activePlayers: L.activePlayers,
  view: L.view,
  move: (s, seat, m, ctx) => L.move(s, seat, m, ctx),
  result: L.result,
  isPrivate: (v) => v.phase === 'describe' && v.card !== null,
  timer: (s) => s.deadline,
  onTimer: (s, ctx) => L.onTimer(s, ctx),
  Board,
};
