import { useEffect, useState } from 'react';
import type { BoardProps, GameDef } from '../../engine/types';
import { TileView } from '../tiles/TileView';
import * as L from './logic';
import { t as tx } from '../../i18n';

const TW = 40;
const TH = 54;
const LIFT = 5;

function Board({ view: v, canMove, onMove }: BoardProps<L.TasState, L.TasMove>) {
  const [sel, setSel] = useState<number | null>(null);
  const [hint, setHint] = useState<[number, number] | null>(null);
  const [wrong, setWrong] = useState<number | null>(null);
  useEffect(() => {
    setSel(null);
    setHint(null);
  }, [v.tiles]);

  const present = v.tiles.map((t) => t !== null);
  const pairs = L.freePairs(v);
  const maxX = Math.max(...v.slots.map((s) => s.x)) + 1;
  const maxY = Math.max(...v.slots.map((s) => s.y)) + 1;
  const left = v.tiles.filter((t) => t !== null).length;

  const click = (i: number) => {
    if (!canMove || !L.isFree(v.slots, present, i)) return;
    if (sel === null || sel === i) return setSel(sel === i ? null : i);
    if (L.sameFace(v.tiles[sel]!, v.tiles[i]!)) onMove({ type: 'match', a: sel, b: i });
    else {
      setWrong(i);
      setTimeout(() => setWrong(null), 350);
      setSel(i);
    }
  };

  // Draw lower layers first, and within a layer top-to-bottom, left-to-right
  const order = v.slots.map((_, i) => i).sort((a, b) => v.slots[a].z - v.slots[b].z || v.slots[a].y - v.slots[b].y || v.slots[a].x - v.slots[b].x);

  return (
    <div className="stack center">
      <div className="info-row">
        <span className="chip">{tx('{left} tiles left', { left: left })}</span>
        <span className={'chip' + (pairs.length ? '' : ' urgent')}>{pairs.length ? tx('{length} matches available', { length: pairs.length }) : tx('No matches: shuffle!')}</span>
        <button className="btn small" disabled={!canMove || !pairs.length} onClick={() => setHint(pairs[0] ?? null)}>{tx('💡 Hint')}</button>
        <button className="btn small" disabled={!canMove || !v.history.length} onClick={() => onMove({ type: 'undo' })}>{tx('↶ Undo')}</button>
        <button className={'btn small' + (pairs.length ? '' : ' primary')} disabled={!canMove} onClick={() => onMove({ type: 'shuffle' })}>{tx('🔀 Shuffle')}</button>
      </div>
      <div className="te-scroll">
        <div className="te-board" style={{ width: maxX * TW + 4 * LIFT + 8, height: maxY * TH + 4 * LIFT + 8 }}>
          {order.map((i) => {
            const t = v.tiles[i];
            if (t === null) return null;
            const s = v.slots[i];
            const free = L.isFree(v.slots, present, i);
            return (
              <span
                key={i}
                className={'te-tile' + (free ? ' free' : '') + (sel === i ? ' sel' : '') + (hint?.includes(i) ? ' hint' : '') + (wrong === i ? ' wrong' : '')}
                style={{ left: s.x * TW + (4 - s.z) * LIFT, top: s.y * TH + (4 - s.z) * LIFT, zIndex: s.z * 100 + s.y * 10 + s.x }}
                onClick={() => click(i)}
              >
                <TileView tile={t} size="md" />
              </span>
            );
          })}
        </div>
      </div>
      <p className="small muted">{tx('Tap two identical free tiles (nothing on top, and an open left or right side) to clear them.')}</p>
    </div>
  );
}

export const tasEsle: GameDef<L.TasState, L.TasMove, L.TasState> = {
  id: 'tas-esle',
  name: 'Taş Eşle',
  tagline: 'Match pairs of Okey tiles from a layered stack.',
  icon: '🀄',
  minPlayers: 1,
  maxPlayers: 1,
  hiddenInfo: false,
  options: [
    {
      id: 'layout',
      label: 'Layout',
      default: 'pyramid',
      choices: [
        { value: 'pyramid', label: 'Pyramid (84 tiles)' },
        { value: 'fortress', label: 'Fortress (92 tiles)' },
      ],
    },
  ],
  rules:
    'Clear the board by removing pairs of identical tiles (same number and colour). You can only take a tile that is free: nothing is stacked on it, and its left or right side is open. Stuck? Use a hint, undo, or shuffle the remaining tiles. Every deal can be cleared.',
  setup: L.setup,
  activePlayers: L.activePlayers,
  view: (s) => s,
  move: (s, seat, m, ctx) => L.move(s, seat, m, ctx),
  result: L.result,
  Board,
};
