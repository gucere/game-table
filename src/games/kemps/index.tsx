import { useState } from 'react';
import type { BoardProps, GameDef, Seat } from '../../engine/types';
import { t as tx } from '../../i18n';
import { PlayingCard } from '../cards/CardView';
import * as L from './logic';

function Board({ view: v, seat, players, canMove, onMove }: BoardProps<L.KempsView, L.KempsMove>) {
  const [sel, setSel] = useState<number | null>(null);
  const me = seat as Seat;
  const name = (s: number) => (s === me ? tx('You') : players[s].name);
  const playing = v.phase === 'play' && canMove;
  const letters = (t: 0 | 1) => L.WORD.slice(0, v.letters[t]).padEnd(v.target === 5 ? 5 : 3, '·');
  const opponents = [(me + 1) % 4, (me + 3) % 4];
  const recent = v.log.filter((l) => l.round === v.round).slice(-8);

  return (
    <div className="stack center km">
      <div className="info-row">
        <span className="chip">
          {tx('Your team')} ({name(me)}, {name(L.partner(me))}): <span className="km-letters">{letters(L.team(me))}</span>
        </span>
        <span className="chip">
          {tx('Opponents')}: <span className="km-letters">{letters((1 - L.team(me)) as 0 | 1)}</span>
        </span>
        <span className="chip">🤫 {tx('Your team’s secret signal: {s}', { s: v.mySignal })}</span>
      </div>

      <div className="stack-sm center">
        <span className="small muted">{tx('In the middle')}</span>
        <div className="km-center">
          {v.center.map((c, i) => (
            <PlayingCard
              key={`${c}-${i}`}
              card={c}
              highlight={playing && sel !== null}
              onClick={
                playing && sel !== null
                  ? () => {
                      onMove({ type: 'swap', card: sel, i });
                      setSel(null);
                    }
                  : undefined
              }
              disabled={!(playing && sel !== null)}
            />
          ))}
        </div>
      </div>

      {recent.length > 0 && (
        <div className="km-log">
          {recent.map((l, i) => (
            <span key={i} className="chip">
              {name(l.seat)} {l.emoji}
            </span>
          ))}
        </div>
      )}

      {v.phase === 'play' && (
        <>
          <div className="stack-sm center">
            <span className="small">{tx('Your hand: tap a card, then a card in the middle to swap.')}</span>
            <div className="hand hand-lg">
              {v.hand.map((c) => (
                <PlayingCard key={c} card={c} size="lg" selected={sel === c} onClick={playing ? () => setSel(sel === c ? null : c) : undefined} disabled={!playing} />
              ))}
            </div>
          </div>
          {playing && (
            <>
              <div className="stack-sm center">
                <span className="small muted">{tx('Send a signal (everyone sees it; only your partner knows which one means four of a kind):')}</span>
                <div className="km-signals">
                  {L.SIGNALS.map((e) => (
                    <button key={e} className="btn" onClick={() => onMove({ type: 'signal', emoji: e })} aria-label={e}>
                      {e}
                    </button>
                  ))}
                </div>
              </div>
              <div className="row center">
                <button className="btn primary" onClick={() => onMove({ type: 'kemps' })}>
                  📣 {tx('Kemps! (my partner has four)')}
                </button>
                {opponents.map((o) => (
                  <button key={o} className="btn" onClick={() => onMove({ type: 'stop', target: o })}>
                    ✋ {tx('Stop {name}!', { name: players[o].name })}
                  </button>
                ))}
                <button className="btn ghost" disabled={v.stuck[me]} onClick={() => onMove({ type: 'stuck' })}>
                  {v.stuck[me] ? tx('Waiting for new cards…') : tx('New cards in the middle')}
                </button>
              </div>
            </>
          )}
        </>
      )}

      {v.call && v.phase !== 'play' && (
        <div className="stack-sm center">
          <strong>
            {v.call.kind === 'kemps' ? tx('{by} called Kemps on {target}!', { by: name(v.call.by), target: name(v.call.target) }) : tx('{by} called Stop on {target}!', { by: name(v.call.by), target: name(v.call.target) })}{' '}
            {v.call.right ? tx('Right: four of a kind! ✅') : tx('Wrong! ❌')}
          </strong>
          <span>{v.call.scorer === L.team(me) ? tx('Your team gets a letter.') : tx('The other team gets a letter.')}</span>
          {v.shown && (
            <div className="info-row">
              {v.shown.map((h, s) => (
                <span key={s} className="chip">
                  {name(s)}: {h.map((c) => <PlayingCard key={c} card={c} size="sm" />)}
                </span>
              ))}
            </div>
          )}
          {v.phase === 'between' && canMove && (
            <button className="btn primary" onClick={() => onMove({ type: 'next' })}>
              {tx('Next round')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export const kemps: GameDef<L.KempsState, L.KempsMove, L.KempsView> = {
  id: 'kemps',
  name: 'Kemps',
  tagline: 'Collect four of a kind and signal your partner, without the other team noticing.',
  icon: '🤫',
  minPlayers: 4,
  maxPlayers: 4,
  defaultPlayers: 4,
  hiddenInfo: true,
  onlineOnly: true,
  options: [
    {
      id: 'length',
      label: 'Play to',
      default: 'full',
      choices: [
        { value: 'full', label: 'K-E-M-P-S (5 letters)' },
        { value: 'short', label: 'K-E-M (3 letters)' },
      ],
    },
  ],
  rules:
    'Two teams of two; partners sit opposite. Everyone has four cards and there are four face up in the middle. There are no turns: at any time, swap one of your cards with one in the middle. When nobody wants the middle cards, everyone presses “New cards” and four fresh ones are dealt. Goal: four cards of the same rank. Each team is secretly given one of the six signal emoji; send it to tell your partner you have four of a kind, and send the others as decoys. When you think your partner has four of a kind, call “Kemps!”; if you think an opponent has, call “Stop!” on them. A right call wins your team a letter, a wrong one gives the letter to the other team, and the round ends either way. First team to spell K-E-M-P-S wins. Best with voice chat on, each on your own phone.',
  setup: (ctx) => L.setup(ctx),
  activePlayers: L.activePlayers,
  view: L.view,
  move: (s, seat, m, ctx) => L.move(s, seat, m, ctx),
  result: L.result,
  bot: L.bot,
  botDelay: (s) => (s.phase === 'between' ? 6000 : 1500 + Math.random() * 1500),
  isPrivate: (v) => v.phase === 'play',
  Board,
};
