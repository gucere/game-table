import { useEffect, useState } from 'react';
import { bestMelds, sortTiles, type Face, type RuleSet, type Tile } from './tiles';
import { TileView } from './TileView';
import { t as tx } from '../../i18n';

/** -1 in the order array is a visual gap between groups */
export const GAP = -1;

/**
 * Keeps the player's own arrangement of their rack across turns:
 * tiles that left are removed, new tiles are appended at the end.
 */
export function useRackOrder(hand: Tile[], key: string | number) {
  const [order, setOrder] = useState<number[]>(hand);
  useEffect(() => {
    setOrder((prev) => {
      const inHand = new Set(hand);
      const kept = prev.filter((t) => t === GAP || inHand.has(t));
      const known = new Set(kept);
      const added = hand.filter((t) => !known.has(t));
      const merged = [...kept, ...(added.length && kept.length ? [GAP] : []), ...added];
      // Collapse repeated / edge gaps
      const out: number[] = [];
      for (const t of merged) if (!(t === GAP && (out.length === 0 || out[out.length - 1] === GAP))) out.push(t);
      while (out[out.length - 1] === GAP) out.pop();
      return out;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hand.join(','), key]);
  return [order, setOrder] as const;
}

export function arrange(hand: Tile[], okey: Face, rules: RuleSet): number[] {
  const { melds, rest } = bestMelds(hand, okey, rules);
  const out: number[] = [];
  for (const m of melds) out.push(...m.tiles, GAP);
  out.push(...sortTiles(rest, okey));
  return out;
}

export function Rack({
  order,
  setOrder,
  okey,
  rules,
  selected,
  onToggle,
  hand,
}: {
  order: number[];
  setOrder: (o: number[]) => void;
  okey: Face;
  rules: RuleSet;
  selected: Tile[];
  onToggle: (t: Tile) => void;
  hand: Tile[];
}) {
  // Moving: with exactly one tile selected, clicking a gap or a tile's left edge moves it there
  const moveTo = (index: number) => {
    if (selected.length !== 1) return;
    const t = selected[0];
    const without = order.filter((x) => x !== t);
    const at = order.indexOf(t) < index ? index - 1 : index;
    without.splice(at, 0, t);
    setOrder(without);
  };

  return (
    <div className="stack-sm">
      <div className="rack" role="list">
        {order.map((t, i) =>
          t === GAP ? (
            <button key={'g' + i} className="rack-gap" onClick={() => moveTo(i)} aria-label={tx('Gap')} />
          ) : (
            <span key={t} className="rack-cell" role="listitem">
              {selected.length === 1 && selected[0] !== t && <button className="rack-drop" onClick={() => moveTo(i)} aria-label={tx('Move here')} />}
              <TileView tile={t} okey={okey} selected={selected.includes(t)} onClick={() => onToggle(t)} />
            </span>
          ),
        )}
      </div>
      <div className="action-bar">
        <button className="btn small" onClick={() => setOrder(sortTiles(hand, okey, 'runs'))}>{tx('Sort by color')}</button>
        <button className="btn small" onClick={() => setOrder(sortTiles(hand, okey, 'sets'))}>{tx('Sort by number')}</button>
        <button className="btn small" onClick={() => setOrder(arrange(hand, okey, rules))}>{tx('✨ Arrange groups')}</button>
        <button className="btn small ghost" disabled={selected.length !== 1} onClick={() => moveTo(order.length)} title={tx('Move the selected tile to the end')}>{tx('Move to end →')}</button>
      </div>
      {selected.length === 1 && <p className="muted small center">{tx('Tip: tap the left edge of another tile to move the selected tile there.')}</p>}
    </div>
  );
}
