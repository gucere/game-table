import type { BoardProps, GameDef } from '../../engine/types';
import { t as tx } from '../../i18n';
import * as L from './logic';

function Board({ view: v, seat, players, canMove, onMove }: BoardProps<L.MemoryView, L.MemoryMove>) {
  const cols = v.faces.length <= 16 ? 4 : 6;
  const name = (s: number) => (s === seat ? tx('You') : players[s].name);
  const solo = v.n === 1;
  return (
    <div className="stack-sm center mem">
      <div className="info-row">
        {solo ? (
          <span className="chip">{tx('Tries: {n}', { n: v.tries })}</span>
        ) : (
          players.map((_, i) => (
            <span key={i} className={'chip' + (i === v.turn && !v.endedAt ? ' trump-chip' : '')}>
              <span className="seat-dot" style={{ background: `var(--p${i % 8})` }} /> {name(i)}: {v.scores[i]}
            </span>
          ))
        )}
      </div>
      <div
        className="mem-grid"
        style={{
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          // Fit the whole table on screen: width follows the height available
          maxWidth: `calc((100vh - 230px) * ${((cols / (v.faces.length / cols)) * 0.75).toFixed(3)})`,
        }}
      >
        {v.faces.map((f, i) => {
          const up = f !== null;
          const mine = v.owner[i];
          return (
            <button
              key={i}
              className={'mem-card' + (up ? ' up' : '') + (mine !== null ? ' taken' : '')}
              style={mine !== null && !solo ? { boxShadow: `inset 0 0 0 3px var(--p${mine % 8})` } : undefined}
              disabled={!canMove || up}
              onClick={() => onMove({ type: 'flip', i })}
              aria-label={up ? f! : tx('Face-down card')}
            >
              <span className="mem-inner">
                <span className="mem-back" />
                <span className="mem-face">{f}</span>
              </span>
            </button>
          );
        })}
      </div>
      {!v.endedAt && !solo && <p className="small muted">{v.turn === seat ? tx('Your turn: flip two cards.') : tx('{name} is flipping…', { name: name(v.turn) })}</p>}
    </div>
  );
}

export const memory: GameDef<L.MemoryState, L.MemoryMove, L.MemoryView> = {
  id: 'hafiza',
  name: 'Hafıza',
  tagline: 'Flip two cards, find the pairs, remember where everything was.',
  icon: '🃏',
  minPlayers: 1,
  maxPlayers: 6,
  hiddenInfo: false,
  options: [
    {
      id: 'pairs',
      label: 'Cards',
      default: '8',
      choices: [
        { value: '8', label: '16 cards' },
        { value: '12', label: '24 cards' },
        { value: '18', label: '36 cards' },
      ],
    },
    {
      id: 'theme',
      label: 'Pictures',
      default: 'animals',
      choices: [
        { value: 'animals', label: 'Animals' },
        { value: 'food', label: 'Fruit & food' },
        { value: 'things', label: 'Things' },
      ],
    },
  ],
  rules:
    'All cards start face down, and every picture appears twice. On your turn, flip two cards. If they match, the pair is yours and you go again; if not, they turn back over and the next player goes. When every pair is found, whoever has the most pairs wins. Playing alone, try to clear the table in as few tries as you can.',
  setup: L.setup,
  activePlayers: L.activePlayers,
  view: (s) => L.view(s),
  move: (s, seat, m, ctx) => L.move(s, seat, m, ctx),
  result: L.result,
  bot: L.bot,
  botDelay: () => 900,
  timer: (s) => s.deadline,
  onTimer: (s) => L.onTimer(s),
  Board,
};
