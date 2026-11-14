import type { CSSProperties } from 'react';
import { useSettings } from '../../theme/settings';
import { colorOf, COLOR_CSS, isFake, isJoker, numOf, tileLabel, type Face, type Tile } from './tiles';
import { t as tx } from '../../i18n';

const CARD_SUIT = ['♥', '♠', '♦', '♣'];
const CARD_COLOR_TWO = ['#c8102e', '#1b1b1b', '#c8102e', '#1b1b1b'];
const CARD_COLOR_FOUR = ['#c8102e', '#1b1b1b', '#1f5fbf', '#1e7a34'];
const RANK = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function CardTile({
  tile,
  size,
  selected,
  dim,
  onClick,
  disabled,
  style,
  four,
}: {
  tile: Tile;
  size: 'sm' | 'md';
  selected?: boolean;
  dim?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  style?: CSSProperties;
  four: boolean;
}) {
  const fake = isFake(tile);
  const c = colorOf(tile);
  const label = fake ? 'Joker' : `${RANK[numOf(tile)]}${CARD_SUIT[c]}`;
  const cls = `tile tile-${size} as-card` + (selected ? ' selected' : '') + (dim ? ' dim' : '') + (onClick && !disabled ? ' clickable' : '');
  const inner = fake ? (
    <span className="card-joker">🃏</span>
  ) : (
    <>
      <span className="tile-num" style={{ color: (four ? CARD_COLOR_FOUR : CARD_COLOR_TWO)[c] }}>
        {RANK[numOf(tile)]}
      </span>
      <span className="card-suit" style={{ color: (four ? CARD_COLOR_FOUR : CARD_COLOR_TWO)[c] }}>
        {CARD_SUIT[c]}
      </span>
    </>
  );
  return onClick ? (
    <button className={cls} style={style} onClick={onClick} disabled={disabled} aria-label={label} title={label}>
      {inner}
    </button>
  ) : (
    <span className={cls} style={style} aria-label={label} title={label}>
      {inner}
    </span>
  );
}

export function TileView({
  tile,
  okey,
  back,
  size = 'md',
  selected,
  dim,
  onClick,
  disabled,
  style,
  badge,
  styleId,
}: {
  tile?: Tile | null;
  okey?: Face;
  back?: boolean;
  size?: 'sm' | 'md';
  selected?: boolean;
  dim?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  style?: CSSProperties;
  badge?: string;
  /** Preview a tile style instead of the saved setting */
  styleId?: string;
}) {
  const { tiles: saved, cardFace } = useSettings();
  const tileStyle = styleId ?? saved;
  // Card games (51) reuse the tile engine: draw the "tile" as a small playing card
  if (okey && okey.color === -1 && !back && tile != null) {
    return <CardTile tile={tile} size={size} selected={selected} dim={dim} onClick={onClick} disabled={disabled} style={style} four={cardFace === 'four'} />;
  }
  const cls =
    `tile tile-${size} tiles-${tileStyle}` + (selected ? ' selected' : '') + (dim ? ' dim' : '') + (onClick && !disabled ? ' clickable' : '');
  if (back || tile == null) {
    return <span className={cls + ' back'} style={style} aria-label={tx('Face-down tile')} />;
  }
  const fake = isFake(tile);
  const joker = okey ? isJoker(tile, okey) : false;
  const color = fake ? 'var(--tile-fake, #2e7d32)' : COLOR_CSS[colorOf(tile)];
  const inner = (
    <>
      <span className="tile-num" style={{ color }}>
        {fake ? '✿' : numOf(tile)}
      </span>
      <span className="tile-dot" style={{ background: color }} />
      {joker && <span className="tile-badge">★</span>}
      {badge && <span className="tile-badge left">{badge}</span>}
    </>
  );
  const label = tileLabel(tile, okey);
  if (onClick) {
    return (
      <button className={cls} style={style} onClick={onClick} disabled={disabled} aria-label={label} title={label}>
        {inner}
      </button>
    );
  }
  return (
    <span className={cls} style={style} aria-label={label} title={label}>
      {inner}
    </span>
  );
}
