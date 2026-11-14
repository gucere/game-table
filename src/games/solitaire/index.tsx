import { useState } from 'react';
import type { BoardProps, GameDef } from '../../engine/types';
import { SUIT_SYMBOL } from '../cards/cards';
import { PlayingCard } from '../cards/CardView';
import * as L from './logic';
import { t as tx } from '../../i18n';

function sameSrc(a: L.Src | null, b: L.Src) {
  return !!a && JSON.stringify(a) === JSON.stringify(b);
}

function Board({ view: v, canMove, onMove }: BoardProps<L.SolView, L.SolMove>) {
  const [sel, setSel] = useState<L.Src | null>(null);

  const clickSource = (from: L.Src) => {
    if (!canMove) return;
    if (sel && !sameSrc(sel, from)) {
      // Clicking another pile's card with a selection: try to drop there
      const to: L.Dst | null = from.t === 'tab' ? { t: 'tab', i: from.i } : from.t === 'found' ? { t: 'found', i: from.i } : null;
      if (to) {
        onMove({ type: 'move', from: sel, to });
        setSel(null);
        return;
      }
    }
    if (sameSrc(sel, from)) {
      setSel(null);
      return;
    }
    const to = L.smartTarget(v, from);
    if (to) {
      onMove({ type: 'move', from, to });
      setSel(null);
    } else setSel(from);
  };

  const dropOn = (to: L.Dst) => {
    if (!canMove || !sel) return;
    onMove({ type: 'move', from: sel, to });
    setSel(null);
  };

  const wasteShown = v.waste.slice(-(v.draw === 3 ? 3 : 1));

  return (
    <div className="sol">
      <div className="sol-top">
        <button
          className="sol-slot"
          onClick={() => {
            setSel(null);
            if (canMove) onMove({ type: 'draw' });
          }}
          aria-label={v.stockCount ? tx('Draw ({stockCount} left)', { stockCount: v.stockCount }) : tx('Turn the waste over')}
          disabled={!canMove || (!v.stockCount && !v.waste.length)}
        >
          {v.stockCount ? <PlayingCard back /> : <span className="sol-empty">↻</span>}
        </button>
        <div className="sol-waste">
          {wasteShown.map((c, idx) => {
            const isTop = idx === wasteShown.length - 1;
            return (
              <PlayingCard
                key={c}
                card={c}
                style={{ marginLeft: idx ? -40 : 0 }}
                selected={isTop && sel?.t === 'waste'}
                onClick={isTop ? () => clickSource({ t: 'waste' }) : undefined}
              />
            );
          })}
          {!wasteShown.length && <span className="sol-empty" />}
        </div>
        <span className="sol-spacer" />
        {v.found.map((f, i) => (
          <div key={i} className="sol-slot" onClick={() => !f.length && sel && dropOn({ t: 'found', i })}>
            {f.length ? (
              <PlayingCard card={f[f.length - 1]} selected={sel?.t === 'found' && sel.i === i} onClick={() => (sel ? dropOn({ t: 'found', i }) : clickSource({ t: 'found', i }))} />
            ) : (
              <span className="sol-empty">{SUIT_SYMBOL[i]}</span>
            )}
          </div>
        ))}
      </div>

      <div className="sol-tab">
        {v.tab.map((p, i) => (
          <div key={i} className="sol-col" onClick={() => !p.up.length && sel && dropOn({ t: 'tab', i })}>
            {!p.up.length && !p.down && <span className="sol-empty">{tx('K')}</span>}
            {Array.from({ length: p.down }, (_, k) => (
              <div key={'d' + k} className="sol-stack down">
                <PlayingCard back />
              </div>
            ))}
            {p.up.map((c, k) => (
              <div key={c} className="sol-stack up">
                <PlayingCard card={c} selected={sel?.t === 'tab' && sel.i === i && k >= sel.k} onClick={() => clickSource({ t: 'tab', i, k })} />
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="action-bar">
        <span className="chip">{tx('Moves: {moves}', { moves: v.moves })}</span>
        <button className="btn small" disabled={!canMove || !v.canUndo} onClick={() => onMove({ type: 'undo' })}>{tx('↶ Undo')}</button>
        <button className={'btn small' + (L.canAutoFinish(v) ? ' primary' : '')} disabled={!canMove} onClick={() => onMove({ type: 'auto' })}>{tx('⇧ Send cards up')}</button>
      </div>
    </div>
  );
}

export const solitaire: GameDef<L.SolState, L.SolMove, L.SolView> = {
  id: 'solitaire',
  name: 'Solitaire',
  tagline: 'Classic Klondike patience.',
  icon: '🂡',
  minPlayers: 1,
  maxPlayers: 1,
  hiddenInfo: false,
  options: [
    {
      id: 'draw',
      label: 'Draw',
      default: '1',
      choices: [
        { value: '1', label: 'Draw 1 (easier)' },
        { value: '3', label: 'Draw 3 (classic)' },
      ],
    },
  ],
  rules:
    'Build four foundations from Ace to King, one per suit. In the columns, stack cards downward in alternating colours. Only a King can fill an empty column. Tap a card to move it to the best spot, or tap it and then tap where it should go.',
  setup: L.setup,
  activePlayers: (s) => (s.endedAt ? [] : [0]),
  view: L.view,
  move: (s, _seat, m, ctx) => L.move(s, m, ctx.now()),
  result: L.result,
  Board,
};
