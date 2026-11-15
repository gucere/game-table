import { useEffect, useState } from 'react';
import type { Session, SessionSnapshot } from '../engine/session';
import type { GameDef } from '../engine/types';
import { useT } from '../i18n';
import { LookSections, type LookPart } from './LookSections';
import { OptionsForm } from './Setup';

const CARD_GAMES = new Set(['batak', 'esli-batak', 'balayi-batagi', '3-5-8', 'uclu-gommeli', 'king', 'pisti', 'papaz-kacti', '51', 'konken', 'holdem', 'poker', 'hearts', 'spades', 'durak', 'bluff', 'solitaire']);
const TILE_GAMES = new Set(['okey', 'okey-101']);

/** Which appearance settings make a visible difference in this game */
export function lookPartsFor(game: GameDef): LookPart[] {
  const parts: LookPart[] = ['theme'];
  if (game.maxPlayers > 1) parts.push('pieces');
  if (CARD_GAMES.has(game.id)) parts.push('cardBack', 'cardFace');
  if (TILE_GAMES.has(game.id)) parts.push('tiles');
  return parts;
}

/** 🎨 button + slide-in panel to restyle the table (and tweak the rules) without leaving the game */
export function CustomizeButton({ game, snap, session }: { game: GameDef; snap: SessionSnapshot; session: Session }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const canEditRules = snap.isHost && !!session.setOption;
  return (
    <>
      <button className="btn ghost small" onClick={() => setOpen(true)} aria-label={t('Customize the table')} title={t('Customize')}>
        🎨
      </button>
      {open && (
        <div className="drawer-backdrop" onClick={() => setOpen(false)}>
          <aside className="drawer stack" role="dialog" aria-label={t('Customize')} onClick={(e) => e.stopPropagation()}>
            <div className="row drawer-head">
              <h2 className="grow">{t('Customize')}</h2>
              <button className="icon-btn" onClick={() => setOpen(false)} aria-label={t('Close')}>
                ✕
              </button>
            </div>
            <LookSections parts={lookPartsFor(game)} />
            {(!!game.options?.length || !!game.OptionsExtra) && snap.phase === 'playing' && (
              <section className="stack-sm">
                <h2 className="section-title">{t('Rules')}</h2>
                <OptionsForm game={game} numPlayers={snap.players.length} options={snap.options} readOnly={!canEditRules} onChange={(id, v) => session.setOption?.(id, v)} />
                <p className="muted small">{canEditRules ? t('Rule changes apply from the next game (Play again).') : t('Only the host can change the rules.')}</p>
              </section>
            )}
            <p className="muted small">{t('Looks are saved on this device only; other players keep their own.')}</p>
          </aside>
        </div>
      )}
    </>
  );
}
