import type { CSSProperties, ReactNode } from 'react';
import { useSettings } from '../../theme/settings';
import { rankLabel, rankOf, SUIT_SYMBOL, suitOf, type Card } from './cards';
import type { PlayerInfo } from '../../engine/types';
import { t as tx } from '../../i18n';

/** Face colors per suit for the "four-color" deck option */
const FOUR_COLOR = ['#1b1b1b', '#c8102e', '#1e7a34', '#1f5fbf'];
const TWO_COLOR = ['#1b1b1b', '#c8102e', '#1b1b1b', '#c8102e'];

interface CardProps {
  card?: Card | null;
  /** Face down */
  back?: boolean;
  size?: 'sm' | 'md' | 'lg';
  selected?: boolean;
  dim?: boolean;
  highlight?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  style?: CSSProperties;
  title?: string;
  /** Preview a face style instead of the saved setting */
  face?: 'two' | 'four';
}

export function PlayingCard({ card, back, size = 'md', selected, dim, highlight, onClick, disabled, style, title, face }: CardProps) {
  const saved = useSettings();
  const settings = face ? { ...saved, cardFace: face } : saved;
  const cls =
    `pcard pcard-${size}` +
    (selected ? ' selected' : '') +
    (dim ? ' dim' : '') +
    (highlight ? ' highlight' : '') +
    (onClick && !disabled ? ' clickable' : '');
  if (back || card == null) {
    // Face-down cards can be tapped too (e.g. flipping one blind)
    if (onClick)
      return (
        <button className={`${cls} back back-${settings.cardBack}`} style={style} onClick={onClick} disabled={disabled} aria-label={title ?? tx('Face-down card')} title={title}>
          <span className="back-inner" />
        </button>
      );
    return (
      <span className={`${cls} back back-${settings.cardBack}`} style={style} aria-label={tx('Face-down card')}>
        <span className="back-inner" />
      </span>
    );
  }
  const s = suitOf(card);
  const r = rankOf(card);
  const color = (settings.cardFace === 'four' ? FOUR_COLOR : TWO_COLOR)[s];
  const label = rankLabel(r) + SUIT_SYMBOL[s];
  const content = (
    <>
      <span className="pc-corner">
        <span>{rankLabel(r)}</span>
        <span>{SUIT_SYMBOL[s]}</span>
      </span>
      <span className={'pc-center' + (r > 10 ? ' face' : '')}>{r > 10 && r < 14 ? rankLabel(r) : SUIT_SYMBOL[s]}</span>
      <span className="pc-corner bottom">
        <span>{rankLabel(r)}</span>
        <span>{SUIT_SYMBOL[s]}</span>
      </span>
    </>
  );
  const st: CSSProperties = { color, ...style };
  if (onClick) {
    return (
      <button className={cls + ` face-${settings.cardFace}`} style={st} onClick={onClick} disabled={disabled} aria-label={label} title={title}>
        {content}
      </button>
    );
  }
  return (
    <span className={cls + ` face-${settings.cardFace}`} style={st} aria-label={label} title={title}>
      {content}
    </span>
  );
}

/** A player's hand, laid out as an overlapping fan that wraps on narrow screens */
export function Hand({
  cards,
  playable,
  selected,
  onCard,
  size = 'md',
}: {
  cards: Card[];
  playable?: (c: Card) => boolean;
  selected?: (c: Card) => boolean;
  onCard?: (c: Card) => void;
  size?: 'sm' | 'md' | 'lg';
}) {
  return (
    <div className={`hand hand-${size}`}>
      {cards.map((c) => {
        const ok = playable ? playable(c) : true;
        return (
          <PlayingCard
            key={c}
            card={c}
            size={size}
            selected={selected?.(c)}
            dim={!!playable && !ok}
            onClick={onCard ? () => onCard(c) : undefined}
            disabled={!ok}
          />
        );
      })}
    </div>
  );
}

/** Opponent badge: name, card count, optional extra info */
export function Opponent({
  player,
  seat,
  count,
  active,
  children,
}: {
  player: PlayerInfo;
  seat: number;
  count: number;
  active?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className={'opponent' + (active ? ' active' : '')}>
      <div className="opp-name">
        <span className="seat-dot" style={{ background: `var(--p${seat})` }} />
        {player.name}
        {player.kind === 'bot' && ' 🤖'}
      </div>
      <div className="opp-cards" aria-label={tx('{count} cards', { count: count })}>
        {Array.from({ length: Math.min(count, 8) }, (_, i) => (
          <PlayingCard key={i} back size="sm" style={{ marginLeft: i ? -22 : 0 }} />
        ))}
        <span className="opp-count">{count}</span>
      </div>
      {children}
    </div>
  );
}
